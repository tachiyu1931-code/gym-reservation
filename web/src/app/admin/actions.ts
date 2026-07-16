'use server';

import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { isUseMock, mockLogs, mockCache, mockDepartments, mockNotifications } from '@/lib/mockDb';
import { normalizeDepartment } from '@/constants/departments';
import { runAutoCheckout as runAutoCheckoutInternal } from '@/lib/autoCheckout';

const ANNUAL_GRADE_PROMOTION_MONTH = 4;


type AnnualGradePromotionResult = {
  executed: boolean;
  schoolYear: number | null;
  promotedCount: number;
  deletedCount: number;
};

const globalForAnnualPromotion = globalThis as unknown as {
  mockAnnualGradePromotions?: Set<number>;
};

function getTokyoYearMonth(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
  };
}

function parseGradeNumber(grade: string): number | null {
  const match = grade.trim().match(/^(\d+)\s*年?$/);
  if (!match) return null;

  const gradeNumber = Number(match[1]);
  return Number.isInteger(gradeNumber) && gradeNumber > 0 ? gradeNumber : null;
}

function buildDepartmentYearsMap(departments: { name: string; years_count: number; deleted_at?: string | null }[]) {
  const map = new Map<string, number>();

  for (const department of departments) {
    if (department.deleted_at) continue;
    const years = Number(department.years_count);
    if (!Number.isInteger(years) || years < 1) continue;

    const name = department.name.trim();
    map.set(name, years);
    map.set(normalizeDepartment(name), years);
  }

  return map;
}

function findYearsForDepartment(departmentYearsMap: Map<string, number>, department: string) {
  const name = department.trim();
  return departmentYearsMap.get(name) ?? departmentYearsMap.get(normalizeDepartment(name)) ?? null;
}

async function runAnnualGradePromotion(now: Date): Promise<AnnualGradePromotionResult> {
  const { year, month } = getTokyoYearMonth(now);
  if (month !== ANNUAL_GRADE_PROMOTION_MONTH) {
    return { executed: false, schoolYear: null, promotedCount: 0, deletedCount: 0 };
  }

  const schoolYear = year;
  const deletedAt = now.toISOString();
  let promotedCount = 0;
  let deletedCount = 0;

  if (isUseMock()) {
    if (!globalForAnnualPromotion.mockAnnualGradePromotions) {
      globalForAnnualPromotion.mockAnnualGradePromotions = new Set<number>();
    }
    if (globalForAnnualPromotion.mockAnnualGradePromotions.has(schoolYear)) {
      return { executed: false, schoolYear, promotedCount: 0, deletedCount: 0 };
    }

    const departmentYearsMap = buildDepartmentYearsMap(mockDepartments);
    for (const cache of mockCache) {
      if (cache.deleted_at || cache.is_staff || cache.user_type === 'staff') continue;

      const gradeNumber = parseGradeNumber(cache.grade);
      const years = findYearsForDepartment(departmentYearsMap, cache.department);
      if (!gradeNumber || !years) continue;

      if (gradeNumber >= years) {
        cache.deleted_at = deletedAt;
        cache.updated_at = deletedAt;
        deletedCount += 1;
      } else {
        cache.grade = `${gradeNumber + 1}年`;
        cache.updated_at = deletedAt;
        promotedCount += 1;
      }
    }

    globalForAnnualPromotion.mockAnnualGradePromotions.add(schoolYear);
    revalidatePath('/admin');
    return { executed: true, schoolYear, promotedCount, deletedCount };
  }

  const { data, error } = await supabase.rpc('promote_annual_grades', {
    target_school_year: schoolYear,
  });

  if (error) throw error;

  const result = Array.isArray(data) ? data[0] : data;
  revalidatePath('/admin');
  return {
    executed: Boolean(result?.executed),
    schoolYear,
    promotedCount: Number(result?.promoted_count ?? 0),
    deletedCount: Number(result?.deleted_count ?? 0),
  };
}
export async function ensureAnnualGradePromotion(): Promise<AnnualGradePromotionResult> {
  return runAnnualGradePromotion(new Date());
}

export async function runAutoCheckout() {
  await runAutoCheckoutInternal();
  revalidatePath('/admin');
}

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

export type DepartmentClass = { grade: number; class_name: string; sort_order: number; deleted_at?: string | null };

export type DepartmentMaster = {
  id: number;
  name: string;
  years: number;
  classes: DepartmentClass[];
};

export type DeletedDepartmentMaster = DepartmentMaster & {
  deleted_at: string | null;
};

// ==========================================
// 学科マスタ
// ==========================================

