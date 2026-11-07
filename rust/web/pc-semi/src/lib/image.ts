/**
 * 图片地址格式化（移植旧版 view/pc/utils/format.ts imageFormat）。
 *
 * 非完整 http(s) 的相对路径拼接 storageUrl（后台 base 配置下发）。
 * storageUrl 由服务端 layout bootstrap 调 setStorageUrl() 注入模块缓存；
 * 客户端组件通过 fetchBaseConfig() 拉取后同样注入。
 */

let STORAGE_URL = '';

export function setStorageUrl(url: string | undefined | null) {
  STORAGE_URL = (url || '').trim();
  // 后台常配置为无尾斜杠域名，拼接时统一补齐
  if (STORAGE_URL && !STORAGE_URL.endsWith('/')) {
    STORAGE_URL += '/';
  }
}

export function getStorageUrl(): string {
  return STORAGE_URL;
}

export function imageFormat(path: string | undefined | null, storageUrl?: string): string {
  if (!path) {
    return '';
  }
  const base = storageUrl !== undefined ? storageUrl : STORAGE_URL;
  return path.includes('http') ? path : base + path;
}
