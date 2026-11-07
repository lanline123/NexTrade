/**
 * PC 商品模块 - 预览组件（迁移自 java-b2b2c-overseas-v5.8.61
 * view/admin/src/views/decorate/decorate/editor/modules/pcHome/pc-product/Preview.vue）
 *
 * 取数模式对齐 Vort（1=指定商品 / 2=分类 / 3=标签），参数名以 Tigshop
 * product/product/list 接口为准：productIds → ids（逗号串）、productCategoryId → categoryId、
 * productTag → introType。
 *
 * 与旧版差异：
 * 1. Vue -> React（props 统一为 { data }，内部深合并默认值）；
 * 2. 旧版 imageFormat 依赖 Pinia config.storageUrl 前缀，admin-semi 无该 store，
 *    与 PcDecorateEditor 现有预览保持一致：http/绝对路径原样返回，相对路径仅去空；
 * 3. 旧版空状态图标为本地 png，admin-semi 无该资源，CSS 中使用同尺寸内联占位图。
 */
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { apiGet } from '../../../api';
import './pcProduct.css';

import { useI18n } from '../../../i18n';
type AnyRecord = Record<string, any>;

interface ProductItem {
  productId?: number | string;
  productName?: string;
  productPrice?: number | string;
  marketPrice?: number | string;
  brief?: string;
  picUrl?: string;
  picThumb?: string;
  picLarge?: string;
}

/** 商品模块默认值（对应旧版 pc-product/index.ts 的 pcProductDefaults）。 */
const pcProductDefaults: AnyRecord = {
  style: 1,
  goodsStyle: 1,
  goodsRadioStyle: 1,
  textAlign: 1,
  textWeight: 1,
  goodsNameRow: 2,
  goodsNamePadding: 1,
  showName: 1,
  showBrief: 1,
  showPrice: 1,
  goodsPadding: 5,
  buyBtnStyle: 1,
  backgroundColor: '',
  boxRadius: 0,
  innerPadding: 0,
  boxPadding: 10,
  boxPaddingTop: 5,
  boxPaddingBottom: 5,
  imgPadding: 1,
  waterfall: 0,
  swiperPageColor: '',
  frame: {
    textColor: '',
    itemBackgroundColor: '',
    backgroundColor: '#ffffff',
    innerPadding: 0,
    itemHeight: 35,
    itemRadius: 3,
    boxRadius: 0,
    boxPadding: 10,
    leftAndRightPadding: 0,
    boxPaddingTop: 5,
    boxPaddingBottom: 5,
  },
  title: {
    showTitle: 0,
    titleStyle: 1,
    titleAlign: 1,
    titleBackground: '',
    titleBackground2: '',
    titleBackgroundPic: { picUrl: '', picThumb: '' },
    titleRadius: 0,
    titleText: '标题内容',
    titleColor: '',
    descText: '',
    descColor: '#aaaaaa',
    showMore: 0,
    moreLink: { link: '', title: '' },
    moreColor: '#aaaaaa',
  },
  products: {
    productSelectType: 1,
    productIds: [],
    productCategoryId: undefined,
    productTag: '',
    productNumber: 10,
  },
};

function isPlainObject(value: unknown): value is AnyRecord {
  return Object.prototype.toString.call(value) === '[object Object]';
}

/** 深合并默认值（对象递归合并，数组/原始值直接覆盖，语义对齐旧版 deepMerge）。 */
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

/** 图片格式化：对齐旧版 productImage/pickPic（picUrl > picThumb > picLarge）。 */
function pickPic(source?: ProductItem | null): string {
  if (!source) return '';
  return source.picUrl || source.picThumb || source.picLarge || '';
}

function imageFormat(path?: string): string {
  if (!path) return '';
  return path.includes('http') || path.startsWith('/') ? path : path;
}

function productImage(source?: ProductItem | null): string {
  return imageFormat(pickPic(source));
}

function formatImage(url?: string): string {
    const { t } = useI18n();
  if (!url) {
    return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23f5f5f5" width="100" height="100"/></svg>';
  }
  return imageFormat(url);
}

