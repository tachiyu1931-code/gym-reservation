import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isUseMock, mockCache } from '@/lib/mockDb';

/**
 * GET /api/cache?student_id=XXXXX
 * 学籍番号でキャッシュを検索する。論理削除済みレコードは除外。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('student_id');

  if (!studentId) {
    return NextResponse.json({ error: 'student_id is required' }, { status: 400 });
  }

  // デモ用のモックモード
  if (isUseMock()) {
    const cached = mockCache.find(
      (c) => c.student_id === studentId && !c.deleted_at
    );
    if (cached) {
      return NextResponse.json({ found: true, data: cached });
    }
    return NextResponse.json({ found: false });
  }

  try {
    const { data, error } = await supabase
      .from('users_cache')
      .select('name, department, grade, class_name, is_staff')
      .eq('student_id', studentId)
      .is('deleted_at', null)   // 論理削除済みを除外
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // レコードが見つからない場合（正常系）
        return NextResponse.json({ found: false });
      }
      throw error;
    }

    return NextResponse.json({ found: true, data });
  } catch (error: unknown) {
    console.error('Database error in /api/cache:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
