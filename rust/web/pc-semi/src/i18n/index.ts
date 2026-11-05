'use client';

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCN from './locales/zh_cn.json';
import enUS from './locales/en_us.json';

export const LOCALE_COOKIE = 'locale';

export function normalizeLocale(locale?: string | null): string {
  const value = String(locale || '').toLowerCase();
  if (value.startsWith('en')) return 'en-US';
  if (value.startsWith('zh')) return 'zh-CN';
  return 'zh-CN';
}

export function readLocaleCookie(): string {
  if (typeof document === 'undefined') return 'zh-CN';
  return normalizeLocale(document.cookie.match(/(?:^|; )locale=([^;]+)/)?.[1]);
}

export function writeLocaleCookie(locale: string) {
  if (typeof document === 'undefined') return;
  const value = normalizeLocale(locale);
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
}

const resources = {
  'zh-CN': { translation: zhCN },
  'en-US': { translation: enUS },
};

const instance = i18n.createInstance();

void instance.use(initReactI18next).init({
  lng: 'zh-CN',
  fallbackLng: 'zh-CN',
  supportedLngs: ['zh-CN', 'en-US'],
  resources,
  // 现有代码以中文原文作为翻译 key，关闭分隔符解析避免「订单/详情」被拆成命名空间。
  keySeparator: false,
  nsSeparator: false,
  returnNull: false,
  returnEmptyString: false,
  interpolation: { escapeValue: false, prefix: '{', suffix: '}' },
  react: { useSuspense: false },
});

export interface BackendTranslationMap {
  [key: string]: string;
}

export async function loadBackendTranslations(locale: string): Promise<BackendTranslationMap> {
  try {
    const response = await fetch(`/api/common/i18n/getLocaleTranslations?localeCode=${encodeURIComponent(locale)}`, {
      credentials: 'include',
    });
    const json = await response.json();
    const data = json?.data || {};
    const entries = Object.entries(data).filter(([key, value]) => key && typeof value === 'string' && value) as Array<[string, string]>;
    if (!entries.length) return {};
    const map = Object.fromEntries(entries);
    instance.addResourceBundle(locale, 'translation', map, true, true);
    return map;
  } catch {
    return {};
  }
}

export default instance;