export async function getDepartmentMasters(): Promise<DepartmentMaster[]> {
  if (isUseMock()) {
    return mockDepartments.filter((d) => !d.deleted_at).map((d) => ({
      id: d.id,
      name: d.name,
      years: d.years_count,
      classes: d.classes.filter((c) => !c.deleted_at).sort((a, b) =>
        a.grade !== b.grade ? a.grade - b.grade : a.class_name.localeCompare(b.class_name)
      ),
    }));
  }

  const { data, error } = await supabase
    .from('departments_master')
    .select('id, name, years_count, sort_order, department_classes(grade, class_name, sort_order, deleted_at)')
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((dept) => ({
    id: dept.id,
    name: dept.name,
    years: dept.years_count,
    classes: (dept.department_classes ?? [])
      .filter((c: { deleted_at?: string | null }) => !c.deleted_at)
      .map((c: { grade: number; class_name: string; sort_order: number; deleted_at?: string | null }) => ({
        grade: c.grade,
        class_name: c.class_name,
        sort_order: c.sort_order,
        deleted_at: c.deleted_at,
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
  const deletedAt = new Date().toISOString();

  if (isUseMock()) {
    const dept = mockDepartments.find((d) => d.id === id && !d.deleted_at);
    if (dept) {
      dept.deleted_at = deletedAt;
      dept.classes = dept.classes.map((cls) => ({ ...cls, deleted_at: deletedAt }));
    }
    revalidatePath('/');
    revalidatePath('/admin');
    return;
  }

  const { error: classError } = await supabase
    .from('department_classes')
    .update({ deleted_at: deletedAt })
    .eq('department_id', id)
    .is('deleted_at', null);
  if (classError) throw classError;

  const { error } = await supabase
    .from('departments_master')
    .update({ deleted_at: deletedAt })
    .eq('id', id)
    .is('deleted_at', null);
  if (error) throw error;
  revalidatePath('/');
  revalidatePath('/admin');
}

export async function restoreDepartment(id: number) {
  if (isUseMock()) {
    const dept = mockDepartments.find((d) => d.id === id);
    if (dept) {
      dept.deleted_at = null;
      dept.classes = dept.classes.map((cls) => ({ ...cls, deleted_at: null }));
    }
    revalidatePath('/');
    revalidatePath('/admin');
    return { success: true };
  }

  const { error: deptError } = await supabase
    .from('departments_master')
    .update({ deleted_at: null })
    .eq('id', id);
  if (deptError) throw deptError;

  const { error: classError } = await supabase
    .from('department_classes')
    .update({ deleted_at: null })
    .eq('department_id', id);
  if (classError) throw classError;

  revalidatePath('/');
  revalidatePath('/admin');
  return { success: true };
}

export async function permanentDeleteDepartment(id: number) {
  if (isUseMock()) {
    const index = mockDepartments.findIndex((d) => d.id === id);
    if (index >= 0) mockDepartments.splice(index, 1);
    revalidatePath('/');
    revalidatePath('/admin');
    return { success: true };
  }

  const { error: classError } = await supabase
    .from('department_classes')
    .delete()
    .eq('department_id', id);
  if (classError) throw classError;

  const { error } = await supabase
    .from('departments_master')
    .delete()
    .eq('id', id);
  if (error) throw error;

  revalidatePath('/');
  revalidatePath('/admin');
  return { success: true };
}

export async function getDeletedDepartments(): Promise<DeletedDepartmentMaster[]> {
  if (isUseMock()) {
    return mockDepartments
      .filter((d) => !!d.deleted_at)
      .sort((a, b) => new Date(b.deleted_at ?? 0).getTime() - new Date(a.deleted_at ?? 0).getTime())
      .map((d) => ({
        id: d.id,
        name: d.name,
        years: d.years_count,
        deleted_at: d.deleted_at ?? null,
        classes: [...d.classes].sort((a, b) =>
          a.grade !== b.grade ? a.grade - b.grade : a.class_name.localeCompare(b.class_name)
        ),
      }));
  }

  const { data, error } = await supabase
    .from('departments_master')
    .select('id, name, years_count, sort_order, deleted_at, department_classes(grade, class_name, sort_order, deleted_at)')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((dept) => ({
    id: dept.id,
    name: dept.name,
    years: dept.years_count,
    deleted_at: dept.deleted_at,
    classes: (dept.department_classes ?? [])
      .map((c: { grade: number; class_name: string; sort_order: number; deleted_at?: string | null }) => ({
        grade: c.grade,
        class_name: c.class_name,
        sort_order: c.sort_order,
        deleted_at: c.deleted_at,
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
    .is('deleted_at', null)
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
  await runAutoCheckoutInternal();

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

