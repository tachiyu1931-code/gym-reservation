# -*- coding: utf-8 -*-
"""
ocr_server.py
=================================================
ラズパイ4 + Camera Module3 用
学生証番号 自動検出・OCR読み取り・送信システム（拡張版）

【起動方法】
    python3 ocr_server.py

【エンドポイント】
    GET  /health         : 死活確認
    GET  /capture         : 撮影した画像全体を返す（座標調整用）
                             ?box=x,y,w,h を付けると赤枠を重ねて確認できる
    GET  /capture_warp    : 台形補正後のカード画像を返す（NUMBER_REGION_FRACの調整用）
    GET|POST /scan        : 手動で1回スキャンを実行しJSONで返す（テスト・キャリブレーション用）
                             ?debug=1 で切り出し画像もbase64で返す
    GET  /stream           : ライブ映像配信(MJPEG)。lores(低解像度)ストリームを使用
    GET  /status            : 現在の自動検知ステート（idle/processing/success/error/cooldown）を返す
                             ScannerOverlay.tsx はこれをポーリングしてUIに反映する想定
    POST /status/reset      : 自動検知ステートを強制的にidleへリセット（管理用）

【今回の拡張点（実装プロンプト対応）】
    1. card_detector.py    : カード輪郭検出＋台形補正（新規実装）
    2. ocr_processor.py    : 番号領域切り出し・前処理・OCR・フォーマット検証（新規実装）
    3. api_client.py        : Next.js APIへの送信（リトライ付き, 新規実装）
    4. scan_state.py        : 待機監視→検知→本処理→クールダウンの二段階検知
                              バックグラウンドスレッド（新規実装）
    5. config.py             : 全ての調整可能パラメータを集約
=================================================
"""

import io
import base64
import logging
import threading
import time
from datetime import datetime

import numpy as np
import cv2
from PIL import Image
from flask import Flask, jsonify, send_file, request, Response

import config
import card_detector
import ocr_processor
from scan_state import ScannerStateMachine

logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ocr_server")

app = Flask(__name__)

camera_lock = threading.Lock()
picam2 = None
state_machine: ScannerStateMachine = None


def init_camera():
    """Camera Module3を初期化する（main=フル解像度/OCR用, lores=低解像度/監視・配信用）"""
    global picam2
    from picamera2 import Picamera2

    picam2 = Picamera2()
    cam_config = picam2.create_still_configuration(
        main={"size": config.CAMERA_SIZE},
        lores={"size": config.STREAM_SIZE, "format": "YUV420"},
    )
    picam2.configure(cam_config)
    picam2.start()

    try:
        from libcamera import controls
        picam2.set_controls({"AfMode": controls.AfModeEnum.Auto})
    except Exception as e:
        logger.warning("オートフォーカス設定に失敗しました: %s", e)


def capture_image() -> Image.Image:
    """1枚撮影してPIL Imageで返す（OCR用。mainストリーム=フル解像度を使用）"""
    with camera_lock:
        try:
            picam2.autofocus_cycle()
        except Exception:
            pass
        array = picam2.capture_array("main")
    return Image.fromarray(array).convert("RGB")


def capture_full_bgr() -> np.ndarray:
    """本処理（カード検出）用: フル解像度BGR画像を返す"""
    pil_img = capture_image()
    return cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)


def capture_lores_gray() -> np.ndarray:
    """待機モード監視用: loresストリームからグレースケール画像を返す（軽量）"""
    with camera_lock:
        array = picam2.capture_array("lores")
    # YUV420のY成分(輝度)がそのままグレースケール画像に相当する
    h = config.STREAM_SIZE[1]
    return array[:h, :].copy()


def gen_frames():
    """MJPEGストリーム用のフレーム生成ジェネレータ（loresストリーム使用）"""
    while True:
        with camera_lock:
            array = picam2.capture_array("lores")
        rgb = cv2.cvtColor(array, cv2.COLOR_YUV2RGB_I420)
        frame = Image.fromarray(rgb)

        buf = io.BytesIO()
        frame.save(buf, format="JPEG", quality=config.STREAM_JPEG_QUALITY)
        jpeg_bytes = buf.getvalue()

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + jpeg_bytes + b'\r\n')
        time.sleep(config.STREAM_SLEEP_SEC)


