import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isUseMock, mockCache } from '@/lib/mockDb';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const studentId = (searchParams.get('student_id') ?? searchParams.get('user_code') ?? '').trim().toUpperCase();

  if (!studentId) {
    return NextResponse.json({ error: 'student_id is required' }, { status: 400 });
  }

  if (isUseMock()) {
    const cached = mockCache.find(
      (c) => c.student_id === studentId && !c.deleted_at
    );
    if (cached) return NextResponse.json({ found: true, data: cached });
    return NextResponse.json({ found: false });
  }

  try {
    const { data, error } = await supabase
      .from('users_cache')
      .select('name, department, grade, class_name, is_staff, user_type, total_usage_minutes, monthly_usage_minutes, consecutive_days, last_used_date')
      .eq('student_id', studentId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return NextResponse.json({ found: false });
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
