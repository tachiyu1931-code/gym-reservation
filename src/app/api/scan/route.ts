/**
 * app/api/scan/route.ts
 * =================================================
 * 配置場所: src/app/api/scan/route.ts
 *
 * ラズパイにOCR読み取りを依頼し、結果(student_id)をそのまま返す。
 * 「番号に紐づくデータの有無」の判定は、既存の /api/checkout と
 * /api/cache（フロント側の lookupCache 関数）が担うため、
 * ここでは重複させずOCR結果の取得のみを行う。
 * =================================================
 */

import { NextResponse } from 'next/server';
import { scanStudentId } from '@/lib/scanStudentId';

export async function POST() {
  const result = await scanStudentId();
  return NextResponse.json(result);
}

// ブラウザから直接動作確認したい場合用（任意）
export async function GET() {
  const result = await scanStudentId();
  return NextResponse.json(result);
}