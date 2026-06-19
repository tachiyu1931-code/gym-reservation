'use server';

import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { isUseMock, mockLogs, mockCache } from '@/lib/mockDb';

// 利用ログの全件取得
export async function getUsageLogs() {
  if (isUseMock()) {
    console.log('[Demo Mode] Fetching mock usage logs');
    return mockLogs;
  }

  const { data, error } = await supabase
    .from('usage_logs')
    .select('*')
    .order('checked_in_at', { ascending: false });

  if (error) {
    console.error('getUsageLogs error:', error);
    throw error;
  }
  return data || [];
}

// 利用ログ of 削除
export async function deleteUsageLog(id: number) {
  if (isUseMock()) {
    console.log('[Demo Mode] Deleting mock usage log:', id);
    const index = mockLogs.findIndex(log => log.id === id);
    if (index >= 0) {
      mockLogs.splice(index, 1);
    }
    return { success: true };
  }

  const { error } = await supabase
    .from('usage_logs')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('deleteUsageLog error:', error);
    throw error;
  }
  revalidatePath('/admin');
  return { success: true };
}

// 学生キャッシュ一覧 of 取得
export async function getUsersCache() {
  if (isUseMock()) {
    console.log('[Demo Mode] Fetching mock student caches');
    return mockCache;
  }

  const { data, error } = await supabase
    .from('users_cache')
    .select('*')
    .order('student_id', { ascending: true });

  if (error) {
    console.error('getUsersCache error:', error);
    throw error;
  }
  return data || [];
}

// 学生キャッシュ of 更新
export async function updateStudentCache(
  studentId: string,
  name: string,
  department: string,
  grade: string,
  className: string
) {
  if (isUseMock()) {
    console.log('[Demo Mode] Updating mock student cache:', studentId);
    const index = mockCache.findIndex(c => c.student_id === studentId);
    if (index >= 0) {
      mockCache[index] = {
        ...mockCache[index],
        name,
        department,
        grade,
        class_name: className,
        updated_at: new Date().toISOString()
      };
    }
    return { success: true };
  }

  const { error } = await supabase
    .from('users_cache')
    .update({ name, department, grade, class_name: className })
    .eq('student_id', studentId);

  if (error) {
    console.error('updateStudentCache error:', error);
    throw error;
  }
  revalidatePath('/admin');
  return { success: true };
}

// 学生キャッシュ of 削除
export async function deleteStudentCache(studentId: string) {
  if (isUseMock()) {
    console.log('[Demo Mode] Deleting mock student cache:', studentId);
    const index = mockCache.findIndex(c => c.student_id === studentId);
    if (index >= 0) {
      mockCache.splice(index, 1);
    }
    return { success: true };
  }

  const { error } = await supabase
    .from('users_cache')
    .delete()
    .eq('student_id', studentId);

  if (error) {
    console.error('deleteStudentCache error:', error);
    throw error;
  }
  revalidatePath('/admin');
  return { success: true };
}
