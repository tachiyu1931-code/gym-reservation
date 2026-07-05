# -*- coding: utf-8 -*-
"""
config.py
=================================================
学生証番号 自動検出・OCR読み取り・送信システムの設定値。

★このファイルにある値は、実機での動作を見ながら調整することを
  前提にしています（下記コメントの「要調整」マーク参照）。
=================================================
"""

import json
import os
from pathlib import Path


def _load_network_config() -> dict:
    """共有の network-config.json から接続先を読み込む。"""
    base_dir = Path(__file__).resolve().parents[2]
    config_path = Path(os.environ.get("GYM_RESERVATION_CONFIG_PATH", base_dir / "network-config.json"))

    if not config_path.exists():
        return {}

    try:
        with config_path.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except (json.JSONDecodeError, OSError):
        return {}


NETWORK_CONFIG = _load_network_config()


# ===================== カメラ設定 =====================
# OCR用（フル解像度）
CAMERA_SIZE = (4608, 2592)

# ライブ配信・待機監視用（低解像度＝lores）
STREAM_SIZE = (640, 360)
STREAM_JPEG_QUALITY = 70
STREAM_SLEEP_SEC = 0.1

# ===================== 待機モード（軽量監視）設定 =====================
# 要調整-1: 待機モード時のポーリング間隔（秒）。1〜2fps目安 → 0.5〜1.0秒
IDLE_POLL_INTERVAL_SEC = 0.6

# 監視対象領域（lores解像度=640x360 内の座標、カードがだいたい置かれる範囲より
# 少し広めに取る）。要調整: 実際にカードを置く場所に合わせて変更する。
# フルフレームで検知したい場合は None のままでOK。
MOTION_ROI = None  # 例: {"x": 150, "y": 60, "w": 340, "h": 240}

# 背景との差分がこの値を超えた画素を「変化あり」とみなす（0-255の輝度差）
MOTION_DIFF_THRESHOLD = 25

# ROI内で「変化あり」画素がこの割合を超えたら物体ありと判定
MOTION_CHANGE_RATIO = 0.05

# 物体ありと判定された状態が何フレーム連続したら本処理に移行するか
# （手が通り過ぎただけの誤検知を防ぐ）
MOTION_STABLE_FRAMES = 3

# 直近フレーム間の差分がこの割合以下なら「静止した」とみなす
# （カードがまだ動いている間はOCRに進まない）
MOTION_SETTLE_RATIO = 0.02

# 要調整-2: 送信完了後、待機モードに戻るまでのクールダウン秒数
COOLDOWN_SEC = 4

# 要調整-5: カード未検出のままこの秒数が経過したらタイムアウト扱い
CARD_DETECT_TIMEOUT_SEC = 8

# ===================== カード輪郭検出設定 =====================
# ISO/IEC 7810 ID-1サイズ（85.60mm x 53.98mm）の縦横比
CARD_ASPECT_RATIO = 85.60 / 53.98  # ≈ 1.586
CARD_ASPECT_TOLERANCE = 0.25  # この比率からのズレ許容範囲

# 検出したカード候補の面積が、フル画像に対してこの割合以上を占めること
CARD_MIN_AREA_RATIO = 0.05

# 台形補正後（perspective warp後）のカード画像サイズ
CARD_WARP_WIDTH = 1600
CARD_WARP_HEIGHT = int(CARD_WARP_WIDTH / CARD_ASPECT_RATIO)

# ===================== 学籍番号領域の設定 =====================
# 台形補正済みカード画像内での、学籍番号が印字されている領域を
# カード全体に対する比率(0.0〜1.0)で指定する。
# 要調整: /capture_warp?debug=1 等で実際のwarp画像を見ながら微調整すること。
NUMBER_REGION_FRAC = {"x": 0.55, "y": 0.03, "w": 0.42, "h": 0.14}

# Fixed OCR region in the full camera image.
# Keep this in sync with web/src/components/ScannerOverlay.tsx CROP_BOX.
NUMBER_ROI_BOX = {"x": 2800, "y": 3, "w": 1800, "h": 500}

# ===================== OCR設定 =====================
# 認識対象文字（数字＋T）
OCR_WHITELIST = "0123456789T"

# tesseractのページセグメンテーションモード（7=単一行として扱う）
OCR_PSM = 7

# IDフォーマット: 学生は数字7桁、教職員はT + 数字3桁
# (?<![A-Z0-9]) / (?![A-Z0-9]) は前後が英数字でないことを保証する。
# これがないと "12345678"(8桁)から誤って"1234567"を切り出してしまう。
ID_PATTERN = r"(?<![A-Z0-9])(?:\d{7}|T\d{3})(?![A-Z0-9])"

# 要調整-3: フォーマット不一致時の再試行回数・間隔
MAX_OCR_RETRIES = 3
OCR_RETRY_INTERVAL_SEC = 0.5

# ===================== API送信設定 =====================
# 要調整-4: 実際のNext.js側APIエンドポイントに合わせて変更する
NEXTJS_HOST = NETWORK_CONFIG.get("nextjsHost", "localhost")
NEXTJS_PORT = NETWORK_CONFIG.get("nextjsPort", 3000)
NEXTJS_SCHEME = NETWORK_CONFIG.get("scheme", "http")
NEXTJS_API_URL = f"{NEXTJS_SCHEME}://{NEXTJS_HOST}:{NEXTJS_PORT}/api/checkin/scan"

# Basic Authではなく、サーバー間通信用の共有シークレットをヘッダーで送る方式を推奨
# （/adminのBasic Authはブラウザでの人間の認証向けのため、ラズパイ→APIの
#  マシン間通信には環境変数化した固定シークレットの方がシンプル）
API_SECRET_HEADER = "X-Scanner-Secret"
API_SECRET_KEY = "CHANGE_ME"  # 要: 環境変数(os.environ)からの読み込みに変更すること

API_TIMEOUT_SEC = 5
API_MAX_RETRIES = 3
API_RETRY_BACKOFF_SEC = 1.0

# ===================== ログ設定 =====================
LOG_LEVEL = "INFO"
