export interface UsageLog {
  id: number;
  student_id: string;
  name: string;
  department: string;
  grade: string;
  class_name: string;
  checked_in_at: string;
  checked_out_at?: string | null;  // 追加
  created_at: string;
}

export interface UserCache {
  student_id: string;
  name: string;
  department: string;
  grade: string;
  class_name: string;
  created_at: string;
  updated_at: string;
}

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
      department: '情報IT学科',
      grade: '2年',
      class_name: 'A組',
      checked_in_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      checked_out_at: new Date(Date.now() - 3600000).toISOString(), // 退室済み
      created_at: new Date(Date.now() - 3600000 * 2).toISOString()
    },
    {
      id: 2,
      student_id: '20261002',
      name: '佐藤 花子',
      department: '建築学科',
      grade: '1年',
      class_name: 'B組',
      checked_in_at: new Date(Date.now() - 1800000).toISOString(),
      checked_out_at: null, // 在室中
      created_at: new Date(Date.now() - 1800000).toISOString()
    },
    {
      id: 3,
      student_id: '20261003',
      name: '鈴木 一郎',
      department: '国際学科',
      grade: '3年',
      class_name: 'C組',
      checked_in_at: new Date(Date.now() - 600000).toISOString(),
      checked_out_at: null, // 在室中
      created_at: new Date(Date.now() - 600000).toISOString()
    }
  ];
}

if (!globalForMock.mockCache) {
  globalForMock.mockCache = [
    {
      student_id: '20261001',
      name: '山田 太郎',
      department: '情報IT学科',
      grade: '2年',
      class_name: 'A組',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      student_id: '20261002',
      name: '佐藤 花子',
      department: '建築学科',
      grade: '1年',
      class_name: 'B組',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      student_id: '20261003',
      name: '鈴木 一郎',
      department: '国際学科',
      grade: '3年',
      class_name: 'C組',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
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