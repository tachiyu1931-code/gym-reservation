import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isUseMock, mockDepartments } from '@/lib/mockDb';

/**
 * GET /api/departments
 * 学科マスタと各学科・学年ごとのクラス一覧を返す
 *
 * レスポンス形式:
 * [
 *   {
 *     id: number,
 *     name: string,
 *     years: number,
 *     classes: { grade: number; class_name: string }[]
 *   }
 * ]
 */
export async function GET() {
  try {
    if (isUseMock()) {
      return NextResponse.json(
        mockDepartments.filter((d) => !d.deleted_at).map((d) => ({
          id: d.id,
          name: d.name,
          years: d.years_count,
          classes: d.classes.filter((c) => !c.deleted_at).sort((a, b) => a.grade - b.grade || a.class_name.localeCompare(b.class_name)),
        }))
      );
    }

    const { data, error } = await supabase
      .from('departments_master')
      .select('id, name, years_count, sort_order, department_classes(grade, class_name, sort_order, deleted_at)')
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json(
      (data ?? []).map((dept) => ({
        id: dept.id,
        name: dept.name,
        years: dept.years_count,
        classes: (dept.department_classes ?? [])
          .filter((c: { deleted_at?: string | null }) => !c.deleted_at)
          .map((c: { grade: number; class_name: string; sort_order: number }) => ({
            grade: c.grade,
            class_name: c.class_name,
            sort_order: c.sort_order,
          }))
          .sort((a: { grade: number; sort_order: number; class_name: string }, b: { grade: number; sort_order: number; class_name: string }) =>
            a.grade !== b.grade
              ? a.grade - b.grade
              : a.sort_order !== b.sort_order
              ? a.sort_order - b.sort_order
              : a.class_name.localeCompare(b.class_name)
          ),
      }))
    );
  } catch (error: unknown) {
    console.error('Database fetch error in /api/departments:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

