'use server';

import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { isUseMock, mockLogs, mockCache, mockDepartments, type DeptClass } from '@/lib/mockDb';

// ==========================================
// 型定義
// ==========================================

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