import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isUseMock, mockLogs, mockNotifications } from '@/lib/mockDb';
import { addUsageStats, calculateUsageMinutes } from '@/lib/usageStats';
import { getIdFormatHint, isValidStudentOrStaffId, normalizeIdInput } from '@/lib/idFormat';

const AUTO_CHECKOUT_HOURS = 15;
const AUTO_ADJUSTED_MINUTES = 30;

type AutoCheckoutNotificationLog = {
  id: number;
  student_id: string;
  name: string;
  department: string;
  grade: string;
};

function buildAutoCheckoutMessage(log: AutoCheckoutNotificationLog) {
  return `${log.student_id} ${log.name} さんが15時間経過により自動退室になりました。`;
}

function addMockAutoCheckoutNotification(log: AutoCheckoutNotificationLog) {
  const exists = mockNotifications.some(
    (notification) => notification.type === 'auto_checkout' && notification.usage_log_id === log.id
  );
  if (exists) return;

  const newId = mockNotifications.length > 0 ? Math.max(...mockNotifications.map((n) => n.id)) + 1 : 1;
  mockNotifications.unshift({
    id: newId,
    type: 'auto_checkout',
    usage_log_id: log.id,
    student_number: log.student_id,
    department: log.department,
    grade: log.grade,
    name: log.name,
    message: buildAutoCheckoutMessage(log),
    is_read: false,
    is_acknowledged: false,
    created_at: new Date().toISOString(),
    read_at: null,
  });
}

async function createAutoCheckoutNotification(log: AutoCheckoutNotificationLog) {
  const { data: existing, error: selectError } = await supabase
    .from('notifications')
    .select('id')
    .eq('type', 'auto_checkout')
    .eq('usage_log_id', log.id)
    .maybeSingle();

  if (selectError) {
    console.error('Failed to check auto-checkout notification:', selectError);
    return;
  }

  if (existing) return;

  const { error } = await supabase.from('notifications').insert({
    type: 'auto_checkout',
    usage_log_id: log.id,
    student_number: log.student_id,
    department: log.department,
    grade: log.grade,
    name: log.name,
    message: buildAutoCheckoutMessage(log),
    is_read: false,
    is_acknowledged: false,
    read_at: null,
  });

  if (error) {
    console.error('Failed to create auto-checkout notification:', error);
  }
}

async function runAutoCheckout() {
  if (isUseMock()) {
    const now = Date.now();
    for (const log of mockLogs) {
      if (!log.checked_out_at && (now - new Date(log.checked_in_at).getTime()) > AUTO_CHECKOUT_HOURS * 3600000) {
        const checkedOutAt = new Date(new Date(log.checked_in_at).getTime() + AUTO_CHECKOUT_HOURS * 3600000).toISOString();
        const minutes = calculateUsageMinutes(log.checked_in_at, checkedOutAt);
        log.checked_out_at = checkedOutAt;
        log.auto_checked_out = true;
        log.usage_duration_minutes = AUTO_ADJUSTED_MINUTES;
        log.is_adjusted = true;
        log.is_notified = false;
        log.admin_confirmed = false;
        addMockAutoCheckoutNotification(log);
        addUsageStats(log.student_id, minutes, new Date(checkedOutAt));
      }
    }
    return;
  }

  const autoCheckoutTime = new Date(Date.now() - AUTO_CHECKOUT_HOURS * 3600000).toISOString();
  const { data: oldLogs, error: selectError } = await supabase
    .from('usage_logs')
    .select('id, student_id, name, department, grade, checked_in_at')
    .is('checked_out_at', null)
    .is('deleted_at', null)
    .lt('checked_in_at', autoCheckoutTime);

  if (selectError) throw selectError;

  for (const log of oldLogs ?? []) {
    const checkedOutAt = new Date(new Date(log.checked_in_at).getTime() + AUTO_CHECKOUT_HOURS * 3600000).toISOString();
    const { error: updateError } = await supabase
      .from('usage_logs')
      .update({
        checked_out_at: checkedOutAt,
        usage_duration_minutes: AUTO_ADJUSTED_MINUTES,
        auto_checked_out: true,
        is_adjusted: true,
        is_notified: false,
        admin_confirmed: false,
      })
      .eq('id', log.id)
      .is('checked_out_at', null)
      .select('id')
      .single();

    if (!updateError) {
      await createAutoCheckoutNotification(log);
      await addUsageStats(log.student_id, AUTO_ADJUSTED_MINUTES, new Date(checkedOutAt));
    }
  }
}

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
