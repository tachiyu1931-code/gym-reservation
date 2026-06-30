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

type EffectiveUser = {
  student_id: string;
  name: string;
  department: string;
  grade: string;
  class_name: string;
  is_staff: boolean;
  user_type: 'student' | 'staff';
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
      const activeLog = mockLogs.find(
        (log) => log.student_id === student_id && !log.checked_out_at && !log.deleted_at
      );
      if (activeLog) {
        return NextResponse.json({ success: true, status: 'active', log: activeLog });
      }

      const cacheIndex = mockCache.findIndex(c => c.student_id === student_id && !c.deleted_at);
      const existingCache = cacheIndex >= 0 ? mockCache[cacheIndex] : null;
      const effectiveUser: EffectiveUser = existingCache
        ? {
            student_id,
            name: existingCache.name,
            department: existingCache.department,
            grade: existingCache.grade,
            class_name: existingCache.class_name,
            is_staff: existingCache.is_staff,
            user_type: existingCache.user_type,
          }
        : { student_id, name, department, grade, class_name, is_staff, user_type: role };

      const newId = mockLogs.length > 0 ? Math.max(...mockLogs.map(l => l.id)) + 1 : 1;
      mockLogs.unshift({
        id: newId,
        ...effectiveUser,
        checked_in_at,
        checked_out_at: null,
        auto_checked_out: false,
        usage_duration_minutes: null,
        admin_confirmed: false,
        created_at: new Date().toISOString(),
        deleted_at: null,
      });

      if (!existingCache) {
        mockCache.push({
          ...effectiveUser,
          total_usage_minutes: 0,
          monthly_usage_minutes: 0,
          consecutive_days: 0,
          last_used_date: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        });
      }

      return NextResponse.json({ success: true, status: 'checked_in', log_id: newId, data: effectiveUser });
    }

    const { data: activeLog, error: activeError } = await supabase
      .from('usage_logs')
      .select('*')
      .eq('student_id', student_id)
      .is('checked_out_at', null)
      .is('deleted_at', null)
      .order('checked_in_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeError) throw activeError;
    if (activeLog) {
      return NextResponse.json({ success: true, status: 'active', log: activeLog });
    }

    const { data: cachedUser, error: cacheSelectError } = await supabase
      .from('users_cache')
      .select('student_id, name, department, grade, class_name, is_staff, user_type')
      .eq('student_id', student_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (cacheSelectError) throw cacheSelectError;

    const effectiveUser: EffectiveUser = cachedUser
      ? {
          student_id,
          name: cachedUser.name,
          department: cachedUser.department,
          grade: cachedUser.grade,
          class_name: cachedUser.class_name,
          is_staff: cachedUser.is_staff,
          user_type: cachedUser.user_type ?? (cachedUser.is_staff ? 'staff' : 'student'),
        }
      : { student_id, name, department, grade, class_name, is_staff, user_type: role };

    const { data: logData, error: logError } = await supabase
      .from('usage_logs')
      .insert({
        ...effectiveUser,
        checked_in_at,
      })
      .select('id')
      .single();

    if (logError) throw logError;

    if (!cachedUser) {
      const { error: cacheError } = await supabase.from('users_cache').upsert(
        {
          ...effectiveUser,
          deleted_at: null,
        },
        { onConflict: 'student_id' }
      );

      if (cacheError) throw cacheError;
    }

    return NextResponse.json({ success: true, status: 'checked_in', log_id: logData?.id, data: effectiveUser });
  } catch (error: unknown) {
    console.error('Database error in /api/checkin:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
