'use client';

/**
 * 头部语言切换（源码：view/pc/components/locate/LanguageChangeNew.vue）
 *
 * 头部调用为 `class="item" is-white lang-label-mode="localeCode"`：
 * 触发区 .lang-box(.white)（语言图标 + 当前 localeCode + 箭头），
 * 弹层 .pc-locale-popover 内 .common-title「语言」+ .lang-list/.lang-item（radio）。
 *
 * 与源码一致：切换后写 locale Cookie 并整页刷新（源码另有 domain 跳转与货币切换，
 * 见 remaining gaps）。
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Translate from '@icon-park/react/es/icons/Translate';
import Down from '@icon-park/react/es/icons/Down';
import { normalizeLocale, writeLocaleCookie } from '@/i18n';

interface LocaleItem {
  localeCode: string;
  language: string;
  isDefault?: number;
}

function readLocaleCookie(): string {
  if (typeof document === 'undefined') return '';
  return document.cookie.match(/(?:^|; )locale=([^;]+)/)?.[1] || '';
}

export default function PcLocaleSelect({
  isWhite = false,
  langLabelMode = 'language',
  className = '',
}: {
  isWhite?: boolean;
  langLabelMode?: 'language' | 'localeCode';
  className?: string;
}) {
  const { i18n } = useTranslation();
  const [locales, setLocales] = useState<LocaleItem[]>([]);
  const [code, setCode] = useState('');
  const [open, setOpen] = useState(false);
  const timerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/common/i18n/getLocales')
      .then((response) => response.json())
      .then((json) => {
        const list: LocaleItem[] = Array.isArray(json?.data) ? json.data : [];
        setLocales(list);
        const fromCookie = readLocaleCookie();
        const current = list.find((item) => item.localeCode === fromCookie)
          || list.find((item) => item.isDefault === 1)
          || list[0];
        if (current) setCode(current.localeCode);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (containerRef.current && target && !containerRef.current.contains(target)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  if (locales.length <= 1) return null;

  const currentLanguageText = (() => {
    const activeLocale = String(code || '');
    if (langLabelMode === 'localeCode') return activeLocale ? activeLocale.toUpperCase() : '';
    const matched = locales.find((item) => item.localeCode === activeLocale);
    return matched?.language || activeLocale.toUpperCase();
  })();

  const changeLocale = (localeCode: string) => {
    if (!localeCode || localeCode === code) {
      setOpen(false);
      return;
    }
    const next = normalizeLocale(localeCode);
    writeLocaleCookie(next);
    setCode(localeCode);
    void i18n.changeLanguage(next);
    setOpen(false);
    window.location.reload();
  };

  const cancelClose = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  };
  const scheduleClose = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setOpen(false), 120);
  };

  return (
    <div
      ref={containerRef}
      className={`lang-box${isWhite ? ' white' : ''}${className ? ` ${className}` : ''}`}
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <span className="lang-box-trigger" onClick={() => setOpen((value) => !value)} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
        <Translate className="language" size={20} />
        <div className="lang-text">{currentLanguageText}</div>
        <Down className={`arrow${open ? ' rotate' : ''}`} size={14} />
      </span>

      {open ? (
        <div className="pc-locale-popover">
          <div className="common-title">语言</div>
          <div className="lang-list show-lang">
            {locales.map((item) => (
              <label key={item.localeCode} className="lang-item">
                <input
                  type="radio"
                  name="pc-locale"
                  value={item.localeCode}
                  checked={item.localeCode === code}
                  onChange={() => changeLocale(item.localeCode)}
                />
                <span className="lang-label">
                  {item.language} - {item.localeCode.toUpperCase()}
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
