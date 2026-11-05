'use client';

import { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n, { loadBackendTranslations, normalizeLocale, readLocaleCookie, writeLocaleCookie } from './index';

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let cancelled = false;
    const applyLocale = async (locale: string) => {
      const normalized = normalizeLocale(locale);
      if (i18n.language !== normalized) await i18n.changeLanguage(normalized);
      if (typeof document !== 'undefined') {
        document.documentElement.lang = normalized;
      }
      writeLocaleCookie(normalized);
      if (!cancelled) await loadBackendTranslations(normalized);
    };

    const initial = readLocaleCookie();
    void applyLocale(initial);

    const onLanguageChanged = (language: string) => {
      void applyLocale(language);
    };
    i18n.on('languageChanged', onLanguageChanged);
    return () => {
      cancelled = true;
      i18n.off('languageChanged', onLanguageChanged);
    };
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
