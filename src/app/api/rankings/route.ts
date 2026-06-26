import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isUseMock, mockCache } from '@/lib/mockDb';

type RankingUser = {
  student_id: string;
  name: string;
  department: string;
  grade: string;
  class_name: string;
  monthly_usage_minutes: number;
  consecutive_days: number;
};

function publicUser(user: RankingUser, index: number) {
  return {
    rank: index + 1,
    user_code_suffix: user.student_id.slice(-4),
    name: user.name,
    department: user.department,
    grade: user.grade,
    class_name: user.class_name,
    monthly_usage_minutes: user.monthly_usage_minutes ?? 0,
    consecutive_days: user.consecutive_days ?? 0,
  };
}

export async function GET() {
  try {
    if (isUseMock()) {
      const activeUsers = mockCache.filter((user) => !user.deleted_at);
      return NextResponse.json({
        monthly: [...activeUsers]
          .sort((a, b) => (b.monthly_usage_minutes ?? 0) - (a.monthly_usage_minutes ?? 0))
          .slice(0, 10)
          .map(publicUser),
        streaks: [...activeUsers]
          .sort((a, b) => (b.consecutive_days ?? 0) - (a.consecutive_days ?? 0))
          .slice(0, 10)
          .map(publicUser),
      });
    }

    const selectColumns = 'student_id, name, department, grade, class_name, monthly_usage_minutes, consecutive_days';
    const [monthlyResult, streakResult] = await Promise.all([
      supabase
        .from('users_cache')
        .select(selectColumns)
        .is('deleted_at', null)
        .order('monthly_usage_minutes', { ascending: false })
        .limit(10),
      supabase
        .from('users_cache')
        .select(selectColumns)
        .is('deleted_at', null)
        .order('consecutive_days', { ascending: false })
        .limit(10),
    ]);

    if (monthlyResult.error) throw monthlyResult.error;
    if (streakResult.error) throw streakResult.error;

    return NextResponse.json({
      monthly: (monthlyResult.data ?? []).map(publicUser),
      streaks: (streakResult.data ?? []).map(publicUser),
    });
  } catch (error: unknown) {
    console.error('Database error in /api/rankings:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
