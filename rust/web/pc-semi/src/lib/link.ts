/**
 * 装修/导航链接统一解析工具。
 *
 * 移植旧版 view/pc/utils/format.ts 的 urlFormat + sanitizeLinkUrl + seo-url.ts，
 * 语义与旧版逐一对齐：
 * - sanitizeLinkUrl：协议白名单（http/https/mailto/tel），拦 javascript:/data: 等存储型 XSS；
 *   先剔除空白与控制字符再判协议，防 "java\tscript:" 绕过；协议相对地址（//host）不放行
 * - urlFormat：对象型装修链接（path=product/list/article/brand/coupon/shop/…）解析为站内路由
 * - 站内相对路径统一补前导 "/"（补斜杠必须在安全过滤之后，否则带控制字符的串会躲过协议检测）
 */

/** 允许出现在装修链接里的协议，其余（javascript:/data:/vbscript: 等）一律拦掉 */
const SAFE_LINK_PROTOCOL = /^(https?|mailto|tel):$/i;

/** 可直接使用的链接形态：带协议、协议相对、站内绝对路径、锚点、查询串 */
const DIRECT_LINK = /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#|\?)/i;

export function sanitizeLinkUrl(url: string | undefined | null): string {
  // 装修 picLink 常为 null/缺 path；resolveUrl 也可能回落 undefined，这里必须先挡空值
  if (url == null || typeof url !== 'string') {
    return '';
  }
  // 浏览器会忽略 URL 中的空白与控制字符，先剔除再判协议，避免 "java\tscript:" 这类绕过
  const cleaned = url.replace(/[\u0000-\u0020\u00a0\u2028\u2029]/g, '');
  if (!cleaned || cleaned.startsWith('//')) {
    return '';
  }
  const scheme = cleaned.match(/^[a-z][a-z0-9+.-]*:/i);
  if (scheme && !SAFE_LINK_PROTOCOL.test(scheme[0])) {
    return '';
  }
  return url;
}

function toInternalAbsolute(url: string): string {
  if (!url || DIRECT_LINK.test(url)) {
    return url;
  }
  return `/${url}`;
}

// ——————————————————————————————————————————————
// SEO 路径构造（移植 utils/seo-url.ts）
// ——————————————————————————————————————————————

const normalizeSeoPath = (value?: string | null) => {
  if (!value) {
    return '';
  }
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return '';
  }
  try {
    if (/^https?:\/\//i.test(trimmedValue)) {
      const parsedUrl = new URL(trimmedValue);
      return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}` || '/';
    }
    if (trimmedValue.startsWith('//')) {
      const parsedUrl = new URL(`https:${trimmedValue}`);
      return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}` || '/';
    }
  } catch {
    return '';
  }
  return trimmedValue.startsWith('/') ? trimmedValue : `/${trimmedValue}`;
};

const appendQuery = (path: string, query: Record<string, string | number | undefined | null>) => {
  if (!path) {
    return '';
  }
  const [pathname, search = ''] = path.split('?');
  const params = new URLSearchParams(search);
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    params.set(key, String(value));
  });
  const queryString = params.toString();
  const normalizedPath = pathname || '/';
  return queryString ? `${normalizedPath}?${queryString}` : normalizedPath;
};

