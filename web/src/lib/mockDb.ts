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
  user_type: 'student' | 'staff';
  checked_in_at: string;
  checked_out_at?: string | null;
  auto_checked_out: boolean;
  usage_duration_minutes?: number | null;
  is_adjusted?: boolean;
  is_notified?: boolean;
  admin_confirmed?: boolean;
  created_at: string;
  deleted_at?: string | null;
}


export interface Notification {
  id: number;
  type: 'auto_checkout';
  usage_log_id?: number | null;
  student_number: string;
  department: string;
  grade: string;
  name: string;
  message: string;
  is_read: boolean;
  is_acknowledged: boolean;
  created_at: string;
  read_at?: string | null;
}export interface UserCache {
  student_id: string;
  name: string;
  department: string;
  grade: string;
  class_name: string;
  is_staff: boolean;
  user_type: 'student' | 'staff';
  total_usage_minutes: number;
  monthly_usage_minutes: number;
  consecutive_days: number;
  last_used_date?: string | null;
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
  mockNotifications: Notification[];
};

if (!globalForMock.mockLogs) {
  globalForMock.mockLogs = [
    {
      id: 1,
      student_id: '20261001',
      name: '山田 太郎',
      department: 'ITスペシャリスト科',
      grade: '4年',
      class_name: 'A組',
      is_staff: false,
      user_type: 'student',
      checked_in_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      checked_out_at: new Date(Date.now() - 3600000).toISOString(),
      auto_checked_out: false,
      usage_duration_minutes: 60,
      admin_confirmed: false,
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      deleted_at: null,
    },
    {
      id: 2,
      student_id: '20261002',
      name: '佐藤 花子',
      department: '高度情報処理科/ITエンジニア科',
      grade: '2年',
      class_name: 'B組',
      is_staff: false,
      user_type: 'student',
      checked_in_at: new Date(Date.now() - 1800000).toISOString(),
      checked_out_at: null,
      auto_checked_out: false,
      usage_duration_minutes: null,
      is_adjusted: false,
      is_notified: false,
      admin_confirmed: false,
      created_at: new Date(Date.now() - 1800000).toISOString(),
      deleted_at: null,
    },
    {
      id: 3,
      student_id: '20261003',
      name: '鈴木翔平',
      department: '情報システム科',
      grade: '2年',
      class_name: 'C組',
      is_staff: false,
      user_type: 'student',
      checked_in_at: new Date(Date.now() - 3600000 * 16).toISOString(),
      checked_out_at: new Date(Date.now() - 3600000).toISOString(),
      auto_checked_out: true,
      usage_duration_minutes: 30,
      is_adjusted: true,
      is_notified: false,
      admin_confirmed: false,
      created_at: new Date(Date.now() - 3600000 * 16).toISOString(),
      deleted_at: null,
    },
    {
      id: 4,
      student_id: '20261004',
      name: '池田勇人',
      department: '高度情報処理科/ITエンジニア科',
      grade: '3年',
      class_name: 'B組',
      is_staff: false,
      user_type: 'student',
      checked_in_at: new Date(Date.now() - 3600000 * 16).toISOString(),
      checked_out_at: new Date(Date.now() - 3600000).toISOString(),
      auto_checked_out: true,
      usage_duration_minutes: 900,
      is_adjusted: true,
      is_notified: false,
      admin_confirmed: false,
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
      grade: '4年',
      class_name: 'A組',
      is_staff: false,
      user_type: 'student',
      total_usage_minutes: 420,
      monthly_usage_minutes: 180,
      consecutive_days: 3,
      last_used_date: new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    },
    {
      student_id: '20261002',
      name: '佐藤 花子',
      department: '高度情報処理科/ITエンジニア科',
      grade: '2年',
      class_name: 'B組',
      is_staff: false,
      user_type: 'student',
      total_usage_minutes: 240,
      monthly_usage_minutes: 120,
      consecutive_days: 2,
      last_used_date: new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    },
    {
      student_id: '20261003',
      name: '鈴木翔平',
      department: '情報システム科',
      grade: '2年',
      class_name: 'C組',
      is_staff: false,
      user_type: 'student',
      total_usage_minutes: 390,
      monthly_usage_minutes: 90,
      consecutive_days: 1,
      last_used_date: new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    },
    {
      student_id: '20261004',
      name: '池田勇人',
      department: '情報システム科',
      grade: '2年',
      class_name: 'C組',
      is_staff: false,
      user_type: 'student',
      total_usage_minutes: 1000000,
      monthly_usage_minutes: 100,
      consecutive_days: 10,
      last_used_date: new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    },
  ];
}


if (!globalForMock.mockNotifications) {
  globalForMock.mockNotifications = [];
}

export const mockLogs = globalForMock.mockLogs;
export const mockCache = globalForMock.mockCache;
export const mockNotifications = globalForMock.mockNotifications;

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
export type DeptClass = { grade: number; class_name: string; sort_order: number; deleted_at?: string | null };

export type MockDepartment = {
  id: number;
  name: string;
  classes: DeptClass[];
  years_count: number;
  deleted_at?: string | null;
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
      name: '高度情報処理科/ITエンジニア科',
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
    {
      id: 4,
      name: 'ゲームクリエイター科',
      years_count: 4,
      classes: [
        { grade: 1, class_name: 'D組', sort_order: 0 },
        { grade: 2, class_name: 'D組', sort_order: 0 },
        { grade: 3, class_name: 'D組', sort_order: 0 },
        { grade: 4, class_name: 'D組', sort_order: 0 },
      ],
    },
    {
      id: 5,
      name: '総合デザイン科/Web・CGデザイン科',
      years_count: 3,
      classes: [
        { grade: 1, class_name: 'F組', sort_order: 0 },
        { grade: 2, class_name: 'F組', sort_order: 0 },
        { grade: 3, class_name: 'F組', sort_order: 0 },
      ],
    },
    {
      id: 6,
      name: '建築設計科/インテリアデザイン科',
      years_count: 2,
      classes: [
        { grade: 1, class_name: 'H組', sort_order: 0 },
        { grade: 2, class_name: 'H組', sort_order: 0 },
        { grade: 1, class_name: 'I組', sort_order: 0 },
        { grade: 2, class_name: 'I組', sort_order: 0 },
      ],
    },
    {
      id: 7,
      name: '建築士専攻科',
      years_count: 3,
      classes: [
        { grade: 3, class_name: 'K組', sort_order: 0 },
      ],
    },
    {
      id: 8,
      name: 'International IT Business Course(国際ITビジネス科)',
      years_count: 2,
      classes: [
        { grade: 1, class_name: 'G組', sort_order: 0 },
        { grade: 2, class_name: 'G組', sort_order: 0 },
      ],
    },
  ];
}

export const mockDepartments = globalForDept.mockDepartments;

