export type DetectedUserType = 'student' | 'staff' | 'unknown';

export function detectUserType(id: string): DetectedUserType {
  const normalizedId = id.trim().toUpperCase();

  if (!normalizedId) return 'unknown';

  if (/^\d+$/.test(normalizedId)) {
    return 'student';
  }

  if (/[A-Z]/.test(normalizedId)) {
    return 'staff';
  }

  return 'unknown';
}
