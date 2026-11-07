/**
 * 通用格式化工具（收敛各页面重复实现，2026-11-07 P2）。
 *
 * - unixToDateTime：秒级 Unix 时间戳 → `YYYY-MM-DD HH:mm:ss`，非法/<=0 返回 '--'
 * - unixToTimeShort：秒级 Unix 时间戳 → `YYYY-MM-DD HH:mm`，非法/<=0 返回 ''
 *   （FinanceMoreLists 原语义，表格留白）
 * - dateTimeValue：自适应秒/毫秒时间戳，非法返回 '--'，字符串原样返回
 */

const pad2 = (n: number) => String(n).padStart(2, '0');

const formatDate = (date: Date, withSeconds: boolean): string => {
  const base = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  return withSeconds ? `${base}:${pad2(date.getSeconds())}` : base;
};

export function unixToDateTime(value: unknown): string {
  const sec = Number(value);
  if (!Number.isFinite(sec) || sec <= 0) return '--';
  return formatDate(new Date(sec * 1000), true);
}

export function unixToTimeShort(value: unknown): string {
  const sec = Number(value || 0);
  if (!Number.isFinite(sec) || sec <= 0) return '';
  const date = new Date(sec * 1000);
  if (Number.isNaN(date.getTime())) return '';
  return formatDate(date, false);
}

export function dateTimeValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '--';
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return String(value);
  const date = new Date(num < 1e12 ? num * 1000 : num);
  if (Number.isNaN(date.getTime())) return String(value);
  return formatDate(date, true);
}
