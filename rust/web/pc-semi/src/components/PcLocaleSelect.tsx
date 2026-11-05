'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Translate from '@icon-park/react/es/icons/Translate';
import Down from '@icon-park/react/es/icons/Down';
import { normalizeLocale, writeLocaleCookie } from '@/i18n';

type LocaleItem = { localeCode: string; language: string; isDefault?: number };

export default function PcLocaleSelect({ className = '' }: { className?: string }) {
  const { i18n } = useTranslation();
  const [locales, setLocales] = useState<LocaleItem[]>([]);
  const [code, setCode] = useState('');
  const [open, setOpen] = useState(false);

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

  const label = code ? code.toUpperCase() : '';

  return (
    <div className={`lang-change ${className}`.trim()} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className="lang-box" aria-label="切换语言" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Translate className="language" size={20} />
        <span className="lang-text">{label}</span>
        <Down className={`arrow${open ? ' rotate' : ''}`} size={14} />
      </button>
      {open ? (
        <div className="lang-popover">
          <div className="common-title">语言</div>
          <div className="lang-list show-lang">
            {locales.map((item) => (
              <button
                key={item.localeCode}
                type="button"
                className={`lang-item${item.localeCode === code ? ' is-active' : ''}`}
                onClick={() => {
                  setCode(item.localeCode);
                  writeLocaleCookie(item.localeCode);
                  void i18n.changeLanguage(normalizeLocale(item.localeCode));
                  window.location.reload();
                }}
              >
                {item.language} - {item.localeCode.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
