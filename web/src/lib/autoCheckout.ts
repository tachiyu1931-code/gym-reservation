import { supabase } from '@/lib/supabase';
import { isUseMock, mockLogs, mockNotifications } from '@/lib/mockDb';
import { addUsageStats } from '@/lib/usageStats';

const AUTO_CHECKOUT_HOURS = 15;
const AUTO_ADJUSTED_MINUTES = 30;

export type AutoCheckoutNotificationLog = {
  id: number;
  student_id: string;
  name: string;
  department: string;
  grade: string;
};

export function buildAutoCheckoutMessage(log: AutoCheckoutNotificationLog) {
  return `${log.student_id} ${log.name} さんは15時間経過により自動退室になりました。`;
}

export function addMockAutoCheckoutNotification(log: AutoCheckoutNotificationLog) {
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

export async function createAutoCheckoutNotification(log: AutoCheckoutNotificationLog) {
  const { data: existing, error: selectError } = await supabase
    .from('notifications')
    .select('id')
    .eq('type', 'auto_checkout')
    .eq('usage_log_id', log.id)
    .maybeSingle();

  if (selectError) throw selectError;
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

  if (error) throw error;
}

export async function runAutoCheckout() {
  if (isUseMock()) {
    const now = Date.now();
    for (const log of mockLogs) {
      if (!log.checked_out_at && (now - new Date(log.checked_in_at).getTime()) > AUTO_CHECKOUT_HOURS * 3600000) {
        const checkedOutAt = new Date(new Date(log.checked_in_at).getTime() + AUTO_CHECKOUT_HOURS * 3600000).toISOString();
        log.checked_out_at = checkedOutAt;
        log.auto_checked_out = true;
        log.usage_duration_minutes = AUTO_ADJUSTED_MINUTES;
        log.is_adjusted = true;
        log.is_notified = false;
        log.admin_confirmed = false;
        addMockAutoCheckoutNotification(log);
        await addUsageStats(log.student_id, AUTO_ADJUSTED_MINUTES, new Date(checkedOutAt));
      }

      if (log.auto_checked_out && !log.deleted_at) {
        addMockAutoCheckoutNotification(log);
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

  const { data: autoCheckedOutLogs, error: selectAutoError } = await supabase
    .from('usage_logs')
    .select('id, student_id, name, department, grade')
    .eq('auto_checked_out', true)
    .is('deleted_at', null)
    .order('checked_in_at', { ascending: false })
    .limit(100);

  if (selectAutoError) throw selectAutoError;

  for (const log of autoCheckedOutLogs ?? []) {
    await createAutoCheckoutNotification(log);
  }
}