def run_single_scan(debug: bool = False) -> dict:
    """
    Run one scan. Try the fixed UI-aligned number ROI first, then fall back to
    card contour detection and perspective warp.
    """
    full_bgr = capture_full_bgr()

    fixed_crop = ocr_processor.crop_fixed_number_roi(full_bgr)
    student_id, raw_text = ocr_processor.read_student_id_from_crop(fixed_crop)
    debug_crop = fixed_crop
    method = "fixed_roi"

    if student_id is None:
        warped = card_detector.detect_and_warp(full_bgr)
        if warped is not None:
            student_id, raw_text = ocr_processor.read_student_id_from_card(warped)
            debug_crop = ocr_processor.crop_number_region(warped)
            method = "card_warp"

    result = {
        "success": student_id is not None,
        "studentId": student_id,
        "rawText": raw_text,
        "method": method,
        "timestamp": datetime.now().isoformat(),
    }

    if not result["success"]:
        result["error"] = "OCR failed. Check the ID position, focus, and lighting."

    if debug:
        buf = io.BytesIO()
        Image.fromarray(cv2.cvtColor(debug_crop, cv2.COLOR_BGR2RGB)).save(buf, format="JPEG")
        result["debugImage"] = base64.b64encode(buf.getvalue()).decode()

    return result


# ===================== ルート定義 =====================

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "time": datetime.now().isoformat()})


@app.route("/capture", methods=["GET"])
def capture():
    """座標調整用: 撮影画像全体を返す。?box=x,y,w,h で赤枠を重ねられる。"""
    image = capture_image()

    box_param = request.args.get("box")
    if box_param:
        try:
            x, y, w, h = map(int, box_param.split(","))
            draw_img = np.array(image)
            cv2.rectangle(draw_img, (x, y), (x + w, y + h), (255, 0, 0), 6)
            image = Image.fromarray(draw_img)
        except Exception:
            pass

    buf = io.BytesIO()
    image.save(buf, format="JPEG", quality=85)
    buf.seek(0)
    return send_file(buf, mimetype="image/jpeg")


@app.route("/capture_warp", methods=["GET"])
def capture_warp():
    """
    台形補正後のカード画像を返す（config.NUMBER_REGION_FRACの調整用）。
    ?box=1 を付けると学籍番号領域に赤枠を重ねて返す。
    """
    full_bgr = capture_full_bgr()
    warped = card_detector.detect_and_warp(full_bgr)

    if warped is None:
        return jsonify({"success": False, "error": "カードが検出できませんでした"}), 422

    if request.args.get("box") == "1":
        h, w = warped.shape[:2]
        frac = config.NUMBER_REGION_FRAC
        x, y = int(w * frac["x"]), int(h * frac["y"])
        rw, rh = int(w * frac["w"]), int(h * frac["h"])
        cv2.rectangle(warped, (x, y), (x + rw, y + rh), (0, 0, 255), 4)

    buf = io.BytesIO()
    Image.fromarray(cv2.cvtColor(warped, cv2.COLOR_BGR2RGB)).save(buf, format="JPEG", quality=90)
    buf.seek(0)
    return send_file(buf, mimetype="image/jpeg")


@app.route("/scan", methods=["GET", "POST"])
def scan():
    """
    手動スキャン（テスト・キャリブレーション用）。
    自動検知ループとは独立して、その場で1回だけ処理を実行する。
    """
    try:
        result = run_single_scan(debug=request.args.get("debug") == "1")
        status_code = 200 if result.get("success") else 422
        return jsonify(result), status_code
    except Exception as e:
        logger.exception("/scan でエラーが発生しました")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/stream")
def stream():
    """ライブ映像配信(MJPEG)。loresストリーム(低解像度)を使用するため軽量。"""
    return Response(gen_frames(),
                     mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/status", methods=["GET"])
def status():
    """
    自動検知の現在ステートを返す。
    ScannerOverlay.tsx はこれを一定間隔（例: 500ms）でポーリングし、
    idle/processing/success/error/cooldown に応じてUI表示を切り替える想定。
    """
    return jsonify(state_machine.get_status())


@app.route("/status/reset", methods=["POST"])
def status_reset():
    """自動検知ステートを強制的にidleへリセットする（管理用）。"""
    state_machine.force_idle()
    return jsonify({"success": True})


# ===================== 起動 =====================
if __name__ == "__main__":
    init_camera()
    state_machine = ScannerStateMachine(
        capture_lores_gray_fn=capture_lores_gray,
        capture_full_bgr_fn=capture_full_bgr,
    )
    state_machine.start()
    app.run(host="0.0.0.0", port=5000, threaded=True, debug=False)
