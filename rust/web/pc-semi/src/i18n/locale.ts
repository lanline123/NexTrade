/**
 * 语言标识的纯函数工具（server / client 共用，不能带 'use client'）。
 *
 * 后台 localeCode 是短码：zh / zh-Hant / en / ko / ja / es / fr / ru。
 * 前端内部统一用 BCP47 形态（zh-CN / en-US / zh-Hant / ko ...），
 * 调用后台翻译接口时再映射回短码（接口不认 en-US / zh-CN）。
 */

export const LOCALE_COOKIE = 'locale';

export function normalizeLocale(locale?: string | null): string {
  const value = String(locale || '').trim();
  if (!value) return 'zh-CN';
  const lower = value.toLowerCase();
  if (lower.startsWith('en')) return 'en-US';
  if (lower.startsWith('zh-hant') || lower.startsWith('zh-tw') || lower.startsWith('zh-hk')) {
    return 'zh-Hant';
  }
  if (lower.startsWith('zh')) return 'zh-CN';
  // 其他语言原样保留（ko / ja / es / fr / ru ...）
  return value;
}

/** 内部语言标识 → 后台 getLocaleTranslations 的 localeCode。 */
export function toApiLocale(locale: string): string {
  const value = normalizeLocale(locale);
  if (value === 'zh-CN') return 'zh';
  if (value === 'en-US') return 'en';
  return value;
}
