'use server';

import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { isUseMock, mockLogs, mockCache, mockDepartments, mockNotifications } from '@/lib/mockDb';
import { addUsageStats, calculateUsageMinutes } from '@/lib/usageStats';

const AUTO_CHECKOUT_HOURS = 15;

type AutoCheckoutNotificationSource = {
  id: number;
  student_id: string;
  name: string;
  department: string;
  grade: string;
  checked_in_at?: string;
  checked_out_at?: string | null;
};

function buildAutoCheckoutNotificationMessage(log: AutoCheckoutNotificationSource) {
  return `${log.student_id} ${log.name} さんが15時間経過により自動退室になりました。`;
}

function addMockNotificationForAutoCheckout(log: AutoCheckoutNotificationSource) {
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
    message: buildAutoCheckoutNotificationMessage(log),
    is_read: false,
    is_acknowledged: false,
    created_at: new Date().toISOString(),
    read_at: null,
  });
}

async function createNotificationForAutoCheckout(log: AutoCheckoutNotificationSource) {
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
    message: buildAutoCheckoutNotificationMessage(log),
    is_read: false,
    is_acknowledged: false,
    read_at: null,
  });

  if (error) throw error;
}

async function ensureAutoCheckoutNotifications() {
  if (isUseMock()) {
    const now = Date.now();
    for (const log of mockLogs) {
      const isExpired = !log.checked_out_at && (now - new Date(log.checked_in_at).getTime()) > AUTO_CHECKOUT_HOURS * 3600000;
      if (isExpired) {
        const checkedOutAt = new Date(new Date(log.checked_in_at).getTime() + AUTO_CHECKOUT_HOURS * 3600000).toISOString();
        const minutes = calculateUsageMinutes(log.checked_in_at, checkedOutAt);
        log.checked_out_at = checkedOutAt;
        log.auto_checked_out = true;
        log.usage_duration_minutes = minutes;
        log.admin_confirmed = false;
        await addUsageStats(log.student_id, minutes, new Date(checkedOutAt));
      }

      if (log.auto_checked_out && !log.deleted_at) {
        addMockNotificationForAutoCheckout(log);
      }
    }
    return;
  }

  const autoCheckoutTime = new Date(Date.now() - AUTO_CHECKOUT_HOURS * 3600000).toISOString();
  const { data: oldLogs, error: selectOldError } = await supabase
    .from('usage_logs')
    .select('id, student_id, name, department, grade, checked_in_at')
    .is('checked_out_at', null)
    .is('deleted_at', null)
    .lt('checked_in_at', autoCheckoutTime);

  if (selectOldError) throw selectOldError;

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
      await createNotificationForAutoCheckout({ ...log, checked_out_at: checkedOutAt });
      await addUsageStats(log.student_id, minutes, new Date(checkedOutAt));
    }
  }

  const { data: autoCheckedOutLogs, error: selectAutoError } = await supabase
    .from('usage_logs')
    .select('id, student_id, name, department, grade, checked_in_at, checked_out_at')
    .eq('auto_checked_out', true)
    .is('deleted_at', null)
    .order('checked_in_at', { ascending: false })
    .limit(100);

  if (selectAutoError) throw selectAutoError;

  for (const log of autoCheckedOutLogs ?? []) {
    await createNotificationForAutoCheckout(log);
  }
}

// ==========================================
// 型定義
// ==========================================


export type AdminNotification = {
  id: number;
  type: string;
  usage_log_id?: number | null;
  student_number: string;
  department: string;
  grade: string;
  name: string;
  message?: string | null;
  is_read: boolean;
  created_at: string;
  read_at?: string | null;
};

export type DepartmentClass = { grade: number; class_name: string; sort_order: number };

export type DepartmentMaster = {
  id: number;
  name: string;
  years: number;
  classes: DepartmentClass[];
};

// ==========================================
// 学科マスタ
// ==========================================

