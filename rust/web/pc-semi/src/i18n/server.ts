import { cookies } from 'next/headers';
import i18next, { type i18n as I18nInstance } from 'i18next';
import zhCN from './locales/zh_cn.json';
import enUS from './locales/en_us.json';

/**
 * Server 组件 / generateMetadata 专用翻译（server-only，客户端组件请用 react-i18next）。
 *
 * 与客户端 src/i18n/index.ts 相同的「中文原文作 key + 扁平字典」口径；
 * 不 import 客户端模块（'use client' 文件不能被 server 侧调用）。
 * 实例按语言缓存（语言只有 zh-CN / en-US 两种），资源内置、同步初始化，
 * 语言来自 locale cookie，与客户端 PcLocaleSelect 写入的 cookie 一致。
 */

const LOCALE_COOKIE = 'locale';

function normalizeLocale(locale?: string | null): string {
  const value = String(locale || '').toLowerCase();
  if (value.startsWith('en')) return 'en-US';
  return 'zh-CN';
}

const instances = new Map<string, I18nInstance>();

function getInstance(lng: string): I18nInstance {
  let instance = instances.get(lng);
  if (!instance) {
    instance = i18next.createInstance();
    instance.init({
      lng,
      fallbackLng: 'zh-CN',
      supportedLngs: ['zh-CN', 'en-US'],
      resources: {
        'zh-CN': { translation: zhCN as Record<string, string> },
        'en-US': { translation: enUS as Record<string, string> },
      },
      keySeparator: false,
      nsSeparator: false,
      returnNull: false,
      returnEmptyString: false,
      interpolation: { escapeValue: false, prefix: '{', suffix: '}' },
    });
    instances.set(lng, instance);
  }
  return instance;
}

export type ServerT = (key: string, params?: Record<string, string | number>) => string;

/** 读 locale cookie，返回该请求语言的同步 t()。只能在请求作用域内调用。 */
export function getServerT(): ServerT {
  const lng = normalizeLocale(cookies().get(LOCALE_COOKIE)?.value);
  const instance = getInstance(lng);
  return ((key: string, params?: Record<string, string | number>) =>
    instance.t(key, params) as string) as ServerT;
}
