// ==========================================
// モックDB型定義
// ==========================================

export interface UsageLog {
  id: number;
  student_id: string;
  name: string;
  department: string;
  grade: string;
  class_name: string;
  is_staff: boolean;
  checked_in_at: string;
  checked_out_at?: string | null;
  created_at: string;
  deleted_at?: string | null;
}

export interface UserCache {
  student_id: string;
  name: string;
  department: string;
  grade: string;
  class_name: string;
  is_staff: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

// ==========================================
// グローバルシングルトン（HMR対応）
// ==========================================
const globalForMock = globalThis as unknown as {
  mockLogs: UsageLog[];
  mockCache: UserCache[];
};

if (!globalForMock.mockLogs) {
  globalForMock.mockLogs = [
    {
      id: 1,
      student_id: '20261001',
      name: '山田 太郎',
      department: 'ITスペシャリスト科',
      grade: '2年',
      class_name: 'A組',
      is_staff: false,
      checked_in_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      checked_out_at: new Date(Date.now() - 3600000).toISOString(),
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      deleted_at: null,
    },
    {
      id: 2,
      student_id: '20261002',
      name: '佐藤 花子',
      department: 'ITスペシャリスト科',
      grade: '1年',
      class_name: 'A組',
      is_staff: false,
      checked_in_at: new Date(Date.now() - 1800000).toISOString(),
      checked_out_at: null,
      created_at: new Date(Date.now() - 1800000).toISOString(),
      deleted_at: null,
    },
    {
      id: 3,
      student_id: '20261003',
      name: '鈴木 一郎',
      department: '高度情報処理科・ITエンジニア科',
      grade: '1年',
      class_name: 'B組',
      is_staff: false,
      checked_in_at: new Date(Date.now() - 600000).toISOString(),
      checked_out_at: null,
      created_at: new Date(Date.now() - 600000).toISOString(),
      deleted_at: null,
    },
  ];
}

if (!globalForMock.mockCache) {
  globalForMock.mockCache = [
    {
      student_id: '20261001',
      name: '山田 太郎',
      department: 'ITスペシャリスト科',
      grade: '2年',
      class_name: 'A組',
      is_staff: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    },
    {
      student_id: '20261002',
      name: '佐藤 花子',
      department: 'ITスペシャリスト科',
      grade: '1年',
      class_name: 'A組',
      is_staff: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    },
    {
      student_id: '20261003',
      name: '鈴木 一郎',
      department: '高度情報処理科・ITエンジニア科',
      grade: '1年',
      class_name: 'B組',
      is_staff: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    },
  ];
}

export const mockLogs = globalForMock.mockLogs;
export const mockCache = globalForMock.mockCache;

export function isUseMock(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return (
    !url ||
    !key ||
    url.includes('your-project-id') ||
    url.includes('placeholder') ||
    key.includes('your-supabase') ||
    key.includes('placeholder')
  );
}

// ==========================================
// 学科・クラスマスタのモックデータ
// ==========================================

/** クラスエントリ（学年 + クラス名） */
export type DeptClass = { grade: number; class_name: string; sort_order: number };

export type MockDepartment = {
  id: number;
  name: string;
  classes: DeptClass[];
  years_count: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __mockDepartments: MockDepartment[] | undefined;
}

const globalForDept = globalThis as unknown as { mockDepartments: MockDepartment[] };

if (!globalForDept.mockDepartments) {
  globalForDept.mockDepartments = [
    {
      id: 1,
      name: 'ITスペシャリスト科',
      years_count: 4,
      classes: [
        { grade: 1, class_name: 'A組', sort_order: 0 },
        { grade: 2, class_name: 'A組', sort_order: 0 },
        { grade: 3, class_name: 'A組', sort_order: 0 },
        { grade: 4, class_name: 'A組', sort_order: 0 },
      ],
    },
    {
      id: 2,
      name: '高度情報処理科・ITエンジニア科',
      years_count: 3,
      classes: [
        { grade: 1, class_name: 'B組', sort_order: 0 },
        { grade: 2, class_name: 'B組', sort_order: 0 },
        { grade: 3, class_name: 'B組', sort_order: 0 },
      ],
    },
    {
      id: 3,
      name: '情報システム科',
      years_count: 2,
      classes: [
        { grade: 1, class_name: 'C組', sort_order: 0 },
        { grade: 2, class_name: 'C組', sort_order: 0 },
      ],
    },
  ];
}

export const mockDepartments = globalForDept.mockDepartments;