const isSupportedPathPrefix = (path: string, allowedPrefixes: string[]) => {
  return allowedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`));
};

const resolveSeoPath = (
  seoLink: string | null | undefined,
  fallbackPath: string,
  options?: { allowedPrefixes?: string[] },
) => {
  const normalizedSeoPath = normalizeSeoPath(seoLink);
  if (!normalizedSeoPath) {
    return fallbackPath;
  }
  if (options?.allowedPrefixes?.length && !isSupportedPathPrefix(normalizedSeoPath, options.allowedPrefixes)) {
    return fallbackPath;
  }
  return normalizedSeoPath;
};

export const buildProductPath = ({
  seoLink,
  sn,
  skuId,
  type,
  grouponPromotionRecordId,
  shopId,
}: {
  seoLink?: string | null;
  sn?: string | number | null;
  skuId?: string | number | null;
  type?: string | null;
  grouponPromotionRecordId?: string | number | null;
  shopId?: string | number | null;
}) => {
  const fallbackPath = sn ? `/item/${sn}` : '';
  const basePath = resolveSeoPath(seoLink, fallbackPath, { allowedPrefixes: ['/item', '/product'] });
  return appendQuery(basePath, { skuId, type, grouponPromotionRecordId, shopId });
};

export const buildCategoryPath = ({
  seoLink,
  id,
  pId,
}: {
  seoLink?: string | null;
  id?: string | number | null;
  pId?: string | number | null;
}) => {
  const fallbackPath = id ? `/list/?cat=${id}` : '';
  const basePath = resolveSeoPath(seoLink, fallbackPath, { allowedPrefixes: ['/list', '/category'] });
  return appendQuery(basePath, { pId });
};

export const buildShopPath = ({
  seoLink,
  id,
}: {
  seoLink?: string | null;
  id?: string | number | null;
}) => {
  const fallbackPath = id ? `/shop/${id}` : '';
  return resolveSeoPath(seoLink, fallbackPath, { allowedPrefixes: ['/shop'] });
};

/** 店铺分组链接（移植 utils/shop-group.ts groupLinkUrl） */
function groupLinkUrl(link: { path?: string; groupIds?: unknown; id?: unknown; data?: Record<string, unknown> }): string {
  const raw = link.groupIds ?? (link.data as { groupIds?: unknown } | undefined)?.groupIds ?? [link.id ?? (link.data as { id?: unknown } | undefined)?.id];
  const values = Array.isArray(raw) ? raw : String(raw).split(',');
  const ids = [...new Set(values.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0 && id <= 2147483647))];
  if (!ids.length) return '';
  return (link.path === 'storeGroup' ? '/store/list' : '/shop/list') + '?groupIds=' + ids.join(',');
}

function resolveUrl(params: string | undefined | null | { path?: string; [key: string]: unknown }): string {
  if (params == null) {
    return '';
  }
  if (typeof params === 'string') {
    return params;
  }
  switch (params.path) {
    case 'product':
      return buildProductPath({
        seoLink: params.seoLink as string | null | undefined,
        sn: (params.sn ?? params.id) as string | number | null | undefined,
        skuId: params.skuId as string | number | null | undefined,
        type: params.type as string | null | undefined,
        grouponPromotionRecordId: params.grouponPromotionRecordId as string | number | null | undefined,
        shopId: params.shopId as string | number | null | undefined,
      });
    case 'exchange':
      return '/exchange/' + params.id;
    case 'list':
      return buildCategoryPath({
        seoLink: params.seoLink as string | null | undefined,
        id: params.id as string | number | null | undefined,
        pId: params.pId as string | number | null | undefined,
      });
    case 'article':
      // 咨询页面
      return '/article/news/list?articleId=' + params.id;
    case 'brand':
      // 品牌搜索
      return '/list?brand=' + params.id;
    case 'coupon':
      // 优惠券详情
      return '/coupon/list/?id=' + params.id;
    case 'shop':
      // 店铺页面
      return buildShopPath({
        seoLink: params.seoLink as string | null | undefined,
        id: params.id as string | number | null | undefined,
      });
    case 'shopGroup':
    case 'storeGroup':
      return groupLinkUrl(params);
    case 'store':
      return '/store/?id=' + params.id;
    case 'base': {
      // 基础页面：统一补前导 "/"，并去掉 link 自带的多余斜杠。
      // 首页配置常为 link:"/"，若直接拼接会得到 "//"，再被 sanitizeLinkUrl 当成协议相对地址拦成空串。
      const baseLink = String(params.link ?? '');
      if (!baseLink) return '';
      return `/${baseLink.replace(/^\/+/, '')}`;
    }
    case 'order':
      return `/member/order/info?id=${params.id}`;
    case 'custom': {
      // 自定义页面：外链原样返回；站内相对路径补前导 "/"（与 base 分支保持一致）。
      const customLink = String(params.link ?? '');
      if (!customLink) return '';
      // 必须按前缀判外链："javascript:alert('http://')" 这类串也会包含 http，不能用 indexOf 判
      return /^https?:\/\//i.test(customLink) ? customLink : `/${customLink.replace(/^\/+/, '')}`;
    }
    case 'storeInfo':
      return '/store/info?shopId=' + params.shopId;
    default:
      return typeof params.path === 'string' ? params.path : '';
  }
}

/** 链接格式化总入口：安全过滤 → 解析 → 补前导斜杠 */
export function urlFormat(params: string | undefined | null | { path?: string; [key: string]: unknown }): string {
  // 补前导斜杠必须放在安全过滤之后：否则 "java\tscript:alert(1)" 这类含控制字符的串会因开头被改成 "/" 而躲过协议检测
  return toInternalAbsolute(sanitizeLinkUrl(resolveUrl(params)));
}

/**
 * 导航/装修链接对象（{ link, appLink, path, id, data… }）→ 站内可跳转地址。
 * 组合 urlFormat：对象型走全量 path 分支，纯字符串走安全过滤 + 补斜杠。
 */
export function navLinkHref(item: { link?: unknown } | null | undefined): string {
  const link = item?.link;
  if (link == null) return '';
  if (typeof link === 'string') return urlFormat(link);
  if (typeof link === 'object') {
    const obj = link as Record<string, unknown>;
    // 对象带 path 分支信息 → 全量解析；只有 link 字符串 → 按自定义链接处理
    if (obj.path && obj.path !== 'custom') return urlFormat(obj as { path?: string });
    return urlFormat(String(obj.link ?? ''));
  }
  return '';
}