export async function getDepartmentMasters(): Promise<DepartmentMaster[]> {
  if (isUseMock()) {
    return mockDepartments.map((d) => ({
      id: d.id,
      name: d.name,
      years: d.years_count,
      classes: [...d.classes].sort((a, b) =>
        a.grade !== b.grade ? a.grade - b.grade : a.class_name.localeCompare(b.class_name)
      ),
    }));
  }

  const { data, error } = await supabase
    .from('departments_master')
    .select('id, name, years_count, sort_order, department_classes(grade, class_name, sort_order)')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((dept) => ({
    id: dept.id,
    name: dept.name,
    years: dept.years_count,
    classes: (dept.department_classes ?? [])
      .map((c: { grade: number; class_name: string; sort_order: number }) => ({
        grade: c.grade,
        class_name: c.class_name,
        sort_order: c.sort_order,
      }))
      .sort((a: DepartmentClass, b: DepartmentClass) =>
        a.grade !== b.grade
          ? a.grade - b.grade
          : a.sort_order !== b.sort_order
          ? a.sort_order - b.sort_order
          : a.class_name.localeCompare(b.class_name)
      ),
  }));
}

export async function addDepartment(name: string, years: number) {
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error('学科名を入力してください。');
  if (!Number.isInteger(years) || years < 1 || years > 6) {
    throw new Error('修業年限は1〜6の整数で入力してください。');
  }

  if (isUseMock()) {
    if (mockDepartments.some((d) => d.name === normalizedName)) {
      throw new Error('同名の学科が既に存在します。');
    }
    const newId = mockDepartments.length > 0 ? Math.max(...mockDepartments.map((d) => d.id)) + 1 : 1;
    mockDepartments.push({ id: newId, name: normalizedName, classes: [], years_count: years });
    revalidatePath('/');
    revalidatePath('/admin');
    return;
  }

  const { error } = await supabase
    .from('departments_master')
    .insert({ name: normalizedName, years_count: years });
  if (error) throw error;
  revalidatePath('/');
  revalidatePath('/admin');
}

export async function deleteDepartment(id: number) {
  if (isUseMock()) {
    const index = mockDepartments.findIndex((d) => d.id === id);
    if (index >= 0) mockDepartments.splice(index, 1);
    revalidatePath('/');
    revalidatePath('/admin');
    return;
  }

  const { error } = await supabase.from('departments_master').delete().eq('id', id);
  if (error) throw error;
  revalidatePath('/');
  revalidatePath('/admin');
}

export async function updateDepartmentYears(departmentId: number, years: number) {
  if (!Number.isInteger(years) || years < 1 || years > 6) {
    throw new Error('修業年限は1〜6の整数で入力してください。');
  }

  if (isUseMock()) {
    const dept = mockDepartments.find((d) => d.id === departmentId);
    if (dept) dept.years_count = years;
    revalidatePath('/');
    revalidatePath('/admin');
    return;
  }

  const { error } = await supabase
    .from('departments_master')
    .update({ years_count: years })
    .eq('id', departmentId);
  if (error) throw error;
  revalidatePath('/');
  revalidatePath('/admin');
}

// ==========================================
// クラスマスタ (grade + class_name 構造)
// ==========================================

export async function addDepartmentClass(departmentId: number, grade: number, className: string) {
  const normalizedName = className.trim();
  if (!normalizedName) throw new Error('クラス名を入力してください。');
  if (!Number.isInteger(grade) || grade < 1 || grade > 6) {
    throw new Error('学年は1〜6の整数で入力してください。');
  }

  if (isUseMock()) {
    const dept = mockDepartments.find((d) => d.id === departmentId);
    if (!dept) throw new Error('学科が見つかりません。');
    if (grade > dept.years_count) {
      throw new Error(`${dept.name}は${dept.years_count}年制のため、${grade}年のクラスは追加できません。`);
    }
    const exists = dept.classes.some(
      (c) => c.grade === grade && c.class_name === normalizedName
    );
    if (!exists) {
      dept.classes.push({ grade, class_name: normalizedName, sort_order: 0 });
    }
    revalidatePath('/');
    revalidatePath('/admin');
    return;
  }

  const { data: dept, error: deptError } = await supabase
    .from('departments_master')
    .select('name, years_count')
    .eq('id', departmentId)
    .single();
  if (deptError) throw deptError;
  if (!dept) throw new Error('学科が見つかりません。');
  if (grade > dept.years_count) {
    throw new Error(`${dept.name}は${dept.years_count}年制のため、${grade}年のクラスは追加できません。`);
  }

  const { error } = await supabase.from('department_classes').insert({
    department_id: departmentId,
    grade,
    class_name: normalizedName,
  });
  if (error) throw error;
  revalidatePath('/');
  revalidatePath('/admin');
}

