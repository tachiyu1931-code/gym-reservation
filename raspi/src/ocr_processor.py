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


def _crop_by_frac(bgr_crop: np.ndarray, x: float, y: float, w: float, h: float) -> np.ndarray:
    crop_h, crop_w = bgr_crop.shape[:2]
    left = max(0, min(int(crop_w * x), crop_w - 1))
    top = max(0, min(int(crop_h * y), crop_h - 1))
    right = max(left + 1, min(int(crop_w * (x + w)), crop_w))
    bottom = max(top + 1, min(int(crop_h * (y + h)), crop_h))
    return bgr_crop[top:bottom, left:right]


def iter_ocr_candidate_crops(bgr_crop: np.ndarray):
    """Yield full and number-focused crops from a configured ID area."""
    yield "full", bgr_crop
    # The fixed ROI matches the UI guide, so it can include the label and
    # dotted guide line. Focus OCR on the printed ID before giving up.
    yield "right_focus", _crop_by_frac(bgr_crop, 0.25, 0.05, 0.70, 0.70)
    yield "right_middle", _crop_by_frac(bgr_crop, 0.25, 0.15, 0.70, 0.50)
    yield "center_wide", _crop_by_frac(bgr_crop, 0.15, 0.05, 0.80, 0.70)


def crop_number_region(warped_bgr: np.ndarray) -> np.ndarray:
    """
    台形補正済みカード画像から、学籍番号領域(NUMBER_REGION_FRAC)を切り出す。
    """
    h, w = warped_bgr.shape[:2]
    frac = config.NUMBER_REGION_FRAC
    return safe_crop_roi(
        warped_bgr,
        int(w * frac["x"]),
        int(h * frac["y"]),
        int(w * frac["w"]),
        int(h * frac["h"]),
        padding=5,
    )


def safe_crop_roi(
    image: np.ndarray,
    x: int,
    y: int,
    width: int,
    height: int,
    padding: int = 0,
) -> np.ndarray:
    """ROIを画像内に収め、文字を欠けさせない余白付きコピーを返す。"""
    if image is None or image.size == 0:
        raise ValueError("Cannot crop an empty image.")

    image_h, image_w = image.shape[:2]
    left = max(0, min(int(x) - padding, image_w - 1))
    top = max(0, min(int(y) - padding, image_h - 1))
    right = max(left + 1, min(int(x + width) + padding, image_w))
    bottom = max(top + 1, min(int(y + height) + padding, image_h))
    return image[top:bottom, left:right].copy()

