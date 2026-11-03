import i18n from 'i18next';
import { getLocaleDefinition, normalizeLocale } from './config';

function localeCode(locale?: string): string {
  return getLocaleDefinition(locale || i18n.language).intl;
}

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
  locale?: string,
): string {
  return new Intl.NumberFormat(localeCode(locale), options).format(value);
}

export function formatCurrency(
  value: number,
  currency = 'CNY',
  locale?: string,
): string {
  return new Intl.NumberFormat(localeCode(locale), {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(
  value: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
  locale?: string,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(localeCode(locale), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options,
  }).format(date);
}

export function formatPercent(
  value: number,
  locale?: string,
): string {
  return new Intl.NumberFormat(localeCode(locale), {
    style: 'percent',
    maximumFractionDigits: 2,
  }).format(value);
}

export function currentIntlLocale(): string {
  return getLocaleDefinition(normalizeLocale(i18n.language)).intl;
}
