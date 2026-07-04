import { cleanAlphanumeric } from '@/utils/cleansing';

export const STUDENT_ID_DIGITS = 7;
export const STAFF_ID_DIGITS = 3;

export const STUDENT_ID_REGEX = new RegExp(`^\\d{${STUDENT_ID_DIGITS}}$`);
export const STAFF_ID_REGEX = new RegExp(`^T\\d{${STAFF_ID_DIGITS}}$`);
export const VALID_ID_REGEX = new RegExp(`^(?:${STUDENT_ID_REGEX.source}|${STAFF_ID_REGEX.source})$`);

export function normalizeIdInput(value: string): string {
  if (typeof value !== 'string') return '';

  return cleanAlphanumeric(value).trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidStudentId(value: string): boolean {
  return STUDENT_ID_REGEX.test(normalizeIdInput(value));
}

export function isValidStaffId(value: string): boolean {
  return STAFF_ID_REGEX.test(normalizeIdInput(value));
}

export function isValidStudentOrStaffId(value: string): boolean {
  const normalized = normalizeIdInput(value);
  return STUDENT_ID_REGEX.test(normalized) || STAFF_ID_REGEX.test(normalized);
}

export function getIdFormatHint(lang: 'ja' | 'en' = 'ja'): string {
  return lang === 'en'
    ? `Please enter a ${STUDENT_ID_DIGITS}-digit student number or a staff ID in the format T${'0'.repeat(STAFF_ID_DIGITS)}.`
    : `学籍番号は${STUDENT_ID_DIGITS}桁、教職員番号はT+${STAFF_ID_DIGITS}桁で入力してください。`;
}
