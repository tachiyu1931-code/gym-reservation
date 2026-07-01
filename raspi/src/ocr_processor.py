# -*- coding: utf-8 -*-
"""
ocr_processor.py
=================================================
台形補正済みカード画像から学籍番号領域を切り出し、
前処理・OCR・フォーマット検証を行う。
=================================================
"""

import re
import logging

import numpy as np
import cv2
import pytesseract

import config

logger = logging.getLogger("ocr_processor")

_ID_RE = re.compile(r"^" + config.ID_PATTERN + r"$")
_ID_SEARCH_RE = re.compile(config.ID_PATTERN)


def crop_number_region(warped_bgr: np.ndarray) -> np.ndarray:
    """
    台形補正済みカード画像から、学籍番号領域(NUMBER_REGION_FRAC)を切り出す。
    """
    h, w = warped_bgr.shape[:2]
    frac = config.NUMBER_REGION_FRAC
    x = int(w * frac["x"])
    y = int(h * frac["y"])
    rw = int(w * frac["w"])
    rh = int(h * frac["h"])
    return warped_bgr[y:y + rh, x:x + rw]


def preprocess_for_ocr(bgr_crop: np.ndarray) -> np.ndarray:
    """
    OCR精度向上のための前処理:
    グレースケール化 → 拡大 → コントラスト強調 → 二値化 → ノイズ除去
    """
    gray = cv2.cvtColor(bgr_crop, cv2.COLOR_BGR2GRAY)

    # 文字が小さい場合に備えて2倍に拡大
    gray = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)

    # コントラスト強調（CLAHE）
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)

    # 適応的二値化
    binary = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 15
    )

    # ノイズ除去
    binary = cv2.medianBlur(binary, 3)

    return binary


def run_ocr(preprocessed_img: np.ndarray) -> str:
    """pytesseractでOCRを実行し、生のテキストを返す。"""
    config_str = (
        f"--psm {config.OCR_PSM} "
        f"-c tessedit_char_whitelist={config.OCR_WHITELIST}"
    )
    text = pytesseract.image_to_string(preprocessed_img, config=config_str)
    return text.strip()


def extract_student_id(raw_text: str):
    """
    OCR結果テキストから学籍番号（T + 数字7桁 or 数字7桁）を抽出する。
    見つからない場合は None を返す。
    """
    cleaned = raw_text.upper().replace(" ", "").replace("\n", "")
    match = _ID_SEARCH_RE.search(cleaned)
    if not match:
        return None
    return match.group(0)


def is_valid_format(student_id: str) -> bool:
    """T(任意) + 数字7桁のフォーマットに厳密一致するか確認する。"""
    if not student_id:
        return False
    return bool(_ID_RE.match(student_id))


def read_student_id_from_card(warped_bgr: np.ndarray):
    """
    台形補正済みカード画像 → 番号領域切り出し → 前処理 → OCR → 抽出、
    を一括で行う。戻り値は (student_id or None, raw_text)。
    """
    crop = crop_number_region(warped_bgr)
    processed = preprocess_for_ocr(crop)
    raw_text = run_ocr(processed)
    student_id = extract_student_id(raw_text)

    if student_id and not is_valid_format(student_id):
        # 抽出はできたが厳密フォーマットに一致しない場合は不採用
        logger.warning("フォーマット不一致のため破棄: %r (raw=%r)", student_id, raw_text)
        student_id = None

    return student_id, raw_text