import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isUseMock, mockCache } from '@/lib/mockDb';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('student_id');

  if (!studentId) {
    return NextResponse.json({ error: 'student_id is required' }, { status: 400 });
  }

  // デモ用のモックモード判定
  if (isUseMock()) {
    const cached = mockCache.find(c => c.student_id === studentId);
    if (cached) {
      return NextResponse.json({ found: true, data: cached });
    }
    return NextResponse.json({ found: false });
  }

  try {
    const { data, error } = await supabase
      .from('users_cache')
      .select('name, department, grade, class_name')
      .eq('student_id', studentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // レコードが見つからない場合
        return NextResponse.json({ found: false });
      }
      throw error;
    }

    return NextResponse.json({ found: true, data });
  } catch (error: any) {
    console.error('Database error in /api/cache:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
