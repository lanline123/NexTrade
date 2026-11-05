'use client';

/**
 * 头部语言/货币切换（源码：view/pc/components/locate/LanguageChangeNew.vue）
 *
 * 与源码对齐：
 * - 触发区 .lang-box(.white)（语言图标 + 当前语言/localeCode + 箭头，hover 展开，hideAfter 200ms）
 * - 弹层 CommonPopover（width 254 / padding 20 / 指定阴影）：
 *   语言区 .common-title「语言」+ .lang-list/.lang-item（radio）
 *   货币区 .common-title「货币」+ .currency-box（当前币种符号-名称 + 「更改货币」→ 选择器）
 * - 语言切换：有独立域名 → 直接跳该域名；否则写语言 Cookie + 清 cacheLang + 整页刷新
 * - 监听 storage.cacheLang 变化整页刷新（1s 内去重）
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Translate from '@icon-park/react/es/icons/Translate';
import Down from '@icon-park/react/es/icons/Down';
import { normalizeLocale, writeLocaleCookie } from '@/i18n';

interface LocaleItem {
  id?: number;
  localeCode: string;
  language: string;
  isEnabled?: number;
  isDefault?: number;
  /** 该语言的独立域名，不含协议与端口；未配置时为空串 */
  domain?: string;
}

interface CurrencyItem {
  id: number;
  isDefault: number;
  name: string;
  rate?: string;
  symbol: string;
}

const HIDE_DELAY_MS = 200;
const CURRENCY_COOKIE = 'currentCurrencyData';
const CURRENT_LANGUAGE_COOKIE = 'currentLanguage';

function readCookie(name: string): string {
  if (typeof document === 'undefined') return '';
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? match[1] : '';
}

