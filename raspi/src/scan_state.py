# -*- coding: utf-8 -*-
"""
scan_state.py
=================================================
「待機モード（軽量監視）→ 本処理（検知後）→ クールダウン」の
二段階検知フローをバックグラウンドスレッドで実行する状態管理クラス。

発熱対策として、待機モード中はlores(低解像度)ストリームのみを使い、
カードらしき変化を検知した時だけフル解像度撮影・輪郭検出・OCRに切り替える。
=================================================
"""

import logging
import threading
import time

import numpy as np
import cv2

import config
import card_detector
import ocr_processor
import api_client

logger = logging.getLogger("scan_state")

STATE_IDLE = "idle"
STATE_DETECTED = "detected"        # 変化を検知し、静止待ち
STATE_PROCESSING = "processing"    # フル解像度でカード検出・OCR中
STATE_SUCCESS = "success"
STATE_ERROR = "error"
STATE_COOLDOWN = "cooldown"


class ScannerStateMachine:
    """
    capture_lores_gray_fn: () -> np.ndarray (グレースケール, lores解像度)
        待機モードの軽量監視に使う。
    capture_full_bgr_fn: () -> np.ndarray (BGR, フル解像度)
        本処理（カード検出・OCR）に使う。
    """

    def __init__(self, capture_lores_gray_fn, capture_full_bgr_fn):
        self._capture_lores_gray = capture_lores_gray_fn
        self._capture_full_bgr = capture_full_bgr_fn

        self._lock = threading.Lock()
        self._status = {
            "state": STATE_IDLE,
            "studentId": None,
            "message": None,
            "updatedAt": time.time(),
        }
        self._stop_event = threading.Event()
        self._thread = None

    # ---------------- 外部公開API ----------------

    def start(self):
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        logger.info("ScannerStateMachine started")

    def stop(self):
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=2)

    def get_status(self) -> dict:
        with self._lock:
            return dict(self._status)

    def force_idle(self):
        """外部からの強制リセット（例: 管理画面からのキャンセル操作）用。"""
        self._set_status(STATE_IDLE)

    # ---------------- 内部処理 ----------------

    def _set_status(self, state, student_id=None, message=None):
        with self._lock:
            self._status = {
                "state": state,
                "studentId": student_id,
                "message": message,
                "updatedAt": time.time(),
            }
        logger.info("state -> %s (studentId=%s, message=%s)", state, student_id, message)

    def _crop_roi(self, gray_frame: np.ndarray) -> np.ndarray:
        roi = config.MOTION_ROI
        if roi is None:
            return gray_frame
        return gray_frame[roi["y"]:roi["y"] + roi["h"], roi["x"]:roi["x"] + roi["w"]]

    def _diff_ratio(self, frame_a: np.ndarray, frame_b: np.ndarray) -> float:
        diff = cv2.absdiff(frame_a, frame_b)
        changed = np.count_nonzero(diff > config.MOTION_DIFF_THRESHOLD)
        return changed / diff.size

    def _run_loop(self):
        baseline = self._crop_roi(self._capture_lores_gray())
        stable_count = 0
        prev_frame = baseline

        while not self._stop_event.is_set():
            state = self.get_status()["state"]

            # ---------- IDLE: 軽量監視 ----------
            if state in (STATE_IDLE, STATE_SUCCESS, STATE_ERROR):
                if state != STATE_IDLE:
                    self._set_status(STATE_IDLE)
                time.sleep(config.IDLE_POLL_INTERVAL_SEC)

                frame = self._crop_roi(self._capture_lores_gray())
                change_ratio = self._diff_ratio(baseline, frame)
                settle_ratio = self._diff_ratio(prev_frame, frame)
                prev_frame = frame

                if change_ratio > config.MOTION_CHANGE_RATIO:
                    stable_count += 1
                else:
                    stable_count = 0

                if (
                    stable_count >= config.MOTION_STABLE_FRAMES
                    and settle_ratio < config.MOTION_SETTLE_RATIO
                ):
                    # 物体が置かれ、かつ静止したと判断 → 本処理へ
                    stable_count = 0
                    self._set_status(STATE_PROCESSING)
                continue

            # ---------- PROCESSING: フル解像度でカード検出・OCR ----------
            if state == STATE_PROCESSING:
                self._process_scan()
                continue

            # ---------- COOLDOWN ----------
            if state == STATE_COOLDOWN:
                time.sleep(config.COOLDOWN_SEC)
                # クールダウン明けに背景を撮り直してIDLEへ
                baseline = self._crop_roi(self._capture_lores_gray())
                prev_frame = baseline
                stable_count = 0
                self._set_status(STATE_IDLE)
                continue

            # 想定外の状態はIDLEに戻す
            self._set_status(STATE_IDLE)

    def _process_scan(self):
        start_time = time.time()

        for attempt in range(1, config.MAX_OCR_RETRIES + 1):
            if time.time() - start_time > config.CARD_DETECT_TIMEOUT_SEC:
                self._set_status(STATE_ERROR, message="カード検出タイムアウト")
                self._set_status(STATE_COOLDOWN)
                return

            try:
                full_bgr = self._capture_full_bgr()
                fixed_crop = ocr_processor.crop_fixed_number_roi(full_bgr)
                student_id, raw_text = ocr_processor.read_student_id_from_crop(fixed_crop)

                if student_id is None:
                    warped = card_detector.detect_and_warp(full_bgr)
                    if warped is not None:
                        student_id, raw_text = ocr_processor.read_student_id_from_card(warped)
                if student_id is None:
                    logger.info(
                        "OCRフォーマット不一致(試行%d/%d) raw=%r",
                        attempt, config.MAX_OCR_RETRIES, raw_text,
                    )
                    time.sleep(config.OCR_RETRY_INTERVAL_SEC)
                    continue

                # OCR成功 → API送信
                success, detail = api_client.send_scan_result(student_id)
                if success:
                    self._set_status(STATE_SUCCESS, student_id=student_id, message=detail)
                else:
                    self._set_status(STATE_ERROR, student_id=student_id, message=f"送信失敗: {detail}")
                self._set_status(STATE_COOLDOWN)
                return

            except Exception as e:
                logger.exception("本処理中に例外が発生しました")
                self._set_status(STATE_ERROR, message=str(e))
                self._set_status(STATE_COOLDOWN)
                return

        # 規定回数リトライしても失敗
        self._set_status(STATE_ERROR, message="OCR読み取り失敗(規定回数リトライ後)")
        self._set_status(STATE_COOLDOWN)
