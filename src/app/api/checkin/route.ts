import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isUseMock, mockLogs, mockCache } from '@/lib/mockDb';

type CheckInPayload = {
  student_id?: string;
  user_code?: string;
  name?: string;
  department?: string;
  grade?: string;
  class_name?: string;
  is_staff?: boolean;
  role?: 'student' | 'staff';
  checked_in_at?: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as CheckInPayload;
    const student_id = (body.user_code ?? body.student_id ?? '').trim().toUpperCase();
    const role: 'student' | 'staff' = body.role ?? (body.is_staff ? 'staff' : 'student');
    const is_staff = role === 'staff';
    const name = (body.name ?? '').trim();
    const department = is_staff ? '教職員' : (body.department ?? '').trim();
    const grade = is_staff ? '教職員' : (body.grade ?? '').trim();
    const class_name = is_staff ? '教職員' : (body.class_name ?? '').trim();
    const checked_in_at = body.checked_in_at ?? new Date().toISOString();

    if (!student_id || !name || !checked_in_at || (!is_staff && (!department || !grade || !class_name))) {
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
        user_type: role,
        checked_in_at,
        checked_out_at: null,
        auto_checked_out: false,
        usage_duration_minutes: null,
        admin_confirmed: false,
        created_at: new Date().toISOString(),
        deleted_at: null,
      });

      const cacheIndex = mockCache.findIndex(c => c.student_id === student_id);
      const cacheData = {
        student_id,
        name,
        department,
        grade,
        class_name,
        is_staff,
        user_type: role,
        total_usage_minutes: cacheIndex >= 0 ? mockCache[cacheIndex].total_usage_minutes : 0,
        monthly_usage_minutes: cacheIndex >= 0 ? mockCache[cacheIndex].monthly_usage_minutes : 0,
        consecutive_days: cacheIndex >= 0 ? mockCache[cacheIndex].consecutive_days : 0,
        last_used_date: cacheIndex >= 0 ? mockCache[cacheIndex].last_used_date : null,
        created_at: cacheIndex >= 0 ? mockCache[cacheIndex].created_at : new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      if (cacheIndex >= 0) mockCache[cacheIndex] = cacheData;
      else mockCache.push(cacheData);

      return NextResponse.json({ success: true, log_id: newId });
    }

    const { data: logData, error: logError } = await supabase
      .from('usage_logs')
      .insert({
        student_id,
        name,
        department,
        grade,
        class_name,
        is_staff,
        user_type: role,
        checked_in_at,
      })
      .select('id')
      .single();

    if (logError) throw logError;

    const { error: cacheError } = await supabase.from('users_cache').upsert(
      {
        student_id,
        name,
        department,
        grade,
        class_name,
        is_staff,
        user_type: role,
        deleted_at: null,
      },
      { onConflict: 'student_id' }
    );

    if (cacheError) throw cacheError;

    return NextResponse.json({ success: true, log_id: logData?.id });
  } catch (error: unknown) {
    console.error('Database error in /api/checkin:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
