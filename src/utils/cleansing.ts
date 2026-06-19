/**
 * Converts Zenkaku (full-width) alphanumeric characters to Hankaku (half-width),
 * and converts Zenkaku spaces to Hankaku spaces.
 */
export function cleanAlphanumeric(val: string): string {
  if (!val) return '';
  // Convert full-width alphanumeric to half-width
  let cleaned = val.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => {
    return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
  });
  // Convert full-width space to half-width space
  cleaned = cleaned.replace(/　/g, ' ');
  return cleaned;
}

/**
 * Cleans Student ID inputs: converts full-width numbers to half-width,
 * removes all non-numeric characters, and trims.
 */
export function cleanStudentId(val: string): string {
  const halfWidth = cleanAlphanumeric(val);
  return halfWidth.replace(/\D/g, '').trim();
}

/**
 * Cleans Class Name inputs: converts full-width letters/numbers to half-width,
 * converts alphabets to uppercase, and removes all whitespaces.
 */
export function cleanClassName(val: string): string {
  const halfWidth = cleanAlphanumeric(val);
  return halfWidth.replace(/\s+/g, '').toUpperCase();
}

/**
 * Cleans Student Name inputs: trims leading and trailing whitespaces.
 */
export function cleanName(val: string): string {
  if (!val) return '';
  return val.trim();
}
