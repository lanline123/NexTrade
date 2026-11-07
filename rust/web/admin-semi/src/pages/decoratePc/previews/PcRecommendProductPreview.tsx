/**
 * PC 推荐商品模块 - 预览组件（迁移自 java-b2b2c-overseas-v5.8.61
 * view/admin/src/views/decorate/decorate/editor/modules/pcHome/pc-recommend-product/Preview.vue）
 *
 * "标题 + 换行卡片列表"视觉结构对齐 Vort；取数逻辑对齐 Vort，
 * API 参数键按 Tigshop 约定映射（ids 逗号串 / categoryId / introType / size）。
 *
 * 与旧版差异：
 * 1. Vue -> React（props 统一 { data }，内部深合并默认值）；
 * 2. 旧版空图来自本地 png（@/assets/decorate/empty-img-bg.png），admin-semi 无该资源，
 *    使用同尺寸内联 SVG 占位图（与 PcDecorateEditor 现有预览一致）。
 */
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, SyntheticEvent } from 'react';
import { apiGet } from '../../../api';
import './pcRecommendProduct.css';

import i18nInstance, { useI18n } from '../../../i18n';

/** 非组件作用域的翻译：直接用 i18next 单例。 */
const tl = (key: string, params?: Record<string, string | number>) => i18nInstance.t(key, params) as string;
type AnyRecord = Record<string, any>;

interface ProductItem {
  productId?: number | string;
  productName?: string;
  productPrice?: number | string;
  picThumb?: string;
  picUrl?: string;
  picLarge?: string;
  brief?: string;
}

type PreviewProductItem = ProductItem & {
  id?: number | string;
  virtualSales?: number | string;
  isSeckill?: number | string;
  productStock?: number | string;
  seckillStock?: number | string;
  price?: number | string;
  shopTitle?: string;
  shop?: { shopTitle?: string } | null;
};

const EMPTY_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f2f4f6' width='100' height='100'/%3E%3Cpath d='M28 62l13-16 10 11 7-7 14 12H28z' fill='%23c0c8d4'/%3E%3Ccircle cx='40' cy='38' r='6' fill='%23c0c8d4'/%3E%3C/svg%3E";

/** 推荐商品模块默认值（对应旧版 pc-recommend-product/index.ts）。 */
const pcRecommendProductDefaults: AnyRecord = {
  frame: {
    boxPadding: 10,
    boxPaddingTop: 10,
    boxPaddingBottom: 50,
    boxRadius: 0,
    backgroundColor: 'transparent',
    itemGap: 16,
    columns: 5,
  },
  titleName: '猜你喜欢',
  products: {
    productSelectType: 1,
    productIds: [],
    productCategoryId: undefined,
    productTag: '',
    productNumber: 20,
  },
};

