'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeLocale, writeLocaleCookie } from '@/i18n';

type LocaleItem = { localeCode: string; language: string; isDefault?: number };

export default function PcLocaleSelect({ className = '' }: { className?: string }) {
  const { i18n } = useTranslation();
  const [locales, setLocales] = useState<LocaleItem[]>([]);
  const [code, setCode] = useState('');

  useEffect(() => {
    fetch('/api/common/i18n/getLocales')
      .then((response) => response.json())
      .then((json) => {
        const list: LocaleItem[] = Array.isArray(json?.data) ? json.data : [];
        setLocales(list);
        const fromCookie = document.cookie.match(/(?:^|; )locale=([^;]+)/)?.[1] || '';
        const current = list.find((item) => item.localeCode === fromCookie)
          || list.find((item) => item.isDefault === 1)
          || list[0];
        if (current) setCode(current.localeCode);
      })
      .catch(() => undefined);
  }, []);

  if (locales.length <= 1) return null;

  return (
    <select
      className={`pc-locale-select ${className}`.trim()}
      value={code}
      aria-label="切换语言"
      onChange={(event) => {
        const next = event.target.value;
        setCode(next);
        writeLocaleCookie(next);
        void i18n.changeLanguage(normalizeLocale(next));
      }}
    >
      {locales.map((item) => (
        <option key={item.localeCode} value={item.localeCode}>{item.language}</option>
      ))}
    </select>
  );
}
