import { cookies } from 'next/headers';
import i18next, { type i18n as I18nInstance } from 'i18next';
import zhCN from './locales/zh_cn.json';
import enUS from './locales/en_us.json';
import { LOCALE_COOKIE, normalizeLocale, toApiLocale } from './locale';

/**
 * Server 组件 / generateMetadata 专用翻译（server-only，客户端组件请用 react-i18next）。
 *
 * 与客户端 src/i18n/index.ts 相同的「中文原文作 key + 扁平字典」口径；
 * 不 import 客户端模块（'use client' 文件不能被 server 侧调用）。
 *
 * 内置资源只有 zh-CN / en-US；后台启用的其他语言（ko/ja/es/fr/ru/zh-Hant…）
 * 由 layout 在渲染前调用 loadServerLocale() 拉取并注册到对应语言的实例里，
 * 实例按语言缓存，互不串扰。
 */

const API_BASE = (process.env.PC_API_BASE || 'https://battery.recy.cc').replace(/\/$/, '');

const instances = new Map<string, I18nInstance>();

function getInstance(lng: string): I18nInstance {
  let instance = instances.get(lng);
  if (!instance) {
    instance = i18next.createInstance();
    instance.init({
      lng,
      fallbackLng: 'zh-CN',
      supportedLngs: false,
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

/** 拉取后台该语言的翻译并注册进服务端实例（fetch 自带 5 分钟 revalidate 缓存）。 */
export async function loadServerLocale(locale?: string | null): Promise<void> {
  const lng = normalizeLocale(locale);
  try {
    const response = await fetch(
      `${API_BASE}/api/common/i18n/getLocaleTranslations?localeCode=${encodeURIComponent(toApiLocale(lng))}`,
      { next: { revalidate: 300 } },
    );
    const json = await response.json();
    const data = json?.data || {};
    const map = Object.fromEntries(
      Object.entries(data).filter(([key, value]) => key && typeof value === 'string' && value),
    );
    if (Object.keys(map).length) {
      getInstance(lng).addResourceBundle(lng, 'translation', map as Record<string, string>, true, true);
    }
  } catch {
    /* 拉取失败时退回内置 zh/en 资源 */
  }
}

export type ServerT = (key: string, params?: Record<string, string | number>) => string;

/** 读 locale cookie，返回该请求语言的同步 t()。只能在请求作用域内调用。 */
export function getServerT(): ServerT {
  const lng = normalizeLocale(cookies().get(LOCALE_COOKIE)?.value);
  const instance = getInstance(lng);
  return ((key: string, params?: Record<string, string | number>) =>
    instance.t(key, params) as string) as ServerT;
}