function formatPrice(price?: number | string): string {
  if (price === undefined || price === null) return '¥0.00';
  const num = typeof price === 'string' ? parseFloat(price) : price;
  return `¥${Number.isFinite(num) ? num.toFixed(2) : '0.00'}`;
}

/** 模块标题（对齐旧版 _shared/ModuleTitle.vue：样式一/二/三装饰、对齐、背景、圆角、更多链接）。 */
function ModuleTitle({ title }: { title?: AnyRecord }) {
    const { t } = useI18n();
  if (!title || Number(title.showTitle) !== 1) return null;
  const align = Number(title.titleAlign ?? 1);
  const style = Number(title.titleStyle ?? 1);
  const titleIcon = productImage(title.titleBackgroundPic as ProductItem);

  const containerStyle: CSSProperties = {};
  if (title.titleBackground2 && title.titleBackground) {
    containerStyle.background = `linear-gradient(to right, ${title.titleBackground}, ${title.titleBackground2})`;
  } else if (title.titleBackground) {
    containerStyle.backgroundColor = title.titleBackground;
  }
  if (title.titleRadius) {
    containerStyle.borderRadius = `${Number(title.titleRadius)}px ${Number(title.titleRadius)}px 0 0`;
  }

  return (
    <div className={`dec-module-title dec-module-title--style-${style} dec-module-title--align-${align}`} style={containerStyle}>
      <div className="dec-module-title__left">
        {titleIcon ? <img className="dec-module-title__icon" src={titleIcon} alt="" /> : null}
        <div className="dec-module-title__text" style={{ color: title.titleColor || '#2a3145' }}>
          {title.titleText}
        </div>
        {title.descText ? (
          <div className="dec-module-title__desc" style={{ color: title.descColor || '#aaaaaa' }}>
            {title.descText}
          </div>
        ) : null}
      </div>
      {Number(title.showMore) === 1 ? (
        <div className="dec-module-title__right">
          <a className="dec-module-title__more" href={title.moreLink?.link || 'javascript:;'} style={{ color: title.moreColor || '#969799' }}>
            <span>{title.moreLink?.title || t('更多')}</span>
            <i>›</i>
          </a>
        </div>
      ) : null}
    </div>
  );
}