function readCurrencyCookie(): CurrencyItem | null {
  const raw = readCookie(CURRENCY_COOKIE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as CurrencyItem;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function writeCurrencyCookie(currency: CurrencyItem): void {
  const value = encodeURIComponent(JSON.stringify(currency));
  document.cookie = `${CURRENCY_COOKIE}=${value}; path=/; max-age=31536000; SameSite=Lax`;
}

function writePlainCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
}

export default function PcLocaleSelect({
  isWhite = false,
  langLabelMode = 'language',
  className = '',
  showLang = true,
  showCurrency = true,
}: {
  isWhite?: boolean;
  langLabelMode?: 'language' | 'localeCode';
  className?: string;
  showLang?: boolean;
  showCurrency?: boolean;
}) {
  const { i18n, t } = useTranslation();
  const [locales, setLocales] = useState<LocaleItem[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyItem[]>([]);
  const [currency, setCurrency] = useState<CurrencyItem | null>(null);
  const [code, setCode] = useState('');
  const [open, setOpen] = useState(false);
  const [showSelectCurrency, setShowSelectCurrency] = useState(false);

  const timerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/common/i18n/getLocales')
      .then((response) => response.json())
      .then((json) => {
        const list: LocaleItem[] = Array.isArray(json?.data) ? json.data : [];
        const enabled = list.filter((item) => item.isEnabled === undefined || Number(item.isEnabled) !== 0);
        setLocales(enabled);
        const fromCookie = readCookie('locale') || readCookie('X-Locale-Code');
        const current = enabled.find((item) => item.localeCode === fromCookie)
          || enabled.find((item) => item.isDefault === 1)
          || enabled[0];
        if (current) setCode(current.localeCode);
      })
      .catch(() => undefined);

    fetch('/api/common/currency/getCurrency')
      .then((response) => response.json())
      .then((json) => {
        const list: CurrencyItem[] = Array.isArray(json?.data) ? json.data : [];
        setCurrencies(list);
        const stored = readCurrencyCookie();
        const current = (stored && list.find((item) => item.id === stored.id)) || list.find((item) => item.isDefault === 1) || list[0] || null;
        setCurrency(current);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (containerRef.current && target && !containerRef.current.contains(target)) {
        setOpen(false);
        setShowSelectCurrency(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  // storage.cacheLang 变化 → 整页刷新（1s 内去重，对齐源码 handleStorageChange）
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'cacheLang') return;
      const now = Date.now();
      const holder = window as Window & { __lang_reload_at?: number };
      if (holder.__lang_reload_at && now - holder.__lang_reload_at < 1000) return;
      holder.__lang_reload_at = now;
      window.location.reload();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const currentLanguageText = useMemo(() => {
    const activeLocale = String(code || '');
    if (langLabelMode === 'localeCode') return activeLocale ? activeLocale.toUpperCase() : readCookie(CURRENT_LANGUAGE_COOKIE);
    const matched = locales.find((item) => item.localeCode === activeLocale);
    return matched?.language || activeLocale.toUpperCase();
  }, [code, langLabelMode, locales]);

  const changeLocale = useCallback(
    (localeCode: string) => {
      if (!localeCode) return;
      if (localeCode === code) {
        setOpen(false);
        return;
      }
      const currentLang = locales.find((item) => item.localeCode === localeCode);
      const targetDomain = String(currentLang?.domain || '').trim();
      if (targetDomain) {
        // 源码：有独立域名时不写当前域 Cookie，直接跳目标域名（由目标站自行判定语言）
        const { protocol, pathname, search, hash } = window.location;
        window.location.href = `${protocol}//${targetDomain}${pathname}${search}${hash}`;
        return;
      }
      const next = normalizeLocale(localeCode);
      writeLocaleCookie(next);
      writePlainCookie(CURRENT_LANGUAGE_COOKIE, currentLang?.language || localeCode.toUpperCase());
      try {
        localStorage.removeItem('cacheLang');
      } catch {
        /* ignore */
      }
      setCode(localeCode);
      void i18n.changeLanguage(next);
      setOpen(false);
      window.location.reload();
    },
    [code, i18n, locales],
  );

  const changeCurrency = useCallback(
    (currencyId: number) => {
      const next = currencies.find((item) => item.id === currencyId);
      setShowSelectCurrency(false);
      if (!next) return;
      writeCurrencyCookie(next);
      setCurrency(next);
      window.location.reload();
    },
    [currencies],
  );

  const cancelClose = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  };
  const scheduleClose = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setOpen(false);
      setShowSelectCurrency(false);
    }, HIDE_DELAY_MS);
  };

  const supportedContent = showLang ? locales.length > 1 || (showCurrency && currencies.length > 0) : showCurrency && currencies.length > 0;
  if (!supportedContent) return null;

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
      <span
        className="lang-box-trigger"
        onClick={() => setOpen((value) => !value)}
        style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
      >
        <Translate className="language" size={20} />
        <div className="lang-text">{currentLanguageText}</div>
        <Down className={`arrow${open ? ' rotate' : ''}`} size={14} />
      </span>

      {open ? (
        <div className="pc-locale-popover">
          {showLang && locales.length > 0 ? (
            <>
              <div className="common-title">{t('语言')}</div>
              <div className={`lang-list${showCurrency ? '' : ' show-lang'}`}>
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
            </>
          ) : null}

          {showCurrency ? (
            <>
              <div className="common-title">{t('货币')}</div>
              <div className="currency-box">
                {!showSelectCurrency ? (
                  <>
                    <div className="currency-text">{currency ? `${currency.symbol} - ${t(currency.name || '')}` : ''}</div>
                    <div className="currency-btn" onClick={() => setShowSelectCurrency(true)}>
                      {t('更改货币')}
                    </div>
                  </>
                ) : (
                  <select
                    className="currency-select"
                    value={currency?.id ?? ''}
                    onChange={(event) => changeCurrency(Number(event.target.value))}
                  >
                    {currencies.map((item) => (
                      <option key={item.id} value={item.id}>
                        {`${t(item.name || '')} - ${item.symbol}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
