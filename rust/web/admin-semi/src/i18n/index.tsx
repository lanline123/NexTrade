import React, { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next, useTranslation } from 'react-i18next';
import zh from './locales/zh';
import enExtra from './locales/en-extra';

export type Locale = 'zh' | 'en';

const ZH_MESSAGES = zh as Record<string, string>;
let englishLoaded = false;
let englishLoading: Promise<void> | null = null;

function readInitialLocale(): Locale {
  try {
    return localStorage.getItem('app-locale') === 'en' ? 'en' : 'zh';
  } catch {
    return 'zh';
  }
}

async function loadEnglish(): Promise<void> {
  if (englishLoaded) return;
  if (!englishLoading) {
    englishLoading = import('./locales/en').then((module) => {
      i18n.addResourceBundle('en', 'translation', { ...(module.default as Record<string, string>), ...enExtra }, true, true);
      englishLoaded = true;
    });
  }
  return englishLoading;
}

i18n.use(initReactI18next).init({
  resources: { zh: { translation: ZH_MESSAGES } },
  lng: 'zh',
  fallbackLng: 'zh',
  initAsync: false,
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false, prefix: '{', suffix: '}' },
  returnNull: false,
  react: { useSuspense: false },
});

let localeChannel: BroadcastChannel | null = null;
if (typeof BroadcastChannel !== 'undefined') {
  localeChannel = new BroadcastChannel('app-locale-sync');
}

export async function setLocale(next: Locale): Promise<void> {
  if (next === 'en') {
    await loadEnglish().catch(() => undefined);
  }
  await i18n.changeLanguage(next);
  document.documentElement.setAttribute('lang', next);
  try {
    localStorage.setItem('app-locale', next);
  } catch {
    // ignore storage failure
  }
  localeChannel?.postMessage(next);
}

export function getCurrentLocale(): Locale {
  return i18n.language === 'en' ? 'en' : 'zh';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const saved = readInitialLocale();
    document.documentElement.setAttribute('lang', saved);
    if (saved === 'en') {
      void loadEnglish().then(() => i18n.changeLanguage('en'));
    }
    if (localeChannel) {
      localeChannel.onmessage = (event: MessageEvent<Locale>) => {
        if (event.data !== 'zh' && event.data !== 'en') return;
        if (event.data === 'en') {
          void loadEnglish().then(() => i18n.changeLanguage('en'));
        } else {
          void i18n.changeLanguage('zh');
        }
      };
    }
    return () => {
      if (localeChannel) localeChannel.onmessage = null;
    };
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

export function useI18n() {
  const { t, i18n: instance } = useTranslation();
  const locale: Locale = instance.language === 'en' ? 'en' : 'zh';
  const translate = useCallback(
    (key: string, params?: Record<string, string | number>) => t(key, params) as string,
    [t],
  );
  return useMemo(
    () => ({
      locale,
      setLocale,
      t: translate,
    }),
    [locale, translate],
  );
}

export default i18n;
