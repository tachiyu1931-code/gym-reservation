/*
 全角入力された場合、半角に修正
 */
export function cleanAlphanumeric(val: string): string {
  if (!val) return '';
  let cleaned = val.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => {
    return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
  });
  // 全角スペースを半角スペースに変換
  cleaned = cleaned.replace(/　/g, ' ');
  return cleaned;
}

/**
 * 学籍番号の整形: 
 * 数字以外の文字列を切り取ります
 */
export function cleanStudentId(val: string): string {
  const halfWidth = cleanAlphanumeric(val);
  return halfWidth.replace(/\D/g, '').trim();
}

/**
 * クラス名の整形: クラス名が半角で入力されても、大文字に変換する。例）2b → 2B
 * 空白の削除。
 */
export function cleanClassName(val: string): string {
  const halfWidth = cleanAlphanumeric(val);
  return halfWidth.replace(/\s+/g, '').toUpperCase();
}

/**
 * 名前の入力で、スペースが紛れていた場合、削除。
 */
export function cleanName(val: string): string {
  if (!val) return '';
  return val.trim();
}
