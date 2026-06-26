import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isUseMock, mockLogs } from '@/lib/mockDb';
import { addUsageStats, calculateUsageMinutes } from '@/lib/usageStats';

const AUTO_CHECKOUT_HOURS = 15;

async function runAutoCheckout() {
  if (isUseMock()) {
    const now = Date.now();
    for (const log of mockLogs) {
      if (!log.checked_out_at && (now - new Date(log.checked_in_at).getTime()) > AUTO_CHECKOUT_HOURS * 3600000) {
        const checkedOutAt = new Date(new Date(log.checked_in_at).getTime() + AUTO_CHECKOUT_HOURS * 3600000).toISOString();
        const minutes = calculateUsageMinutes(log.checked_in_at, checkedOutAt);
        log.checked_out_at = checkedOutAt;
        log.auto_checked_out = true;
        log.usage_duration_minutes = minutes;
        log.admin_confirmed = false;
        addUsageStats(log.student_id, minutes, new Date(checkedOutAt));
      }
    }
    return;
  }

  const autoCheckoutTime = new Date(Date.now() - AUTO_CHECKOUT_HOURS * 3600000).toISOString();
  const { data: oldLogs, error: selectError } = await supabase
    .from('usage_logs')
    .select('id, student_id, checked_in_at')
    .is('checked_out_at', null)
    .is('deleted_at', null)
    .lt('checked_in_at', autoCheckoutTime);

  if (selectError) throw selectError;

  for (const log of oldLogs ?? []) {
    const checkedOutAt = new Date(new Date(log.checked_in_at).getTime() + AUTO_CHECKOUT_HOURS * 3600000).toISOString();
    const minutes = calculateUsageMinutes(log.checked_in_at, checkedOutAt);
    const { error: updateError } = await supabase
      .from('usage_logs')
      .update({
        checked_out_at: checkedOutAt,
        usage_duration_minutes: minutes,
        auto_checked_out: true,
        admin_confirmed: false,
      })
      .eq('id', log.id)
      .is('checked_out_at', null);

    if (!updateError) {
      await addUsageStats(log.student_id, minutes, new Date(checkedOutAt));
    }
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const student_id = (searchParams.get('student_id') ?? searchParams.get('user_code') ?? '').trim().toUpperCase();

  if (!student_id) {
    return NextResponse.json({ error: 'student_id is required' }, { status: 400 });
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
    return NextResponse.json({ found: !!activeLog, log: activeLog || null });
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

    return NextResponse.json({ found: !!data, log: data || null });
  } catch (error: unknown) {
    console.error('Database error in /api/checkout:', error);
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
      .select('id, student_id, checked_in_at')
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
