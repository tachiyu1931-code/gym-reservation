import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isUseMock, mockLogs, mockCache } from '@/lib/mockDb';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { student_id, name, department, grade, class_name, checked_in_at } = body;

    // バリデーション
    if (!student_id || !name || !department || !grade || !class_name || !checked_in_at) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // デモ用のモックモード判定
    if (isUseMock()) {
      // 1. 利用ログをメモリに追加
      const newId = mockLogs.length > 0 ? Math.max(...mockLogs.map(l => l.id)) + 1 : 1;
      mockLogs.unshift({
        id: newId,
        student_id,
        name,
        department,
        grade,
        class_name,
        checked_in_at,
        created_at: new Date().toISOString()
      });

      // 2. 学生キャッシュの UPSERT
      const cacheIndex = mockCache.findIndex(c => c.student_id === student_id);
      const cacheData = {
        student_id,
        name,
        department,
        grade,
        class_name,
        created_at: cacheIndex >= 0 ? mockCache[cacheIndex].created_at : new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (cacheIndex >= 0) {
        mockCache[cacheIndex] = cacheData;
      } else {
        mockCache.push(cacheData);
      }

      return NextResponse.json({ success: true });
    }

    // 1. 利用ログ (usage_logs) に登録
    const { error: logError } = await supabase.from('usage_logs').insert({
      student_id,
      name,
      department,
      grade,
      class_name,
      checked_in_at,
    });

    if (logError) throw logError;

    // 2. 学生キャッシュ (users_cache) を UPSERT
    const { error: cacheError } = await supabase.from('users_cache').upsert(
      {
        student_id,
        name,
        department,
        grade,
        class_name,
      },
      {
        onConflict: 'student_id',
      }
    );

    if (cacheError) throw cacheError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Database error in /api/checkin:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
