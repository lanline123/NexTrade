/**
 * 商品原图批量下载（PC 渠道）。
 *
 * 逐项移植自 Java 跨境版 `view/pc/utils/productRawImageDownload.ts`，
 * 与后端 `GET /api/product/product/downloadRawImages` 契约对齐。
 * 三项配置由 `/api/common/config/initConfigSettings` 下发。
 */

export interface RawImageConfig {
  productRawImageDownloadEnabled?: unknown;
  productRawImageDownloadChannels?: unknown;
  productRawImageDownloadScopes?: unknown;
}

export interface RawImageContext {
  id: number;
  shopId?: number;
  nearestShopId?: number;
}

const CHANNELS = ['pc', 'h5', 'miniProgram', 'app'];
const SCOPES = ['main', 'sku', 'detail'];

export function normalizeRawImageConfig(value: RawImageConfig = {}) {
  const list = (input: unknown, allowed: string[]) =>
    Array.isArray(input)
      ? [...new Set(input.filter((item): item is string => typeof item === 'string' && allowed.includes(item)))]
      : [];
  return {
    productRawImageDownloadEnabled: value.productRawImageDownloadEnabled === 1 ? 1 : 0,
    productRawImageDownloadChannels: list(value.productRawImageDownloadChannels, CHANNELS),
    productRawImageDownloadScopes: list(value.productRawImageDownloadScopes, SCOPES),
  };
}

/** 与 Java `allowedScopes()` 的渠道归一保持一致。 */
export function canDownloadRawImages(config: RawImageConfig, client: string): boolean {
  const channel = ({ pc: 'pc', h5: 'h5', wechat: 'h5', miniProgram: 'miniProgram', app: 'app', android: 'app', ios: 'app' } as Record<string, string>)[client];
  const normalized = normalizeRawImageConfig(config);
  return !!channel && normalized.productRawImageDownloadEnabled === 1 && normalized.productRawImageDownloadChannels.includes(channel);
}

export function createRawImageContext(id: unknown, params: { shopId?: unknown; nearestShopId?: unknown } = {}): RawImageContext | null {
  const integer = (value: unknown) =>
    (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) && Number.isSafeInteger(Number(value));
  if (!integer(id) || Number(id) <= 0) return null;
  const context: RawImageContext = { id: Number(id) };
  for (const key of ['shopId', 'nearestShopId'] as const) {
    const value = params[key];
    if (integer(value) && Number(value) >= 0) context[key] = Number(value);
  }
  return context;
}

export class RawImageDownloadError extends Error {
  code?: number;
  serverMessage: boolean;
  constructor(message: string, code?: number, serverMessage = false) {
    super(message);
    this.name = 'RawImageDownloadError';
    this.code = code;
    this.serverMessage = serverMessage;
  }
}

export function rawImageDownloadUrl(prefix: string, context: RawImageContext): string {
  const valid = createRawImageContext(context.id, context);
  if (!valid) throw new RawImageDownloadError('商品信息尚未就绪，请重试');
  const query = Object.entries(valid).map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`).join('&');
  return `${prefix.replace(/\/+$/, '')}/product/product/downloadRawImages?${query}`;
}

export function rawImageFilename(disposition: string | null | undefined, id: number): string {
  let filename = '';
  const extended = disposition?.match(/(?:^|;)\s*filename\*\s*=\s*(?:"([^"]*)"|([^;]*))/i);
  const value = (extended?.[1] ?? extended?.[2] ?? '').trim();
  const utf8 = value.match(/^UTF-8'[^']*'(.*)$/i);
  if (utf8) {
    try { filename = decodeURIComponent(utf8[1]); } catch { /* 回退到 filename */ }
  }
  if (!filename) {
    const basic = disposition?.match(/(?:^|;)\s*filename\s*=\s*(?:"([^"]*)"|([^;]*))/i);
    filename = (basic?.[1] ?? basic?.[2] ?? '').trim();
  }
  filename = filename.replace(/[/\\:*?"<>|\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '_').replace(/^\.+|[. ]+$/g, '').slice(0, 180);
  if (!filename) return `product_${id}_raw_images.zip`;
  return /\.zip$/i.test(filename) ? filename : `${filename}.zip`;
}

export function parseRawImageError(text: string, status = 200): RawImageDownloadError {
  try {
    const body = JSON.parse(text.replace(/^\uFEFF/, ''));
    if (body && typeof body === 'object') {
      return new RawImageDownloadError(
        typeof body.message === 'string' && body.message ? body.message : '素材下载失败，请重试',
        Number(body.code) || status,
        !!body.message,
      );
    }
  } catch { /* 非 JSON 响应 */ }
  return new RawImageDownloadError(status === 401 ? '登录已失效，请重新登录' : '下载内容异常，请重试', status);
}

export function isZipHeader(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4;
}

export function hasZipEnd(bytes: Uint8Array): boolean {
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 5 && bytes[i + 3] === 6 &&
      i + 22 + bytes[i + 20] + (bytes[i + 21] << 8) === bytes.length) return true;
  }
  return false;
}

export async function validateRawImageBlob(blob: Blob, status: number, contentType: string, contentLength?: string | null): Promise<void> {
  const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  if (status !== 200 || /json/i.test(contentType) || !isZipHeader(head)) {
    throw parseRawImageError(await blob.slice(0, 65536).text(), status);
  }
  if (contentType && !/^(application\/(zip|x-zip-compressed|octet-stream))(\s*;|$)/i.test(contentType)) {
    throw new RawImageDownloadError('下载内容异常，请重试');
  }
  if ((contentLength && Number(contentLength) > 0 && Number(contentLength) !== blob.size) ||
    !hasZipEnd(new Uint8Array(await blob.slice(-65557).arrayBuffer()))) {
    throw new RawImageDownloadError('下载文件不完整，请重试');
  }
}

export async function fetchRawImageArchive(url: string, headers: Record<string, string>, signal: AbortSignal, id: number) {
  const response = await fetch(url, { method: 'GET', headers, signal, credentials: 'omit', redirect: 'error' });
  const blob = await response.blob();
  await validateRawImageBlob(blob, response.status, response.headers.get('content-type') || '',
    response.headers.get('content-encoding') ? null : response.headers.get('content-length'));
  return { blob, filename: rawImageFilename(response.headers.get('content-disposition'), id) };
}

export function saveRawImageBlob(blob: Blob, filename: string): () => void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const cleanup = () => URL.revokeObjectURL(url);
  try {
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
  } catch (error) {
    cleanup();
    throw error;
  } finally {
    anchor.remove();
  }
  return cleanup;
}
