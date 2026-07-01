# -*- coding: utf-8 -*-
"""
card_detector.py
=================================================
撮影したフル解像度画像から「学生証カードらしき四角形」を検出し、
台形補正（perspective warp）してカード正面画像に変換する。

既存のocr_server.pyには輪郭検出ロジックは実装されていなかったため、
本モジュールで新規に実装する。
=================================================
"""

import numpy as np
import cv2

import config


def order_points(pts: np.ndarray) -> np.ndarray:
    """
    4点の座標を [左上, 右上, 右下, 左下] の順に並べ替える。
    """
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]  # 左上: x+yが最小
    rect[2] = pts[np.argmax(s)]  # 右下: x+yが最大

    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]  # 右上: y-xが最小
    rect[3] = pts[np.argmax(diff)]  # 左下: y-xが最大
    return rect


def find_card_contour(bgr_image: np.ndarray):
    """
    画像内からカードらしき四角形の輪郭（4点）を探す。
    見つからない場合は None を返す。
    """
    gray = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(blurred, 50, 150)

    # 輪郭の切れ目をつなげるために膨張処理
    edged = cv2.dilate(edged, np.ones((3, 3), np.uint8), iterations=2)
    edged = cv2.erode(edged, np.ones((3, 3), np.uint8), iterations=1)

    contours, _ = cv2.findContours(
        edged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    if not contours:
        return None

    image_area = bgr_image.shape[0] * bgr_image.shape[1]
    min_area = image_area * config.CARD_MIN_AREA_RATIO

    candidates = []
    for cnt in sorted(contours, key=cv2.contourArea, reverse=True)[:10]:
        area = cv2.contourArea(cnt)
        if area < min_area:
            continue

        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)

        if len(approx) != 4:
            # 4点で近似できない場合は最小外接矩形で代用する
            rect = cv2.minAreaRect(cnt)
            box = cv2.boxPoints(rect)
            approx = box.reshape(-1, 1, 2)

        pts = approx.reshape(4, 2).astype("float32")
        ordered = order_points(pts)

        # 縦横比チェック（横向き・縦向きどちらでも許容）
        width = np.linalg.norm(ordered[0] - ordered[1])
        height = np.linalg.norm(ordered[1] - ordered[2])
        if width == 0 or height == 0:
            continue
        ratio = max(width, height) / min(width, height)

        if abs(ratio - config.CARD_ASPECT_RATIO) <= config.CARD_ASPECT_TOLERANCE:
            candidates.append((area, ordered))

    if not candidates:
        return None

    # 最も面積の大きい候補を採用
    candidates.sort(key=lambda c: c[0], reverse=True)
    return candidates[0][1]


def warp_card(bgr_image: np.ndarray, quad: np.ndarray) -> np.ndarray:
    """
    4点座標(quad)を元に、カードを正面から見た画像に台形補正する。
    出力サイズは config.CARD_WARP_WIDTH / HEIGHT に正規化する。
    横向きに検出された場合は90度回転して縦横比を揃える。
    """
    (tl, tr, br, bl) = quad
    width = np.linalg.norm(tr - tl)
    height = np.linalg.norm(bl - tl)

    dst_w, dst_h = config.CARD_WARP_WIDTH, config.CARD_WARP_HEIGHT

    # 検出された輪郭が縦長(width < height)の場合は出力も縦横を入れ替える
    if width < height:
        dst_w, dst_h = dst_h, dst_w

    dst = np.array(
        [[0, 0], [dst_w - 1, 0], [dst_w - 1, dst_h - 1], [0, dst_h - 1]],
        dtype="float32",
    )
    matrix = cv2.getPerspectiveTransform(quad, dst)
    warped = cv2.warpPerspective(bgr_image, matrix, (dst_w, dst_h))

    # 縦長で検出された場合は横向きに回転して統一する
    if width < height:
        warped = cv2.rotate(warped, cv2.ROTATE_90_CLOCKWISE)

    return warped


def detect_and_warp(bgr_image: np.ndarray):
    """
    画像からカードを検出し、台形補正済み画像を返す。
    検出できなかった場合は None を返す。
    """
    quad = find_card_contour(bgr_image)
    if quad is None:
        return None
    return warp_card(bgr_image, quad)