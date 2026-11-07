/**
 * 货币显示（对齐旧版 view/pc components/format/Price.vue + utils/format.ts priceFormat）。
 *
 * - 符号：跨境站取 cookie `currentCurrencyData.symbol`，否则后台 base 配置 `dollarSign`（SSR 注入）
 * - 换算：`amount * rate`（rate 来自同一 cookie），与旧版 Price.vue 完全一致
 * - SSR：layout bootstrap 调 setServerCurrency(dollarSign) 注入默认符号；客户端读 document.cookie。
 *   服务端 cookies() 与 document.cookie 同源同值，SSR 与 hydration 结果一致。
 */

interface CurrencyCookieData {
  symbol?: string;
  rate?: string | number;
}

let SSR_SYMBOL = '';
let SSR_RATE = 1;

/** layout 服务端 bootstrap 注入后台 base 配置的默认货币符号与换币 cookie 快照 */
export function setServerCurrency(symbol?: string | null, rate?: string | number | null) {
  if (symbol) SSR_SYMBOL = symbol;
  const parsedRate = Number(rate);
  if (Number.isFinite(parsedRate) && parsedRate > 0) {
    SSR_RATE = parsedRate;
  }
}

function readCookie(name: string): string {
  if (typeof document === 'undefined') return '';
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? match[1] : '';
}

export function readCurrencyCookie(): CurrencyCookieData | null {
  const raw = readCookie('currentCurrencyData');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as CurrencyCookieData;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/** 价格已自带货币符号时透传 */
const HAS_CURRENCY_SIGN = /[¥￥$€£]/;

/**
 * 格式化价格：符号 + 汇率换算 + 两位小数。
 * 返回纯文本（旧版 Price.vue 是 DOM 结构，新版调用处按需拆分）。
 */
export function formatPrice(value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  const text = String(value);
  if (HAS_CURRENCY_SIGN.test(text)) return text;
  const num = Number(value);
  if (!Number.isFinite(num)) return text;

  const cookie = typeof document !== 'undefined' ? readCurrencyCookie() : null;
  // SSR（document 不存在）用 layout 注入的服务端 cookie 快照；客户端读实时 cookie
  const symbol = (typeof document !== 'undefined' ? cookie?.symbol : SSR_SYMBOL) || SSR_SYMBOL || '¥';
  const rate = Number(typeof document !== 'undefined' ? cookie?.rate : SSR_RATE);
  const converted = Number.isFinite(rate) && rate > 0 ? num * rate : num;
  return `${symbol}${converted.toFixed(2)}`;
}
