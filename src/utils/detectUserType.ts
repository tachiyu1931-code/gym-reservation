export type DetectedUserType = 'student' | 'staff' | 'unknown';

export function detectUserType(id: string): DetectedUserType {
  const normalizedId = id.trim().toUpperCase();

  if (/^\d{7}$/.test(normalizedId)) {
    return 'student';
  }

  if (/^T\d+$/.test(normalizedId)) {
    return 'staff';
  }

  return 'unknown';
}