/**
 * lib/scanStudentId.ts
 * =================================================
 * ラズパイ上のFlask OCRサーバー(/scan)を呼び出し、
 * 学籍番号の読み取り結果を取得するモジュール。
 *
 * 配置場所: src/lib/scanStudentId.ts
 *
 * 【使い方】
 *   import { scanStudentId } from '@/lib/scanStudentId';
 *   const result = await scanStudentId();
 * =================================================
 */

type RuntimeEnv = {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

const runtimeEnv = (globalThis as typeof globalThis & RuntimeEnv).process?.env;
const RASPI_BASE_URL = runtimeEnv?.NEXT_PUBLIC_RASPI_BASE_URL || 'http://192.168.3.248:5000'; // 自宅のプライベートIPアドレス

// カメラ撮影+OCR処理に時間がかかるため、タイムアウトは長めに設定
const DEFAULT_TIMEOUT_MS = 15000;

export interface ScanResult {
  success: boolean;
  studentId: string | null;
  rawText: string;
  error?: string;
}

interface ScanOptions {
  timeoutMs?: number;
}

/**
 * ラズパイに撮影・OCR実行を依頼し、学籍番号を取得する。
 * この関数を呼ぶだけで読み取り結果が得られる。
 */
export async function scanStudentId(
  options: ScanOptions = {}
): Promise<ScanResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = `${RASPI_BASE_URL}/scan`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });

    const data = await res.json();

    // 422 は「サーバーは正常応答したがOCRで番号を認識できなかった」状態
    if (!res.ok && res.status !== 422) {
      return {
        success: false,
        studentId: null,
        rawText: data.rawText ?? '',
        error:
          data.error ??
          `ラズパイ側でHTTPエラーが発生しました (status: ${res.status})`,
      };
    }

    return {
      success: !!data.success,
      studentId: data.studentId ?? null,
      rawText: data.rawText ?? '',
      error: data.success
        ? undefined
        : 'OCRで学籍番号を認識できませんでした。学生証の向き・位置を確認してください。',
    };
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      studentId: null,
      rawText: '',
      error: isTimeout
        ? 'ラズパイへの接続がタイムアウトしました。WiFi接続・ラズパイの起動状態を確認してください。'
        : `通信エラー: ${message}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * ラズパイサーバーとの接続確認用（受付画面起動時のチェックなどに利用）
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const res = await fetch(`${RASPI_BASE_URL}/health`, {
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ラズパイの映像ストリーム用URLの組み立て
export const RASPI_VIDEO_URL = `${RASPI_BASE_URL}/stream`;