export async function deleteDepartmentClass(departmentId: number, grade: number, className: string) {
  if (isUseMock()) {
    const dept = mockDepartments.find((d) => d.id === departmentId);
    if (dept) {
      dept.classes = dept.classes.filter(
        (c) => !(c.grade === grade && c.class_name === className)
      );
    }
    revalidatePath('/');
    revalidatePath('/admin');
    return;
  }

  const { error } = await supabase
    .from('department_classes')
    .delete()
    .eq('department_id', departmentId)
    .eq('grade', grade)
    .eq('class_name', className);
  if (error) throw error;
  revalidatePath('/');
  revalidatePath('/admin');
}

// ==========================================
// 利用ログ
// ==========================================

/** 有効な利用ログを全件取得（論理削除済みを除外） */
export async function getUsageLogs() {
  if (isUseMock()) {
    return mockLogs.filter((l) => !l.deleted_at);
  }

  const { data, error } = await supabase
    .from('usage_logs')
    .select('*')
    .is('deleted_at', null)
    .order('checked_in_at', { ascending: false });

  if (error) {
    console.error('getUsageLogs error:', error);
    throw error;
  }
  return data || [];
}

/** 利用ログを論理削除（ゴミ箱へ移動） */
export async function deleteUsageLog(id: number) {
  if (isUseMock()) {
    const log = mockLogs.find((l) => l.id === id);
    if (log) log.deleted_at = new Date().toISOString();
    return { success: true };
  }

  const { error } = await supabase
    .from('usage_logs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null);

  if (error) {
    console.error('deleteUsageLog error:', error);
    throw error;
  }
  revalidatePath('/admin');
  return { success: true };
}

/** 利用ログをゴミ箱から復元 */
export async function restoreUsageLog(id: number) {
  if (isUseMock()) {
    const log = mockLogs.find((l) => l.id === id);
    if (log) log.deleted_at = null;
    return { success: true };
  }

  const { error } = await supabase
    .from('usage_logs')
    .update({ deleted_at: null })
    .eq('id', id);

  if (error) {
    console.error('restoreUsageLog error:', error);
    throw error;
  }
  revalidatePath('/admin');
  return { success: true };
}

/** 利用ログを物理削除（完全削除） */
export async function permanentDeleteUsageLog(id: number) {
  if (isUseMock()) {
    const index = mockLogs.findIndex((l) => l.id === id);
    if (index >= 0) mockLogs.splice(index, 1);
    return { success: true };
  }

  const { error } = await supabase
    .from('usage_logs')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('permanentDeleteUsageLog error:', error);
    throw error;
  }
  revalidatePath('/admin');
  return { success: true };
}

/** ゴミ箱内の利用ログ一覧を取得 */
export async function getDeletedUsageLogs() {
  if (isUseMock()) {
    return mockLogs.filter((l) => !!l.deleted_at);
  }

  const { data, error } = await supabase
    .from('usage_logs')
    .select('*')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (error) {
    console.error('getDeletedUsageLogs error:', error);
    throw error;
  }
  return data || [];
}

// ==========================================
// 学生キャッシュ
// ==========================================

