import { isValidStaffId, isValidStudentId, normalizeIdInput } from '@/lib/idFormat';

export type DetectedUserType = 'student' | 'staff' | 'unknown';

export function detectUserType(id: string): DetectedUserType {
  const normalizedId = normalizeIdInput(id);

  if (!normalizedId) return 'unknown';

  if (isValidStudentId(normalizedId)) {
    return 'student';
  }

  if (isValidStaffId(normalizedId)) {
    return 'staff';
  }

  return 'unknown';
}
