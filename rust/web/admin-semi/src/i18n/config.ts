import ar from '@douyinfe/semi-ui/lib/es/locale/source/ar';
import enUS from '@douyinfe/semi-ui/lib/es/locale/source/en_US';
import es from '@douyinfe/semi-ui/lib/es/locale/source/es';
import fr from '@douyinfe/semi-ui/lib/es/locale/source/fr';
import jaJP from '@douyinfe/semi-ui/lib/es/locale/source/ja_JP';
import koKR from '@douyinfe/semi-ui/lib/es/locale/source/ko_KR';
import ruRU from '@douyinfe/semi-ui/lib/es/locale/source/ru_RU';
import zhCN from '@douyinfe/semi-ui/lib/es/locale/source/zh_CN';
import zhTW from '@douyinfe/semi-ui/lib/es/locale/source/zh_TW';

export type LocaleCode = string;
export type LocaleDirection = 'ltr' | 'rtl';

export interface LocaleDefinition {
  /** BCP 47 语言码，如 zh-CN / en / ja */
  code: LocaleCode;
  /** 中文显示名 */
  label: string;
  /** 语言自身的显示名 */
  nativeLabel: string;
  /** Intl 使用的地区码 */
  intl: string;
  /** 文本方向 */
  dir: LocaleDirection;
  /** Semi UI 语言包 */
  semiLocale: unknown;
  /** 是否已有翻译资源；新增 JSON 后改为 true 即可出现在切换菜单 */
  translated: boolean;
}

/**
 * 语言注册表：新增语言只需要
 * 1. 在 resources/{code}/translation.json 放翻译
 * 2. 在这里登记（translated 设为 true）
 * 不需要改 Provider、切换菜单或 Semi locale 逻辑。
 */
export const LOCALES: LocaleDefinition[] = [
  {
    code: 'zh-CN',
    label: '简体中文',
    nativeLabel: '简体中文',
    intl: 'zh-CN',
    dir: 'ltr',
    semiLocale: zhCN,
    translated: true,
  },
  {
    code: 'en',
    label: 'English',
    nativeLabel: 'English',
    intl: 'en-US',
    dir: 'ltr',
    semiLocale: enUS,
    translated: true,
  },
  {
    code: 'zh-Hant',
    label: '繁體中文',
    nativeLabel: '繁體中文',
    intl: 'zh-Hant',
    dir: 'ltr',
    semiLocale: zhTW,
    translated: false,
  },
  {
    code: 'ja',
    label: '日本語',
    nativeLabel: '日本語',
    intl: 'ja-JP',
    dir: 'ltr',
    semiLocale: jaJP,
    translated: false,
  },
  {
    code: 'ko',
    label: '한국어',
    nativeLabel: '한국어',
    intl: 'ko-KR',
    dir: 'ltr',
    semiLocale: koKR,
    translated: false,
  },
  {
    code: 'es',
    label: 'Español',
    nativeLabel: 'Español',
    intl: 'es-ES',
    dir: 'ltr',
    semiLocale: es,
    translated: false,
  },
  {
    code: 'fr',
    label: 'Français',
    nativeLabel: 'Français',
    intl: 'fr-FR',
    dir: 'ltr',
    semiLocale: fr,
    translated: false,
  },
  {
    code: 'ru',
    label: 'Русский',
    nativeLabel: 'Русский',
    intl: 'ru-RU',
    dir: 'ltr',
    semiLocale: ruRU,
    translated: false,
  },
  {
    code: 'ar',
    label: 'العربية',
    nativeLabel: 'العربية',
    intl: 'ar-SA',
    dir: 'rtl',
    semiLocale: ar,
    translated: false,
  },
];

export const DEFAULT_LOCALE: LocaleCode = 'zh-CN';
export const FALLBACK_LOCALE: LocaleCode = 'en';

const LEGACY_ALIASES: Record<string, LocaleCode> = {
  zh: 'zh-CN',
  'zh-hans': 'zh-CN',
  'zh-cn': 'zh-CN',
  'zh-hant': 'zh-Hant',
  'zh-tw': 'zh-Hant',
  'zh-hk': 'zh-Hant',
  en: 'en',
  'en-us': 'en',
  'en-gb': 'en',
  ja: 'ja',
  'ja-jp': 'ja',
  ko: 'ko',
  'ko-kr': 'ko',
  es: 'es',
  'es-es': 'es',
  fr: 'fr',
  'fr-fr': 'fr',
  ru: 'ru',
  'ru-ru': 'ru',
  ar: 'ar',
  'ar-sa': 'ar',
};

/** 兼容旧 localStorage（zh/en）、浏览器语言和地区码。 */
export function normalizeLocale(input?: string | null): LocaleCode {
  const raw = (input || '').trim();
  if (!raw) return DEFAULT_LOCALE;
  const exact = LOCALES.find((item) => item.code.toLowerCase() === raw.toLowerCase());
  if (exact) return exact.code;
  const alias = LEGACY_ALIASES[raw.toLowerCase()];
  if (alias) return alias;
  const prefix = raw.toLowerCase().split('-')[0];
  return LEGACY_ALIASES[prefix] || DEFAULT_LOCALE;
}

export function getLocaleDefinition(code?: string | null): LocaleDefinition {
  const normalized = normalizeLocale(code);
  return LOCALES.find((item) => item.code === normalized) || LOCALES[0];
}

export function getSemiLocale(code?: string | null): unknown {
  return getLocaleDefinition(code).semiLocale;
}

export function getLocaleDirection(code?: string | null): LocaleDirection {
  return getLocaleDefinition(code).dir;
}

/** 已经具备翻译资源、可以出现在语言菜单中的语言。 */
export function translatedLocales(): LocaleDefinition[] {
  return LOCALES.filter((item) => item.translated);
}

