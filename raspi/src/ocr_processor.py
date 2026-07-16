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
    x = int(w * frac["x"])
    y = int(h * frac["y"])
    rw = int(w * frac["w"])
    rh = int(h * frac["h"])
    return warped_bgr[y:y + rh, x:x + rw]


def autocrop_bright_region(
    bgr_crop: np.ndarray,
    brightness_threshold: int = 40,
    padding: int = 10,
) -> np.ndarray:
    """黒い余白を除き、最も大きい明るい領域を切り出す。"""
    if bgr_crop is None or bgr_crop.size == 0:
        return bgr_crop

    gray = cv2.cvtColor(bgr_crop, cv2.COLOR_BGR2GRAY)
    _, mask = cv2.threshold(gray, brightness_threshold, 255, cv2.THRESH_BINARY)

    kernel = np.ones((15, 15), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return bgr_crop

    largest = max(contours, key=cv2.contourArea)
    if cv2.contourArea(largest) < bgr_crop.shape[0] * bgr_crop.shape[1] * 0.05:
        return bgr_crop

    x, y, w, h = cv2.boundingRect(largest)
    image_h, image_w = bgr_crop.shape[:2]
    x0 = max(0, x - padding)
    y0 = max(0, y - padding)
    x1 = min(image_w, x + w + padding)
    y1 = min(image_h, y + h + padding)
    return bgr_crop[y0:y1, x0:x1]


def isolate_first_text_line(
    gray_img: np.ndarray,
    density_threshold: float = 0.03,
    max_density_threshold: float = 0.80,
    min_gap_rows: int = 5,
    padding: int = 5,
) -> np.ndarray:
    """暗画素の行密度から、最初の文字行だけを抽出する。"""
    if gray_img is None or gray_img.size == 0:
        return gray_img

    dark_mask = gray_img < 128
    row_density = dark_mask.mean(axis=1)
    text_start = None
    gap_count = 0

    for row, density in enumerate(row_density):
        if density_threshold < density < max_density_threshold:
            if text_start is None:
                text_start = row
            gap_count = 0
        elif text_start is not None:
            gap_count += 1
            if gap_count >= min_gap_rows:
                text_end = row - gap_count + 1
                return gray_img[
                    max(0, text_start - padding):min(gray_img.shape[0], text_end + padding),
                    :,
                ]

    if text_start is None:
        return gray_img
    return gray_img[max(0, text_start - padding):, :]


def preprocess_for_ocr(bgr_crop: np.ndarray) -> np.ndarray:
    """黒帯と別行を除去し、単一行OCR向けの二値画像を作る。"""
    cropped = autocrop_bright_region(bgr_crop)
    gray = cv2.cvtColor(cropped, cv2.COLOR_BGR2GRAY)
    gray = isolate_first_text_line(gray)

    if gray.size == 0:
        gray = cv2.cvtColor(bgr_crop, cv2.COLOR_BGR2GRAY)

    target_line_height = 60
    scale = target_line_height / gray.shape[0] if gray.shape[0] > 0 else 2.0
    scale = max(1.5, min(scale, 6.0))
    gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)

    # 適応的二値化は文字を輪郭状にすることがあるため、Otsu法を使う。
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return cv2.medianBlur(binary, 3)

def run_ocr(preprocessed_img: np.ndarray) -> str:
    """pytesseractでOCRを実行し、生のテキストを返す。"""
    config_str = (
        f"--psm {config.OCR_PSM} "
        f"-c tessedit_char_whitelist={config.OCR_WHITELIST}"
    )
    text = pytesseract.image_to_string(preprocessed_img, config=config_str)
    return text.strip()


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
    """Crop the fixed OCR region from the full camera image."""
    h, w = full_bgr.shape[:2]
    box = config.NUMBER_ROI_BOX
    x = max(0, min(int(box["x"]), w))
    y = max(0, min(int(box["y"]), h))
    rw = max(1, min(int(box["w"]), w - x))
    rh = max(1, min(int(box["h"]), h - y))
    return full_bgr[y:y + rh, x:x + rw]


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
