import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isUseMock, mockLogs, mockCache } from '@/lib/mockDb';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { student_id, name, department, grade, class_name, is_staff, checked_in_at } = body;
    const user_type: 'student' | 'staff' = is_staff ? 'staff' : 'student';

    // バリデーション
    if (!student_id || !name || !department || !grade || !class_name || typeof is_staff !== 'boolean' || !checked_in_at) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (isUseMock()) {
      const newId = mockLogs.length > 0 ? Math.max(...mockLogs.map(l => l.id)) + 1 : 1;
      mockLogs.unshift({
        id: newId,
        student_id,
        name,
        department,
        grade,
        class_name,
        is_staff,
        user_type,
        checked_in_at,
        auto_checked_out: false,
        created_at: new Date().toISOString(),
        deleted_at: null
      });

      const cacheIndex = mockCache.findIndex(c => c.student_id === student_id);
      const cacheData = {
        student_id,
        name,
        department,
        grade,
        class_name,
        is_staff,
        user_type,
        created_at: cacheIndex >= 0 ? mockCache[cacheIndex].created_at : new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null
      };

      if (cacheIndex >= 0) {
        mockCache[cacheIndex] = cacheData;
      } else {
        mockCache.push(cacheData);
      }

      return NextResponse.json({ success: true });
    }

    const { error: logError } = await supabase.from('usage_logs').insert({
      student_id,
      name,
      department,
      grade,
      class_name,
      is_staff,
      user_type,
      checked_in_at,
    });

    if (logError) throw logError;

    const { error: cacheError } = await supabase.from('users_cache').upsert(
      {
        student_id,
        name,
        department,
        grade,
        class_name,
        is_staff,
        user_type,
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