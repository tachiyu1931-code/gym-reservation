import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isUseMock, mockLogs } from '@/lib/mockDb';
import { addUsageStats, calculateUsageMinutes } from '@/lib/usageStats';
import { getIdFormatHint, isValidStudentOrStaffId, normalizeIdInput } from '@/lib/idFormat';
import { runAutoCheckout } from '@/lib/autoCheckout';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const student_id = normalizeIdInput(searchParams.get('student_id') ?? searchParams.get('user_code') ?? '');
  const lang = (searchParams.get('lang') as 'ja' | 'en' | null) ?? 'ja';

  if (!student_id) {
    return NextResponse.json({ error: 'student_id is required' }, { status: 400 });
  }

  if (!isValidStudentOrStaffId(student_id)) {
    return NextResponse.json({ error: getIdFormatHint(lang) }, { status: 400 });
  }

  try {
    await runAutoCheckout();
  } catch (err) {
    console.error('Auto-checkout background error:', err);
  }

  if (isUseMock()) {
    const activeLog = mockLogs.find(
      l => l.student_id === student_id && !l.checked_out_at && !l.deleted_at
    );
    if (activeLog) {
      return NextResponse.json({ found: true, log: activeLog, adjusted_log: null });
    }

    const adjustedLog = mockLogs.find(
      l => l.student_id === student_id && l.is_adjusted && !l.is_notified && !l.deleted_at
    );
    return NextResponse.json({ found: false, log: null, adjusted_log: adjustedLog || null });
  }

  try {
    const { data, error } = await supabase
      .from('usage_logs')
      .select('*')
      .eq('student_id', student_id)
      .is('checked_out_at', null)
      .is('deleted_at', null)
      .order('checked_in_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (data) {
      return NextResponse.json({ found: true, log: data, adjusted_log: null });
    }

    const { data: adjustedLogs, error: adjustedError } = await supabase
      .from('usage_logs')
      .select('id, student_id, name, department, grade, class_name, is_staff, checked_in_at, checked_out_at')
      .eq('student_id', student_id)
      .eq('is_adjusted', true)
      .eq('is_notified', false)
      .is('deleted_at', null)
      .order('checked_in_at', { ascending: false })
      .limit(1);

    if (adjustedError) {
      console.error('Failed to load adjusted checkout notice:', adjustedError);
      return NextResponse.json({ found: false, log: null, adjusted_log: null });
    }

    return NextResponse.json({ found: false, log: null, adjusted_log: adjustedLogs?.[0] ?? null });
  } catch (error: unknown) {
    console.error('Database error in /api/checkout:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { log_id, is_notified } = await request.json() as { log_id?: number; is_notified?: boolean };

    if (!log_id || typeof is_notified !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (isUseMock()) {
      const index = mockLogs.findIndex(l => l.id === log_id);
      if (index === -1) return NextResponse.json({ error: 'Log not found' }, { status: 404 });
      mockLogs[index].is_notified = is_notified;
      return NextResponse.json({ success: true });
    }

    const { error } = await supabase
      .from('usage_logs')
      .update({ is_notified })
      .eq('id', log_id)
      .is('deleted_at', null);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Database error in /api/checkout PATCH:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { log_id, checked_out_at } = await request.json() as { log_id?: number; checked_out_at?: string };

    if (!log_id || !checked_out_at) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (isUseMock()) {
      const index = mockLogs.findIndex(l => l.id === log_id);
      if (index === -1) return NextResponse.json({ error: 'Log not found' }, { status: 404 });

      const minutes = calculateUsageMinutes(mockLogs[index].checked_in_at, checked_out_at);
      mockLogs[index].checked_out_at = checked_out_at;
      mockLogs[index].usage_duration_minutes = minutes;
      const stats = await addUsageStats(mockLogs[index].student_id, minutes, new Date(checked_out_at));
      return NextResponse.json({ success: true, usage_duration_minutes: minutes, stats });
    }

    const { data: targetLog, error: selectError } = await supabase
      .from('usage_logs')
      .select('id, student_id, name, department, grade, checked_in_at')
      .eq('id', log_id)
      .is('checked_out_at', null)
      .is('deleted_at', null)
      .single();

    if (selectError) throw selectError;

    const minutes = calculateUsageMinutes(targetLog.checked_in_at, checked_out_at);
    const { error } = await supabase
      .from('usage_logs')
      .update({ checked_out_at, usage_duration_minutes: minutes })
      .eq('id', log_id)
      .is('checked_out_at', null)
      .is('deleted_at', null);

    if (error) throw error;

    const stats = await addUsageStats(targetLog.student_id, minutes, new Date(checked_out_at));
    return NextResponse.json({ success: true, usage_duration_minutes: minutes, stats });
  } catch (error: unknown) {
    console.error('Database error in /api/checkout:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
