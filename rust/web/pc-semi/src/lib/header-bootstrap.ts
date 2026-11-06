/**
 * PC 头部公共数据（服务端预取 → layout 内联 JSON → 客户端同步读取）
 *
 * 背景：Logo（common/config/base）、语言/货币（i18n/getLocales、currency/getCurrency）
 * 原先都要等 hydration 后再走两次浏览器 → Next → 后端请求，导致头部右侧模块先后出现。
 * 这里由 RootLayout 在服务端并发预取并内联，客户端 effect 直接应用，避免逐个加载。
 */
export const PC_HEADER_BOOTSTRAP_ID = 'pc-header-bootstrap';

export interface HeaderBootstrapLocale {
  id?: number;
  localeCode: string;
  language: string;
  isEnabled?: number;
  isDefault?: number;
  /** 该语言的独立域名，不含协议与端口；未配置时为空串 */
  domain?: string;
}

export interface HeaderBootstrapCurrency {
  id: number;
  isDefault: number;
  name: string;
  rate?: string;
  symbol: string;
}

export interface PcHeaderBootstrap {
  base: Record<string, any> | null;
  locales: HeaderBootstrapLocale[];
  currencies: HeaderBootstrapCurrency[];
}

let cached: PcHeaderBootstrap | null = null;

/**
 * 读取 layout 内联的 bootstrap。
 * SSR 阶段返回 null；客户端组件在 effect 中应用，避免 hydration 首帧不一致。
 */
export function readHeaderBootstrap(): PcHeaderBootstrap | null {
  if (cached) return cached;
  if (typeof document === 'undefined') return null;
  const raw = document.getElementById(PC_HEADER_BOOTSTRAP_ID)?.textContent;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PcHeaderBootstrap>;
    if (!parsed || typeof parsed !== 'object') return null;
    cached = {
      base: parsed.base && typeof parsed.base === 'object' ? (parsed.base as Record<string, any>) : null,
      locales: Array.isArray(parsed.locales) ? parsed.locales : [],
      currencies: Array.isArray(parsed.currencies) ? parsed.currencies : [],
    };
    return cached;
  } catch {
    return null;
  }
}