/** 有効な学生キャッシュを全件取得（論理削除済みを除外） */
export async function getUsersCache() {
  if (isUseMock()) {
    return mockCache.filter((c) => !c.deleted_at);
  }

  const { data, error } = await supabase
    .from('users_cache')
    .select('*')
    .is('deleted_at', null)
    .order('student_id', { ascending: true });

  if (error) {
    console.error('getUsersCache error:', error);
    throw error;
  }
  return data || [];
}

/** 学生キャッシュを更新 */
export async function updateStudentCache(
  studentId: string,
  name: string,
  department: string,
  grade: string,
  className: string
) {
  if (isUseMock()) {
    const index = mockCache.findIndex((c) => c.student_id === studentId);
    if (index >= 0) {
      mockCache[index] = {
        ...mockCache[index],
        name,
        department,
        grade,
        class_name: className,
        updated_at: new Date().toISOString(),
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

/** 学生キャッシュを論理削除（ゴミ箱へ移動） */
export async function deleteStudentCache(studentId: string) {
  if (isUseMock()) {
    const cache = mockCache.find((c) => c.student_id === studentId);
    if (cache) cache.deleted_at = new Date().toISOString();
    return { success: true };
  }

  const { error } = await supabase
    .from('users_cache')
    .update({ deleted_at: new Date().toISOString() })
    .eq('student_id', studentId)
    .is('deleted_at', null);

  if (error) {
    console.error('deleteStudentCache error:', error);
    throw error;
  }
  revalidatePath('/admin');
  return { success: true };
}

/** 学生キャッシュをゴミ箱から復元 */
export async function restoreStudentCache(studentId: string) {
  if (isUseMock()) {
    const cache = mockCache.find((c) => c.student_id === studentId);
    if (cache) cache.deleted_at = null;
    return { success: true };
  }

  const { error } = await supabase
    .from('users_cache')
    .update({ deleted_at: null })
    .eq('student_id', studentId);

  if (error) {
    console.error('restoreStudentCache error:', error);
    throw error;
  }
  revalidatePath('/admin');
  return { success: true };
}

/** 学生キャッシュを物理削除（完全削除） */
export async function permanentDeleteStudentCache(studentId: string) {
  if (isUseMock()) {
    const index = mockCache.findIndex((c) => c.student_id === studentId);
    if (index >= 0) mockCache.splice(index, 1);
    return { success: true };
  }

  const { error } = await supabase
    .from('users_cache')
    .delete()
    .eq('student_id', studentId);

  if (error) {
    console.error('permanentDeleteStudentCache error:', error);
    throw error;
  }
  revalidatePath('/admin');
  return { success: true };
}

/** ゴミ箱内の学生キャッシュ一覧を取得 */
export async function getDeletedStudentCaches() {
  if (isUseMock()) {
    return mockCache.filter((c) => !!c.deleted_at);
  }

  const { data, error } = await supabase
    .from('users_cache')
    .select('*')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (error) {
    console.error('getDeletedStudentCaches error:', error);
    throw error;
  }
  return data || [];
}
// ==========================================
// 通知
// ==========================================

/** 自動退室通知を取得 */
export async function getNotifications(): Promise<AdminNotification[]> {
  await ensureAutoCheckoutNotifications();

  if (isUseMock()) {
    return [...mockNotifications].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, usage_log_id, student_number, department, grade, name, message, is_read, created_at, read_at')
    .eq('type', 'auto_checkout')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getNotifications error:', error);
    throw error;
  }

  return data || [];
}

/** 通知を既読化 */
export async function markNotificationRead(id: number): Promise<{ success: true }> {
  const readAt = new Date().toISOString();

  if (isUseMock()) {
    const notification = mockNotifications.find((n) => n.id === id);
    if (notification) {
      notification.is_read = true;
      notification.is_acknowledged = true;
      notification.read_at = readAt;
    }
    return { success: true };
  }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, is_acknowledged: true, read_at: readAt })
    .eq('id', id);

  if (error) {
    console.error('markNotificationRead error:', error);
    throw error;
  }

  revalidatePath('/admin');
  return { success: true };
}
