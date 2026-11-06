import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next, useTranslation } from 'react-i18next';
import { ConfigProvider } from '@douyinfe/semi-ui';
import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  getLocaleDefinition,
  getSemiLocale,
  normalizeLocale,
  type LocaleCode,
} from './config';
import { ensureTranslation } from './loader';

export type Locale = LocaleCode;

i18n.use(initReactI18next).init({
  resources: {},
  lng: DEFAULT_LOCALE,
  fallbackLng: [FALLBACK_LOCALE, DEFAULT_LOCALE],
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

function resolveInitialLocale(): LocaleCode {
  try {
    const saved = localStorage.getItem('app-locale');
    if (saved) return normalizeLocale(saved);
  } catch {
    // ignore storage failure
  }
  if (typeof navigator !== 'undefined') {
    return normalizeLocale(navigator.languages?.[0] || navigator.language);
  }
  return DEFAULT_LOCALE;
}

function applyLocaleAttributes(code: LocaleCode): void {
  const definition = getLocaleDefinition(code);
  document.documentElement.setAttribute('lang', definition.intl);
  document.documentElement.setAttribute('dir', definition.dir);
}

async function activateLocale(code: LocaleCode): Promise<LocaleCode> {
  const normalized = normalizeLocale(code);
  const loaded = await ensureTranslation(i18n, normalized);
  const target = loaded ? normalized : DEFAULT_LOCALE;
  await ensureTranslation(i18n, DEFAULT_LOCALE);
  await i18n.changeLanguage(target);
  applyLocaleAttributes(target);
  return target;
}

export async function setLocale(next: LocaleCode): Promise<void> {
  const target = await activateLocale(next);
  try {
    localStorage.setItem('app-locale', target);
  } catch {
    // ignore storage failure
  }
  localeChannel?.postMessage(target);
}

export function getCurrentLocale(): LocaleCode {
  return normalizeLocale(i18n.language);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      const initial = resolveInitialLocale();
      const target = await activateLocale(initial);
      if (cancelled) return;
      try {
        if (target !== initial) localStorage.setItem('app-locale', target);
      } catch {
        // ignore storage failure
      }
      setReady(true);
    };
    void bootstrap();

    if (localeChannel) {
      localeChannel.onmessage = async (event: MessageEvent<LocaleCode>) => {
        if (typeof event.data !== 'string') return;
        const target = await activateLocale(event.data);
        try {
          localStorage.setItem('app-locale', target);
        } catch {
          // ignore storage failure
        }
      };
    }

    return () => {
      cancelled = true;
      if (localeChannel) localeChannel.onmessage = null;
    };
  }, []);

  if (!ready) {
    return (
      <div className="i18n-loading">
        <span className="i18n-loading-mark">N</span>
        <span className="i18n-loading-text">Loading…</span>
      </div>
    );
  }

  return (
    <I18nextProvider i18n={i18n}>
      <LocaleShell>{children}</LocaleShell>
    </I18nextProvider>
  );
}

function LocaleShell({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  return <ConfigProvider locale={getSemiLocale(locale) as never}>{children}</ConfigProvider>;
}

export function useI18n() {
  const { t, i18n: instance } = useTranslation();
  const locale = normalizeLocale(instance.language);
  const translate = useCallback(
    (key: string, params?: Record<string, string | number>) => t(key, params) as string,
    [t],
  );
  return useMemo(
    () => ({
      locale,
      dir: getLocaleDefinition(locale).dir,
      setLocale,
      t: translate,
    }),
    [locale, translate],
  );
}

export default i18n;