function isPlainObject(value: unknown): value is AnyRecord {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function deepMerge<T extends AnyRecord>(defaults: T, source?: AnyRecord | null): T {
  const out: AnyRecord = Array.isArray(defaults) ? [...defaults] : { ...defaults };
  if (!source) return out as T;
  Object.keys(source).forEach((key) => {
    const base = out[key];
    const next = source[key];
    if (isPlainObject(base) && isPlainObject(next)) {
      out[key] = deepMerge(base as AnyRecord, next as AnyRecord);
    } else if (next !== undefined) {
      out[key] = next;
    }
  });
  return out as T;
}

function pickPic(source?: PreviewProductItem | null): string {
  if (!source) return '';
  return source.picUrl || source.picThumb || source.picLarge || '';
}

function imageFormat(path?: string): string {
  if (!path) return '';
  return path;
}

function formatImage(url?: string): string {
  if (!url) return EMPTY_IMG;
  return imageFormat(url);
}

function formatPrice(price?: number | string): string {
  if (price === undefined || price === null) return '¥0.00';
  const num = typeof price === 'string' ? parseFloat(price) : price;
  return `¥${Number.isFinite(num) ? num.toFixed(2) : '0.00'}`;
}

function formatPriceParts(price?: number | string): { int: string; dec: string } {
  const text = formatPrice(price);
  const pure = text.replace('¥', '');
  const parts = pure.split('.');
  return { int: parts[0] || '0', dec: parts[1] || '00' };
}

function getVirtualSales(item: PreviewProductItem): string {
  const value = item.virtualSales;
  if (value === undefined || value === null || value === '') return '0';
  return String(value);
}

function getPrice(item: PreviewProductItem): number | string | undefined {
  if (item.price !== undefined && item.price !== null && item.price !== '') return item.price;
  return item.productPrice;
}

function getShopTitle(item: PreviewProductItem): string {
  return item.shop?.shopTitle || item.shopTitle || tl('官方自营');
}

function isSoldOut(item: PreviewProductItem): boolean {
  const isSeckillRaw = item.isSeckill;
  const hasSeckillFlag = isSeckillRaw !== undefined && isSeckillRaw !== null && isSeckillRaw !== '';
  const isSeckill = hasSeckillFlag ? Number(isSeckillRaw) === 1 : false;
  const productStock = Number(item.productStock ?? 999999);
  const seckillStock = Number(item.seckillStock ?? 999999);
  if (isSeckill) {
    return Number.isFinite(seckillStock) ? seckillStock === 0 : false;
  }
  return Number.isFinite(productStock) ? productStock === 0 : false;
}

function handleImgError(e: SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (!img || img.src === EMPTY_IMG) return;
  img.onerror = null;
  img.src = EMPTY_IMG;
}

/** 按选品配置拉取商品列表（参数映射与旧版 Preview.vue 完全一致）。 */
function useProductList(config: AnyRecord) {
    const { t } = useI18n();
  const [productList, setProductList] = useState<PreviewProductItem[]>([]);
  const products = config.products as AnyRecord | undefined;
  const productsKey = products ? JSON.stringify(products) : '';

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!products) {
        if (alive) setProductList([]);
        return;
      }

      const getRecordKey = (item: Partial<PreviewProductItem>): string => {
        const key = item.productId ?? item.id;
        return key === undefined || key === null ? '' : String(key);
      };

      const sortRecordsByIds = (records: PreviewProductItem[], ids: Array<string | number>): PreviewProductItem[] => {
        const order = ids.map((v) => String(v));
        if (order.length === 0) return records;
        const map = new Map<string, PreviewProductItem>();
        records.forEach((r) => map.set(getRecordKey(r), r));
        const sorted: PreviewProductItem[] = [];
        order.forEach((id) => {
          const hit = map.get(id);
          if (hit) sorted.push(hit);
        });
        records.forEach((r) => {
          const k = getRecordKey(r);
          if (k && !order.includes(k)) sorted.push(r);
        });
        return sorted;
      };

      const param: AnyRecord = {};
      const paramsValueMap: Record<number, string[]> = {
        1: ['productIds'],
        2: ['productCategoryId', 'productNumber'],
        3: ['productTag', 'productNumber'],
      };
      const paramsKeyMap: Record<string, string> = {
        productIds: 'ids',
        productCategoryId: 'categoryId',
        productNumber: 'size',
        productTag: 'introType',
      };

      const type = Number(products.productSelectType || 0);
      if (!type) {
        if (alive) setProductList([]);
        return;
      }
      if (type === 1 && (!products.productIds || products.productIds.length === 0)) {
        if (alive) setProductList([]);
        return;
      }
      if (type === 2 && (products.productCategoryId === undefined || products.productCategoryId === null || products.productCategoryId === '')) {
        if (alive) setProductList([]);
        return;
      }
      if (type === 3 && (!products.productTag || String(products.productTag).trim() === '')) {
        if (alive) setProductList([]);
        return;
      }

      const keys = paramsValueMap[type] ?? [];
      if (type === 1 && products.productIds?.length) {
        const firstKey = keys[0];
        const apiKey = firstKey ? paramsKeyMap[firstKey] : undefined;
        if (!apiKey) {
          if (alive) setProductList([]);
          return;
        }
        const idArr = Array.isArray(products.productIds)
          ? products.productIds
          : String(products.productIds).split(',').filter(Boolean);
        param[apiKey] = idArr.join(',');
        param.size = idArr.length || 20;
      } else if (type !== 1) {
        param.page = 1;
        keys.forEach((key) => {
          const value = products[key];
          if (value !== undefined && value !== null && value !== '') {
            const apiKey = paramsKeyMap[key];
            if (apiKey) param[apiKey] = value;
          }
        });
        if (param.size === undefined) param.size = products.productNumber ?? 20;
      }

      try {
        const result = await apiGet<{ records?: PreviewProductItem[]; list?: PreviewProductItem[] }>('/product/product/list', {
          productStatus: 1,
          checkStatus: 1,
          ...param,
        });
        if (!alive) return;
        const records = (result.records || result.list || []) as PreviewProductItem[];
        if (Number(products.productSelectType) === 1 && Array.isArray(products.productIds)) {
          setProductList(sortRecordsByIds(records, products.productIds));
        } else {
          setProductList(records);
        }
      } catch {
        if (alive) setProductList([]);
      }
    };
    void run();
    return () => {
      alive = false;
    };
  }, [productsKey]);

  return productList;
}

