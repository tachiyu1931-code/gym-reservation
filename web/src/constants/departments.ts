export const DEPARTMENTS = [
  'ITスペシャリスト科',
  '高度情報処理科/ITエンジニア科',
  '情報システム科',
  'ゲームクリエイター科',
  '総合デザイン科/Web・CGデザイン科',
  '建築設計科/インテリアデザイン科',
  '建築士専攻科',
  'International IT Business Course(国際ITビジネス科)',
  '教職員'
] as const;

export type Department = typeof DEPARTMENTS[number];

export const DEPARTMENT_MAP: Record<string, Department> = {
  'ITスペシャリスト科': 'ITスペシャリスト科',
  '高度情報処理科/ITエンジニア科': '高度情報処理科/ITエンジニア科',
  '情報システム科': '情報システム科',
  'ゲームクリエイター科': 'ゲームクリエイター科',
  '総合デザイン科/Web・CGデザイン科': '総合デザイン科/Web・CGデザイン科',
  '建築設計科/インテリアデザイン科': '建築設計科/インテリアデザイン科',
  '建築士専攻科': '建築士専攻科',
  'International IT Business Course(国際ITビジネス科)': 'International IT Business Course(国際ITビジネス科)',
  '教職員': '教職員',
  '情報IT学科': 'ITスペシャリスト科',
  '情報IT科': 'ITスペシャリスト科',
  '建築学科': '建築設計科/インテリアデザイン科',
  '建築設計科': '建築設計科/インテリアデザイン科',
  'インテリアデザイン科': '建築設計科/インテリアデザイン科',
  '国際学科': 'International IT Business Course(国際ITビジネス科)',
  '国際ITビジネス科': 'International IT Business Course(国際ITビジネス科)',
  'International IT Buisiness Course(国際ITビジネス科)': 'International IT Business Course(国際ITビジネス科)',
};

export function normalizeDepartment(dept: string): string {
  if (!dept) return '';
  const trimmed = dept.trim();
  if (DEPARTMENT_MAP[trimmed]) {
    return DEPARTMENT_MAP[trimmed];
  }
  return trimmed;
}