def crop_bright_text_area(
    bgr_image: np.ndarray,
    brightness_threshold: int = 60,
    bottom_cut_ratio: float = 0.18,
    padding: int = 16,
) -> np.ndarray:
    """最大の明るい紙領域を抽出し、点線部分を除いて白余白を加える。"""
    if bgr_image is None or bgr_image.size == 0:
        raise ValueError("Cannot preprocess an empty image.")

    gray = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2GRAY)

    # この二値画像は明るい紙領域の検出だけに使用し、OCRには渡さない。
    _, detection_mask = cv2.threshold(
        gray, brightness_threshold, 255, cv2.THRESH_BINARY
    )
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
    detection_mask = cv2.morphologyEx(detection_mask, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(
        detection_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    if contours:
        largest = max(contours, key=cv2.contourArea)
        x, y, width, height = cv2.boundingRect(largest)
        if cv2.contourArea(largest) >= gray.shape[0] * gray.shape[1] * 0.05:
            cropped = safe_crop_roi(gray, x, y, width, height)
        else:
            cropped = gray.copy()
    else:
        cropped = gray.copy()

    cut_ratio = max(0.0, min(float(bottom_cut_ratio), 0.40))
    keep_height = max(1, int(round(cropped.shape[0] * (1.0 - cut_ratio))))
    cropped = cropped[:keep_height, :].copy()

    return cv2.copyMakeBorder(
        cropped,
        padding,
        padding,
        padding,
        padding,
        cv2.BORDER_CONSTANT,
        value=255,
    )


ddef preprocess_for_ocr(bgr_crop: np.ndarray) -> np.ndarray:
    """物理クロップ・コントラスト強調・拡大後に二値化する。"""
    gray = crop_bright_text_area(
        bgr_crop,
        brightness_threshold=60,
        bottom_cut_ratio=0.18,
        padding=16,
    )

    # コントラスト強調(CLAHE)を必ず通す。暗い/ムラのある入力でも
    # 文字と背景の差を持ち上げてから二値化する。
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)

    enlarged = cv2.resize(gray, None, fx=3.0, fy=3.0, interpolation=cv2.INTER_CUBIC)

    # まず Otsu を試す
    _, binary = cv2.threshold(enlarged, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    black_ratio = 1.0 - (np.count_nonzero(binary) / binary.size)
    logger.info("Otsu black_ratio=%.2f mean_gray=%.1f", black_ratio, float(np.mean(enlarged)))

    # Otsuが崩壊している(ほぼ全黒 or ほぼ全白)場合は適応的二値化にフォールバック
    if black_ratio > 0.85 or black_ratio < 0.02:
        binary = cv2.adaptiveThreshold(
            enlarged, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY,
            31, 15,
        )
        logger.info("Fell back to adaptiveThreshold due to bad Otsu result")

    return binary

def run_ocr(preprocessed_img: np.ndarray) -> str:
    """PSM 7/8を比較し、有効IDまたは最も情報量の多い結果を返す。"""
    results = []
    for psm in config.OCR_PSM_CANDIDATES:
        config_str = (
            f"--psm {psm} "
            f"-c tessedit_char_whitelist={config.OCR_WHITELIST}"
        )
        text = pytesseract.image_to_string(preprocessed_img, config=config_str).strip()
        if text:
            results.append(text)
            if extract_student_id(text):
                return text

    return max(results, key=len, default="")

def normalize_ocr_text(raw_text: str) -> str:
    """OCRの誤認識を、ID抽出前だけ数字寄りに補正する。"""
    cleaned = raw_text.upper().replace(" ", "").replace("\n", "")
    return cleaned.translate(str.maketrans({
        "O": "0",
        "Q": "0",
        "I": "1",
        "L": "1",
        "Z": "2",
        "S": "5",
        "B": "8",
    }))

def extract_student_id(raw_text: str):
    """
    OCR結果テキストからID（学生: 数字7桁、教職員: T + 数字3桁）を抽出する。
    見つからない場合は None を返す。
    """
    cleaned = normalize_ocr_text(raw_text)
    match = _ID_SEARCH_RE.search(cleaned)
    if not match:
        return None
    return match.group(0)


def is_valid_format(student_id: str) -> bool:
    """学生IDまたは教職員IDのフォーマットに厳密一致するか確認する。"""
    if not student_id:
        return False
    return bool(_ID_RE.match(student_id))



def crop_fixed_number_roi(full_bgr: np.ndarray) -> np.ndarray:
    """固定OCR領域を、境界チェック付きで安全に切り出す。"""
    box = config.NUMBER_ROI_BOX
    return safe_crop_roi(
        full_bgr,
        box["x"],
        box["y"],
        box["w"],
        box["h"],
    )


def read_student_id_from_crop(bgr_crop: np.ndarray):
    """Read a student ID directly from an already-cropped BGR image."""
    raw_results = []

    for label, candidate_crop in iter_ocr_candidate_crops(bgr_crop):
        processed = preprocess_for_ocr(candidate_crop)
        cv2.imwrite(f"/tmp/debug_preprocessed_{label}.jpg", processed)
        raw_text = run_ocr(processed)
        raw_results.append(f"{label}={raw_text!r}")

        student_id = extract_student_id(raw_text)
        if student_id and is_valid_format(student_id):
            return student_id, raw_text

        if student_id:
            logger.warning("Rejected invalid student id format %r (raw=%r)", student_id, raw_text)

    return None, "; ".join(raw_results)

def read_student_id_from_card(warped_bgr: np.ndarray):
    """
    台形補正済みカード画像から学籍番号を読み取る。
    """
    crop = crop_number_region(warped_bgr)
    return read_student_id_from_crop(crop)