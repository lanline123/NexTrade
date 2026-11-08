/**
 * 秒级时间戳 → "yyyy-MM-dd HH:mm:ss"（对照旧版 TigUtils.handelTime，0/空 → 空串）。
 *
 * 背景：旧版 Java 的 UserCouponVO.startDate/endDate 是后端格式化好的字符串
 * （TigUtils.handelTime，"yyyy-MM-dd HH:mm:ss"）；Rust 版 UserCouponVO 里
 * 这两个字段是原始 i32 时间戳直接下发，前端需要在展示层补齐同样的格式。
 */
export function formatDateTime(seconds: number | string | undefined | null): string {
  const value = Number(seconds ?? 0);
  if (!Number.isFinite(value) || value <= 0) return '';
  const date = new Date(value * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