export default function PcRecommendProductPreview({ data }: { data: Record<string, any> }) {
    const { t } = useI18n();
  const config = useMemo(() => deepMerge(pcRecommendProductDefaults as AnyRecord, data), [JSON.stringify(data)]);
  const productList = useProductList(config);
  const frame = (config.frame || {}) as AnyRecord;

  const cssVars = {
    '--dec-box-padding': `${frame.boxPadding ?? 0}px`,
    '--dec-box-padding-top': `${frame.boxPaddingTop ?? 0}px`,
    '--dec-box-padding-bottom': `${frame.boxPaddingBottom ?? 50}px`,
    '--dec-box-radius': `${frame.boxRadius ?? 0}px`,
    '--dec-bg-color': frame.backgroundColor ?? 'transparent',
    '--dec-item-gap': `${frame.itemGap ?? 16}px`,
    '--dec-columns': frame.columns ?? 5,
  } as CSSProperties;

  const hasProducts = productList.length > 0;

  return (
    <div className="dec-pc-recommend-product" style={cssVars}>
      {!hasProducts ? (
        <div className="dec-pc-recommend-product__empty">
          <div className="dec-pc-recommend-product__empty-icon" />
          <div className="dec-pc-recommend-product__empty-text">{t('点击添加商品')}</div>
        </div>
      ) : (
        <>
          {config.titleName ? (
            <h3 className="dec-pc-recommend-product__title">{config.titleName}</h3>
          ) : null}
          <div className={`dec-pc-recommend-product__list${config.titleName ? '' : ' is-no-title'}`}>
            {productList.map((item, index) => {
              const priceParts = formatPriceParts(getPrice(item));
              const soldOut = isSoldOut(item);
              return (
                <a
                  key={String(item.productId ?? item.id ?? index)}
                  className="dec-pc-recommend-product__card product-card-container"
                  href="javascript:;"
                >
                  <div className="top-wrap">
                    <div className="pro_pic">
                      <img
                        className={`img${soldOut ? ' sold-out' : ''}`}
                        src={formatImage(pickPic(item))}
                        alt={item.productName || ''}
                        onError={handleImgError}
                      />
                    </div>
                  </div>

                  <div className="center-wrap">
                    <div className="pro_name">{item.productName}</div>

                    <div className="desc-wrap desc-wrap--sales">
                      <div className="virtual-sales">已售 {getVirtualSales(item)}</div>
                    </div>

                    {/* 状态占位：不管有没有状态都占一行，保证价格/按钮对齐 */}
                    <div className={`desc-wrap desc-wrap--status${soldOut ? '' : ' is-empty'}`}>
                      <div className="virtual-sales">{soldOut ? t('已售罄') : ''}</div>
                    </div>

                    <div className="tag-wrap" />

                    <div className="price-wrap">
                      <div className="box">
                        <div className="seckill-price">
                          <span className="price-currency">¥</span>
                          <span className="price-int">{priceParts.int}</span>
                          <span className="price-dec">.{priceParts.dec}</span>
                        </div>
                      </div>
                      <div className="buy">
                        <div className={`view_detail${soldOut ? ' disabled' : ''}`}>
                          <span className="add-icon" />
                        </div>
                      </div>
                    </div>

                    <div className="other-wrap">
                      <span className="link">{getShopTitle(item)}</span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
