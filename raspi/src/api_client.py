# -*- coding: utf-8 -*-
"""
api_client.py
=================================================
読み取った学籍番号をNext.js側のAPIエンドポイントへHTTP POSTする。
=================================================
"""

import logging
import time
from datetime import datetime, timezone, timedelta

import requests

import config

logger = logging.getLogger("api_client")

JST = timezone(timedelta(hours=9))


def send_scan_result(student_id: str):
    """
    学籍番号をAPIへ送信する。
    戻り値: (success: bool, detail: str)
    タイムアウト・失敗時は config.API_MAX_RETRIES 回までリトライする。
    """
    payload = {
        "studentId": student_id,
        "scannedAt": datetime.now(JST).isoformat(),
    }
    headers = {
        "Content-Type": "application/json",
        config.API_SECRET_HEADER: config.API_SECRET_KEY,
    }

    last_error = None
    for attempt in range(1, config.API_MAX_RETRIES + 1):
        try:
            resp = requests.post(
                config.NEXTJS_API_URL,
                json=payload,
                headers=headers,
                timeout=config.API_TIMEOUT_SEC,
            )
            if 200 <= resp.status_code < 300:
                logger.info("API送信成功: studentId=%s (試行%d回目)", student_id, attempt)
                return True, f"HTTP {resp.status_code}"

            last_error = f"HTTP {resp.status_code}: {resp.text[:200]}"
            logger.warning(
                "API送信失敗(試行%d/%d): %s", attempt, config.API_MAX_RETRIES, last_error
            )

        except requests.exceptions.RequestException as e:
            last_error = str(e)
            logger.warning(
                "API送信エラー(試行%d/%d): %s", attempt, config.API_MAX_RETRIES, last_error
            )

        if attempt < config.API_MAX_RETRIES:
            time.sleep(config.API_RETRY_BACKOFF_SEC * attempt)

    logger.error("API送信を%d回試行しましたが失敗しました: %s", config.API_MAX_RETRIES, last_error)
    return False, last_error