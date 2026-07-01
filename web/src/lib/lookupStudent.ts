/**
 * lib/lookupStudent.ts
 * =================================================
 * 配置場所: src/lib/lookupStudent.ts
 *
 * 学籍番号(student_id)に紐づくデータが users_cache に
 * 既に存在するかどうかを調べるためのモジュール。
 *
 * checkin/route.ts が upsert している users_cache を
 * そのまま参照先として使う。
 * =================================================
 */

import { supabase } from '@/lib/supabase';
import { isUseMock, mockCache } from '@/lib/mockDb';

export interface StudentCacheRecord {
  student_id: string;
  name: string;
  department: string;
  grade: string;
  class_name: string;
  is_staff: boolean;
}

/**
 * student_id に紐づくキャッシュデータを取得する。
 * 見つからない場合は null を返す（エラーではない）。
 */
export async function lookupStudent(
  studentId: string
): Promise<StudentCacheRecord | null> {
  if (isUseMock()) {
    const found = mockCache.find((c) => c.student_id === studentId);
    return found
      ? {
          student_id: found.student_id,
          name: found.name,
          department: found.department,
          grade: found.grade,
          class_name: found.class_name,
          is_staff: found.is_staff,
        }
      : null;
  }

  const { data, error } = await supabase
    .from('users_cache')
    .select('student_id, name, department, grade, class_name, is_staff')
    .eq('student_id', studentId)
    .maybeSingle();

  if (error) {
    console.error('Database error in lookupStudent:', error);
    throw error;
  }

  return data ?? null;
}