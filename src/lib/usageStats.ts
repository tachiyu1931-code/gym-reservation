import { supabase } from '@/lib/supabase';
import { isUseMock, mockCache, type UserCache } from '@/lib/mockDb';

export type UsageStats = {
  total_usage_minutes: number;
  monthly_usage_minutes: number;
  consecutive_days: number;
  last_used_date: string | null;
};

const emptyStats: UsageStats = {
  total_usage_minutes: 0,
  monthly_usage_minutes: 0,
  consecutive_days: 0,
  last_used_date: null,
};

function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function isSameMonth(a: Date, b: Date) {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

function daysBetween(previousDateKey: string, currentDateKey: string) {
  const previous = new Date(`${previousDateKey}T00:00:00.000Z`).getTime();
  const current = new Date(`${currentDateKey}T00:00:00.000Z`).getTime();
  return Math.round((current - previous) / 86400000);
}

export function calculateUsageMinutes(checkedInAt: string, checkedOutAt: string) {
  const started = new Date(checkedInAt).getTime();
  const ended = new Date(checkedOutAt).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended <= started) return 0;
  return Math.max(1, Math.round((ended - started) / 60000));
}

export function buildUpdatedStats(current: Partial<UsageStats>, addMinutes: number, usedAt: Date): UsageStats {
  const currentDateKey = toDateKey(usedAt);
  const previousDateKey = current.last_used_date;
  const previousDate = previousDateKey ? new Date(`${previousDateKey}T00:00:00.000Z`) : null;

  let consecutiveDays = current.consecutive_days ?? 0;
  if (!previousDateKey) {
    consecutiveDays = 1;
  } else {
    const gap = daysBetween(previousDateKey, currentDateKey);
    if (gap === 1) consecutiveDays += 1;
    if (gap > 1) consecutiveDays = 1;
  }

  const monthlyBase = previousDate && isSameMonth(previousDate, usedAt)
    ? current.monthly_usage_minutes ?? 0
    : 0;

  return {
    total_usage_minutes: (current.total_usage_minutes ?? 0) + addMinutes,
    monthly_usage_minutes: monthlyBase + addMinutes,
    consecutive_days: consecutiveDays,
    last_used_date: currentDateKey,
  };
}

export function getMockUserStats(studentId: string): UsageStats {
  const cached = mockCache.find((cache) => cache.student_id === studentId && !cache.deleted_at);
  if (!cached) return emptyStats;

  return {
    total_usage_minutes: cached.total_usage_minutes ?? 0,
    monthly_usage_minutes: cached.monthly_usage_minutes ?? 0,
    consecutive_days: cached.consecutive_days ?? 0,
    last_used_date: cached.last_used_date ?? null,
  };
}

export function applyMockUsageStats(studentId: string, addMinutes: number, usedAt: Date): UsageStats {
  const cached = mockCache.find((cache) => cache.student_id === studentId && !cache.deleted_at);
  if (!cached) return emptyStats;

  const next = buildUpdatedStats(cached, addMinutes, usedAt);
  Object.assign(cached, next, { updated_at: new Date().toISOString() } satisfies Partial<UserCache>);
  return next;
}

export async function fetchUserStats(studentId: string): Promise<UsageStats> {
  if (isUseMock()) return getMockUserStats(studentId);

  const { data, error } = await supabase
    .from('users_cache')
    .select('total_usage_minutes, monthly_usage_minutes, consecutive_days, last_used_date')
    .eq('student_id', studentId)
    .is('deleted_at', null)
    .single();

  if (error) return emptyStats;

  return {
    total_usage_minutes: data?.total_usage_minutes ?? 0,
    monthly_usage_minutes: data?.monthly_usage_minutes ?? 0,
    consecutive_days: data?.consecutive_days ?? 0,
    last_used_date: data?.last_used_date ?? null,
  };
}

export async function addUsageStats(studentId: string, addMinutes: number, usedAt: Date): Promise<UsageStats> {
  if (isUseMock()) return applyMockUsageStats(studentId, addMinutes, usedAt);

  const current = await fetchUserStats(studentId);
  const next = buildUpdatedStats(current, addMinutes, usedAt);

  const { error } = await supabase
    .from('users_cache')
    .update(next)
    .eq('student_id', studentId);

  if (error) throw error;
  return next;
}
