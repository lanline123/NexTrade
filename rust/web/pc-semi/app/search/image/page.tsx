'use client';

/**
 * 以图搜图（PC）
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/search/image.vue
 * 接口（旧版 api/search/imageSearch.ts，Rust 已迁移）：
 * - GET  /api/search/image/capabilities            能力开关（enabled/pcEnabled/formats）
 * - POST /api/search/image/search  multipart(file, client=pc, size=30) → { searchToken }
 * - POST /api/search/search/getProduct  body { searchToken, ...筛选/排序/分页 } → { records, total }
 * - POST /api/search/search/getFilter   body { searchToken, ... } → { filter: { brand, category } }
 *
 * 游客携带 X-Image-Search-Session（同一会话内上传/筛选/翻页保持一致）；登录态由后端按 token 识别。
 * 错误码：40001 图搜会话过期（需原图重传）、403 功能已关闭、-1 取消、-2 超时。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Toast, Typography } from '@douyinfe/semi-ui';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';

const PAGE_SIZE = 30;
const GUEST_SESSION_KEY = 'imageSearchGuestSession';
const PREVIEW_KEY = 'imageSearchPreview';

interface Capabilities {
  enabled?: boolean;
  pcEnabled?: boolean;
  formats?: string[];
}

interface UploadResult {
  searchToken?: string;
  records?: ProductRecord[];
  total?: number;
  hasMore?: boolean;
  nextCursor?: number;
  candidateInfo?: unknown;
}

interface ImageSearchError {
  code: number;
  message: string;
}

interface ProductRecord {
  productId?: number;
  productName?: string;
  productPrice?: number | string;
  marketPrice?: number | string;
  picThumb?: string;
  picUrl?: string;
  seoLink?: string;
  productSn?: string;
  sales?: number | string;
}

interface FilterBrand {
  id?: string | number;
  brandId?: string | number;
  brandName?: string;
  name?: string;
  firstWord?: string;
}

interface FilterCategory {
  id?: string | number;
  categoryId?: string | number;
  categoryName?: string;
  name?: string;
}

interface FilterEnvelope {
  filter?: {
    brand?: FilterBrand[];
    brands?: FilterBrand[];
    category?: FilterCategory[];
    categories?: FilterCategory[];
  };
}

const SORTS = [
  { key: 'default', label: '默认', sort: '', order: '' },
  { key: 'sale', label: '销量', sort: 'sale', order: 'desc' },
  { key: 'price-asc', label: '价格 ↑', sort: 'price', order: 'asc' },
  { key: 'price-desc', label: '价格 ↓', sort: 'price', order: 'desc' },
  { key: 'time', label: '最新', sort: 'time', order: 'desc' },
];

function readQueryParam(name: string): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(name) || '';
}

function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const headers: Record<string, string> = {};
  const token = localStorage.getItem('accessToken');
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    let session = sessionStorage.getItem(GUEST_SESSION_KEY) || '';
    if (!/^[A-Za-z0-9_-]{16,80}$/.test(session)) {
      session = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
      sessionStorage.setItem(GUEST_SESSION_KEY, session);
    }
    if (!token) headers['X-Image-Search-Session'] = session;
  } catch {
    // 隐私模式禁用 storage 时后端按匿名处理
  }
  return headers;
}

async function requestJson<T>(path: string, options: { method?: 'GET' | 'POST'; body?: unknown; form?: FormData } = {}): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: options.method || 'POST',
    credentials: 'include',
    headers: options.form ? authHeaders() : { 'Content-Type': 'application/json', ...authHeaders() },
    body: options.form || (options.body === undefined ? undefined : JSON.stringify(options.body)),
  });
  const text = await response.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw { code: 0, message: `接口返回格式异常（HTTP ${response.status}）` } as ImageSearchError;
  }
  if (!response.ok || (json.code !== undefined && json.code !== 0)) {
    throw { code: Number(json.code ?? response.status), message: String(json.msg || json.message || `请求失败（HTTP ${response.status}）`) } as ImageSearchError;
  }
  return (json.data ?? json) as T;
}

function errorText(error: unknown): string {
  const item = error as ImageSearchError;
  if (item?.code === -1) return '已取消搜索';
  if (item?.code === -2) return '图搜请求超时，请稍后重试';
  if (item?.code === 403) return '以图搜图功能已关闭';
  if (item?.code === 40001) return '原图已过期，请重新上传图片搜索';
  return item?.message || '以图搜图失败';
}

export default function ImageSearchPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(true);
  const [preview, setPreview] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [records, setRecords] = useState<ProductRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [brand, setBrand] = useState('');
  const [cat, setCat] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [sortKey, setSortKey] = useState('default');
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState('');

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const available = Boolean(capabilities?.enabled && capabilities?.pcEnabled !== false);
  const formats = (capabilities?.formats?.length ? capabilities.formats : ['JPEG', 'PNG', 'WEBP', 'BMP']).join(' / ');

  const loadFilter = useCallback(async (searchToken: string, options?: { brand?: string; cat?: string; min?: string; max?: string }) => {
    if (!searchToken) return;
    setFilterLoading(true);
    try {
      const body: Record<string, unknown> = { searchToken, brand: options?.brand || undefined, cat: options?.cat || undefined, min: options?.min || undefined, max: options?.max || undefined };
      const result = await requestJson<FilterEnvelope>('search/search/getFilter', { body });
      const filter = result?.filter || {};
      const brandList = (Array.isArray(filter.brand) && filter.brand) || (Array.isArray(filter.brands) && filter.brands) || [];
      const categoryList = (Array.isArray(filter.category) && filter.category) || (Array.isArray(filter.categories) && filter.categories) || [];
      setBrands(brandList.map((item) => ({ id: String(item?.id ?? item?.brandId ?? ''), name: String(item?.brandName ?? item?.name ?? '') })).filter((item) => item.id && item.name));
      setCategories(categoryList.map((item) => ({ id: String(item?.id ?? item?.categoryId ?? ''), name: String(item?.categoryName ?? item?.name ?? '') })).filter((item) => item.id && item.name));
    } catch (caught) {
      const item = caught as ImageSearchError;
      if (item?.code === 40001 || item?.code === 403) setError(errorText(caught));
    } finally {
      setFilterLoading(false);
    }
  }, []);

  const loadResults = useCallback(async (searchToken: string, nextPage: number, options?: { brand?: string; cat?: string; min?: string; max?: string; sortKey?: string }) => {
    if (!searchToken) return;
    setLoading(true);
    setError('');
    try {
      const currentSort = SORTS.find((item) => item.key === (options?.sortKey || 'default')) || SORTS[0];
      const body: Record<string, unknown> = {
        searchToken,
        page: nextPage,
        size: PAGE_SIZE,
        brand: options?.brand || undefined,
        cat: options?.cat || undefined,
        min: options?.min || undefined,
        max: options?.max || undefined,
        sort: currentSort.sort || undefined,
        order: currentSort.order || undefined,
      };
      const result = await requestJson<{ records?: ProductRecord[]; total?: number }>('search/search/getProduct', { body });
      setRecords(Array.isArray(result?.records) ? result.records : []);
      setTotal(Number(result?.total || 0));
      setSearched(true);
      if (!result?.records?.length) Toast.info({ content: '没有找到相似商品' });
    } catch (caught) {
      const item = caught as ImageSearchError;
      setError(errorText(caught));
      if (item?.code === 40001 || item?.code === 403) {
        setToken('');
        window.history.replaceState(null, '', '/search/image');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await requestJson<Capabilities>('search/image/capabilities', { method: 'GET' });
        if (!cancelled) setCapabilities(result || null);
      } catch (caught) {
        if (!cancelled) setError(errorText(caught));
      } finally {
        if (!cancelled) setCapabilitiesLoading(false);
      }
    })();
    const urlToken = readQueryParam('searchToken') || readQueryParam('token');
    if (urlToken) {
      setToken(urlToken);
      try {
        const saved = sessionStorage.getItem(PREVIEW_KEY);
        if (saved) setPreview(saved);
      } catch {
        // ignore
      }
      void loadFilter(urlToken);
      void loadResults(urlToken, 1);
    }
    return () => {
      cancelled = true;
    };
  }, [loadFilter, loadResults]);

  const pick = () => {
    if (!available) return;
    inputRef.current?.click();
  };

  const upload = async (file: File) => {
    setLoading(true);
    setSearched(false);
    setRecords([]);
    setTotal(0);
    setBrand('');
    setCat('');
    setPriceMin('');
    setPriceMax('');
    setSortKey('default');
    setPage(1);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('client', 'pc');
      form.append('size', String(PAGE_SIZE));
      const shopId = readQueryParam('shopId');
      if (shopId) form.append('shopId', shopId);
      const result = await requestJson<UploadResult>('search/image/search', { form });
      const searchToken = String(result?.searchToken || '');
      if (searchToken) {
        // Java 版接口：先上传换 searchToken，再分页/筛选查询。
        setToken(searchToken);
        window.history.replaceState(null, '', `/search/image?searchToken=${encodeURIComponent(searchToken)}`);
        await Promise.all([loadFilter(searchToken), loadResults(searchToken, 1)]);
      } else if (Array.isArray(result?.records)) {
        // Rust 当前实现：上传即返回相似商品（searchToken 恒为空串，/search/image/results 也返回空），
        // 直接渲染本次召回，不请求后续分页/筛选接口（后端未保存图搜会话）。
        setToken('');
        setRecords(result.records);
        setTotal(Number(result.total ?? result.records.length));
        setSearched(true);
        if (!result.records.length) Toast.info({ content: '没有找到相似商品' });
      } else {
        throw { code: 0, message: '图搜会话创建失败（接口未返回 searchToken 或 records）' } as ImageSearchError;
      }
    } catch (caught) {
      setError(errorText(caught));
      Toast.error({ content: errorText(caught) });
    } finally {
      setLoading(false);
    }
  };

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const formatOk = /^image\/(jpeg|png|webp|bmp|gif|tiff)$/.test(file.type) || file.type.startsWith('image/');
    if (!formatOk) {
      Toast.warning({ content: `请选择 ${formats} 格式图片` });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      Toast.warning({ content: '图片不能超过 4MB' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setPreview(dataUrl);
      try {
        sessionStorage.setItem(PREVIEW_KEY, dataUrl);
      } catch {
        // ignore
      }
    };
    reader.readAsDataURL(file);
    void upload(file);
  };

  const applyFilter = async (next: { brand?: string; cat?: string; min?: string; max?: string; sortKey?: string }) => {
    if (!token) return;
    const nextBrand = next.brand !== undefined ? next.brand : brand;
    const nextCat = next.cat !== undefined ? next.cat : cat;
    const nextMin = next.min !== undefined ? next.min : priceMin;
    const nextMax = next.max !== undefined ? next.max : priceMax;
    const nextSort = next.sortKey !== undefined ? next.sortKey : sortKey;
    setBrand(nextBrand);
    setCat(nextCat);
    setPriceMin(nextMin);
    setPriceMax(nextMax);
    setSortKey(nextSort);
    setPage(1);
    await loadResults(token, 1, { brand: nextBrand, cat: nextCat, min: nextMin, max: nextMax, sortKey: nextSort });
  };

  const changePage = async (nextPage: number) => {
    if (!token) return;
    setPage(nextPage);
    await loadResults(token, nextPage, { brand, cat, min: priceMin, max: priceMax, sortKey });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const reset = () => {
    setPreview('');
    setToken('');
    setRecords([]);
    setTotal(0);
    setSearched(false);
    setError('');
    setBrands([]);
    setCategories([]);
    try {
      sessionStorage.removeItem(PREVIEW_KEY);
    } catch {
      // ignore
    }
    window.history.replaceState(null, '', '/search/image');
  };

  return (
    <main className="pc-static-page">
      <PcHeader />
      <div className="pc-container">
        <nav className="pc-breadcrumb">
          <Link href="/">首页</Link><span>/</span><Link href="/search">搜索</Link><span>/</span><span>以图搜图</span>
        </nav>
        <h1 className="pc-cart-title">以图搜图</h1>

        {capabilitiesLoading ? (
          <Card className="pc-image-search">正在检查图搜能力...</Card>
        ) : !available ? (
          <Card className="pc-image-search">
            <p style={{ color: '#666' }}>以图搜图功能未开启，请先在后台开启「图像搜索」并配置 PC 端。</p>
            <Link href="/search"><Button>返回商品搜索</Button></Link>
          </Card>
        ) : (
          <Card className="pc-image-search">
            <div className="pc-image-search__box" onClick={pick} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') pick(); }}>
              {preview ? <img src={preview} alt="搜索图片" /> : <span>点击上传商品图片<br /><small>支持 {formats}，最大 4MB</small></span>}
            </div>
            <input ref={inputRef} type="file" accept="image/*" hidden onChange={onChange} />
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <Button theme="solid" type="primary" loading={loading} onClick={pick}>{loading ? '搜索中...' : preview ? '重新选择图片' : '选择图片搜索'}</Button>
              {token || preview ? <Button onClick={reset}>重新搜索</Button> : null}
            </div>
            {error ? <p style={{ color: '#cc0c1c', marginTop: 10 }}>{error}</p> : null}
          </Card>
        )}

        {/* 筛选（图搜结果复用 search/search/getFilter，条件在本次图片召回范围内生效） */}
        {token && (brands.length || categories.length) ? (
          <Card style={{ marginTop: 16 }} loading={filterLoading}>
            {categories.length ? (
              <div className="pc-search-filter-row">
                <span className="pc-search-filter-row__label">分类：</span>
                <div className="pc-search-filter-row__values">
                  <button type="button" onClick={() => void applyFilter({ cat: '' })} className={!cat ? 'is-active' : ''} style={{ border: 0, background: 'transparent', cursor: 'pointer' }}>全部</button>
                  {categories.map((item) => (
                    <button key={item.id} type="button" onClick={() => void applyFilter({ cat: item.id })} className={cat === item.id ? 'is-active' : ''} style={{ border: 0, background: 'transparent', cursor: 'pointer' }}>{item.name}</button>
                  ))}
                </div>
              </div>
            ) : null}
            {brands.length ? (
              <div className="pc-search-filter-row">
                <span className="pc-search-filter-row__label">品牌：</span>
                <div className="pc-search-filter-row__values">
                  {brands.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void applyFilter({ brand: brand === item.id ? '' : item.id })}
                      className={brand === item.id ? 'is-active' : ''}
                      style={{ border: 0, background: 'transparent', cursor: 'pointer' }}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="pc-list-toolbar">
              <div className="pc-list-sorts">
                {SORTS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => void applyFilter({ sortKey: item.key })}
                    className={sortKey === item.key ? 'is-active' : ''}
                    style={{ border: 0, background: 'transparent', cursor: 'pointer' }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <form
                className="pc-search-price-form"
                onSubmit={(event) => { event.preventDefault(); void applyFilter({}); }}
              >
                <input type="text" value={priceMin} onChange={(event) => setPriceMin(event.target.value)} placeholder="最低价" className="pc-search-price-input" />
                <span>-</span>
                <input type="text" value={priceMax} onChange={(event) => setPriceMax(event.target.value)} placeholder="最高价" className="pc-search-price-input" />
                <button type="submit">确定</button>
              </form>
            </div>
          </Card>
        ) : null}

        {searched || token || records.length ? (
          <>
            <Typography.Title heading={4} style={{ margin: '24px 0 12px' }}>相似商品{total ? `（${total}）` : ''}</Typography.Title>
            {records.length ? (
              <div className="pc-product-grid">
                {records.map((item) => (
                  <Link key={item.productId} href={item.seoLink || `/product/${item.productId}`} className="pc-product-grid__card">
                    <div className="pc-product-grid__image">
                      <img src={item.picThumb || item.picUrl || ''} alt={item.productName || ''} />
                    </div>
                    <div className="pc-product-grid__name">{item.productName || '商品'}</div>
                    {item.productSn ? <div style={{ color: '#999', fontSize: 12 }}>货号：{item.productSn}</div> : null}
                    <div className="pc-product-grid__bottom">¥ {Number(item.productPrice || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
                  </Link>
                ))}
              </div>
            ) : loading ? (
              <p style={{ color: '#999', padding: '16px 0' }}>正在通过图片检索相似商品...</p>
            ) : (
              <p className="pc-search-empty">没有找到相似商品，试试更换图片或调整筛选条件</p>
            )}
            {pages > 1 ? (
              <nav className="pc-pagination">
                {page > 1 ? <button type="button" onClick={() => void changePage(page - 1)}>上一页</button> : <span className="is-disabled">上一页</span>}
                {Array.from({ length: Math.min(pages, 8) }).map((_, index) => {
                  const next = index + 1;
                  return (
                    <button key={next} type="button" className={next === page ? 'is-active' : ''} onClick={() => void changePage(next)}>
                      {next}
                    </button>
                  );
                })}
                {page < pages ? <button type="button" onClick={() => void changePage(page + 1)}>下一页</button> : <span className="is-disabled">下一页</span>}
              </nav>
            ) : null}
          </>
        ) : null}
      </div>
      <PcFooter />
    </main>
  );
}