/** 按选品配置拉取商品列表（参数映射与旧版 Preview.vue 完全一致）。 */
function useProductList(config: AnyRecord) {
    const { t } = useI18n();
  const [productList, setProductList] = useState<ProductItem[]>([]);
  const products = config.products as AnyRecord | undefined;
  const productsKey = products ? JSON.stringify(products) : '';

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!products) {
        if (alive) setProductList([]);
        return;
      }

      const getRecordKey = (item: Partial<ProductItem>): string => {
        const rec = item as AnyRecord;
        const key = rec.productId ?? rec.id;
        return key === undefined || key === null ? '' : String(key);
      };

      const sortRecordsByIds = (records: ProductItem[], ids: Array<string | number>): ProductItem[] => {
        const order = ids.map((v) => String(v));
        if (order.length === 0) return records;
        const map = new Map<string, ProductItem>();
        records.forEach((r) => map.set(getRecordKey(r), r));
        const sorted: ProductItem[] = [];
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
      const type = Number(products.productSelectType || 0);
      // 未配置商品：不请求接口，不渲染列表
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

      if (type === 1) {
        const idArr = Array.isArray(products.productIds)
          ? products.productIds
          : String(products.productIds).split(',').filter(Boolean);
        param.ids = idArr.join(',');
        param.size = idArr.length || 15;
      } else {
        param.page = 1;
        if (type === 2) {
          param.categoryId = products.productCategoryId;
        } else {
          param.introType = products.productTag;
        }
        param.size = products.productNumber ?? 15;
      }

      try {
        const result = await apiGet<{ records?: ProductItem[]; list?: ProductItem[] }>('/product/product/list', {
          productStatus: 1,
          checkStatus: 1,
          ...param,
        });
        if (!alive) return;
        const records = (result.records || result.list || []) as ProductItem[];
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

export default function PcProductPreview({ data }: { data: Record<string, any> }) {
    const { t } = useI18n();
  const config = useMemo(() => deepMerge(pcProductDefaults as AnyRecord, data), [JSON.stringify(data)]);
  const productList = useProductList(config);
  const frame = (config.frame || {}) as AnyRecord;
  const style = Number(config.style ?? 1);
  const columns = style === 2 ? 5 : 4;
  // 购买按钮样式：0=不显示，1/2=购物车（线框/实心），3/4=加号（线框/实心），5~8=文字按钮（原版 ProductButton.vue）
  const buyStyle = Number(config.buyBtnStyle ?? 1);

  const cssVars = {
    // 扩展设置（ModuleContainerSettings）写入的是 frame，预览优先读取 frame
    '--dec-box-padding': `${frame.boxPadding ?? config.boxPadding ?? 10}px`,
    '--dec-box-padding-top': `${frame.boxPaddingTop ?? config.boxPaddingTop ?? 5}px`,
    '--dec-box-padding-bottom': `${frame.boxPaddingBottom ?? config.boxPaddingBottom ?? 5}px`,
    '--dec-box-radius': `${frame.boxRadius ?? config.boxRadius ?? 0}px`,
    '--dec-bg-color': frame.backgroundColor || config.backgroundColor || '#ffffff',
    // "左右内边距"来自 frame.leftAndRightPadding，仅作用于内容区左右
    '--dec-inner-padding': `${frame.leftAndRightPadding ?? frame.innerPadding ?? config.innerPadding ?? 0}px`,
    '--dec-goods-padding': `${config.goodsPadding ?? 5}px`,
    '--dec-columns': String(columns),
  } as CSSProperties;

  const hasProducts = productList.length > 0;

  return (
    <div
      className={`dec-pc-product dec-pc-product--style-${style}`}
      style={cssVars}
    >
      <div className="dec-pc-product__content">
        {!hasProducts ? (
          <div className="dec-pc-product__empty">
            <div className="dec-pc-product__empty-icon" />
            <div className="dec-pc-product__empty-text">{t('点击添加商品')}</div>
          </div>
        ) : null}

        <ModuleTitle title={config.title as AnyRecord} />

        {hasProducts ? (
          <div className="dec-pc-product__wrapper">
            <div className="dec-pc-product__list">
              {productList.map((item) => (
                <div key={String(item.productId ?? '')} className="dec-pc-product__item">
                  <a className="dec-pc-product__card" href="javascript:;">
                    <div className="dec-pc-product__photo">
                      <img className="dec-pc-product__img" src={formatImage(pickPic(item))} alt={item.productName || ''} />
                    </div>
                    <div className="dec-pc-product__info">
                      {Number(config.showName) !== 0 ? <div className="dec-pc-product__name">{item.productName}</div> : null}
                      {Number(config.showBrief) !== 0 ? (
                        <div className="dec-pc-product__brief">{item.brief || t('商品描述')}</div>
                      ) : null}
                      <div className="dec-pc-product__bottom">
                        {Number(config.showPrice) !== 0 ? (
                          <div className="dec-pc-product__price">{formatPrice(item.productPrice)}</div>
                        ) : null}
                        {buyStyle > 0 ? (
                          <span className="dec-pc-product__buy">
                            {buyStyle <= 4 ? (
                              <i
                                className={`dec-pc-product__buy-ico dec-pc-product__buy-ico--${buyStyle <= 2 ? 'cart' : 'plus'}${buyStyle === 1 || buyStyle === 3 ? ' is-outline' : ''}`}
                              />
                            ) : (
                              <span
                                className={`dec-pc-product__buy-text ${buyStyle === 6 || buyStyle === 8 ? 'dec-pc-product__buy-text--solid' : 'dec-pc-product__buy-text--outline'}`}
                              >
                                {buyStyle >= 7 ? t('马上抢') : '购买'}
                              </span>
                            )}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </a>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
