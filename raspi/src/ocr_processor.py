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
    return safe_crop_roi(bgr_crop, x, y, w, h, padding=padding)


<<<<<<< HEAD
def preprocess_for_ocr(bgr_crop: np.ndarray) -> np.ndarray:
    """物理クロップ・白余白・拡大後に二値化する。"""
    gray = crop_bright_text_area(
        bgr_crop,
        brightness_threshold=60,
        bottom_cut_ratio=0.18,
        padding=16,
    )
    enlarged = cv2.resize(
        gray,
        None,
        fx=3.0,
        fy=3.0,
        interpolation=cv2.INTER_CUBIC,
    )

    if config.OCR_USE_OTSU:
        _, binary = cv2.threshold(
            enlarged, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU,
        )
    else:
        # 固定しきい値: OCR_BINARY_THRESHOLD 未満の画素だけを黒(0)として残す。
        # グレー(影・紙のムラ)は白(255)側に逃がす。
        _, binary = cv2.threshold(
            enlarged, config.OCR_BINARY_THRESHOLD, 255, cv2.THRESH_BINARY,
        )
=======

def crop_to_digit_band(
    gray: np.ndarray,
    min_height_ratio: float = 0.45,
    margin: int = 12,
) -> np.ndarray:
    """点線や小ノイズを除外し、文字と同程度の高さの成分を余白付きで囲む。"""
    if gray is None or gray.size == 0:
        return gray

    binary = _binarize_for_analysis(gray)
    foreground = cv2.bitwise_not(binary)
    num_labels, _, stats, _ = cv2.connectedComponentsWithStats(foreground, connectivity=8)
    if num_labels <= 1:
        return gray

    image_h, image_w = gray.shape
    image_area = image_h * image_w
    candidates = []
    for index in range(1, num_labels):
        x, y, w, h, area = stats[index]
        touches_border = x == 0 or y == 0 or x + w >= image_w or y + h >= image_h
        if area < 8 or area > image_area * 0.80:
            continue
        if touches_border and (w > image_w * 0.50 or h > image_h * 0.50):
            continue
        candidates.append((x, y, w, h, area))

    if not candidates:
        return gray

    max_height = max(item[3] for item in candidates)
    min_height = max(3, int(max_height * min_height_ratio))
    kept = [item for item in candidates if item[3] >= min_height]
    if not kept:
        return gray

    left = min(item[0] for item in kept)
    top = min(item[1] for item in kept)
    right = max(item[0] + item[2] for item in kept)
    bottom = max(item[1] + item[3] for item in kept)
    return safe_crop_roi(gray, left, top, right - left, bottom - top, padding=margin)


def pad_to_target_ratio(
    gray: np.ndarray,
    target_ratio: float = 3.0,
    fixed_margin: int = 24,
) -> np.ndarray:
    """OCR用の縦横比と、文字周囲の白いクワイエットゾーンを確保する。"""
    if gray is None or gray.size == 0:
        return gray

    h, w = gray.shape
    ratio = w / h
    top = bottom = left = right = 0
    if ratio > target_ratio:
        target_h = int(np.ceil(w / target_ratio))
        total = max(0, target_h - h)
        top, bottom = total // 2, total - total // 2
    elif ratio < target_ratio * 0.5:
        target_w = int(np.ceil(h * target_ratio * 0.5))
        total = max(0, target_w - w)
        left, right = total // 2, total - total // 2

    padded = cv2.copyMakeBorder(
        gray, top, bottom, left, right, cv2.BORDER_CONSTANT, value=255
    )
    return cv2.copyMakeBorder(
        padded,
        fixed_margin,
        fixed_margin,
        fixed_margin,
        fixed_margin,
        cv2.BORDER_CONSTANT,
        value=255,
    )


def resize_to_target_height(gray: np.ndarray, target_height: int = 100) -> np.ndarray:
    """縦横比を保ったままOCR向けの高さへ正規化する。"""
    if gray is None or gray.size == 0:
        return gray

    h, w = gray.shape
    scale = target_height / h
    target_w = max(1, int(round(w * scale)))
    interpolation = cv2.INTER_CUBIC if scale > 1 else cv2.INTER_AREA
    return cv2.resize(gray, (target_w, target_height), interpolation=interpolation)

def preprocess_for_ocr(bgr_crop: np.ndarray) -> np.ndarray:
    """黒帯と点線を除去し、文字サイズと余白をOCR向けに正規化する。"""
    cropped = autocrop_bright_region(bgr_crop)
    gray = cv2.cvtColor(cropped, cv2.COLOR_BGR2GRAY)
    gray = crop_to_digit_band(gray, min_height_ratio=0.45, margin=12)
    gray = pad_to_target_ratio(gray, target_ratio=3.0, fixed_margin=24)
    gray = resize_to_target_height(gray, target_height=100)
>>>>>>> 575f6d94d10c0843b82da3745a09918de15fe5aa

    logger.info(
        "binarize: mode=%s threshold=%s mean_gray=%.1f black_ratio=%.2f",
        "otsu" if config.OCR_USE_OTSU else "fixed",
        config.OCR_BINARY_THRESHOLD,
        float(np.mean(enlarged)),
        1.0 - (np.count_nonzero(binary) / binary.size),
    )

<<<<<<< HEAD
=======
    # 適応的二値化は文字を中抜けさせたため、Otsu法を維持する。
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
>>>>>>> 575f6d94d10c0843b82da3745a09918de15fe5aa
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
