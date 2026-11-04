/**
 * 商品分组模块 - 预览组件（迁移自 java-b2b2c-overseas-v5.8.61
 * view/admin/src/views/decorate/decorate/editor/modules/pcHome/pc-product-group/Preview.vue）
 *
 * 结构：分组标题栏（可横向滚动 + 左右箭头 + 标题图/分割线/选中态）+ 商品列表（多种列宽/一大两小）。
 * 取数：
 * - sourceType=productGroup：product/product/list?productGroupId=...&page=1&size=cols*3
 * - sourceType=products：优先 ids 批量取数，失败/为空回退配置内商品列表
 * - 取数失败时回退配置内演示商品（与旧版行为一致）
 *
 * 与旧版差异：Vue <Transition> 的进出场动画迁移为 key 变化时的 CSS 入场动画；其余结构/样式一致。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { apiGet } from '../../../api';
import './pcProductGroup.css';

type AnyRecord = Record<string, any>;

interface ProductItem {
  productId?: number;
  productSn?: string;
  productName?: string;
  productDesc?: string;
  productPrice?: number | string;
  marketPrice?: number | string;
  productStock?: number;
  virtualSales?: number;
  shopTitle?: string;
  picThumb?: string;
  picUrl?: string;
  picLarge?: string;
}

interface ProductGroupItem {
  id?: string | number;
  sourceType?: 'products' | 'productGroup';
  productGroupId?: string | number;
  title?: string;
  titlePic?: { picUrl?: string; picThumb?: string };
  productList?: ProductItem[];
}

const defaultBuyBtnStyle = {
  showBtn: 1,
  btnType: 1,
  text: '',
  textColor: '#ffffff',
  iconColor: '#ffffff',
  paddingLeftRight: 3,
};

const defaultProductColor = {
  infoLeftRightPadding: 10,
  backgroundColor: '#ffffff',
  titleColor: '#19191b',
  priceColor: '',
  crossedOutPriceColor: '#999999',
};

const defaultGroupTitle = {
  marginLeftRight: 5,
  showTitle: 1,
  bigTitleFontSize: 14,
  titleColor: '#444444',
  activeTitleColor: '#FF0F23',
  activeTitleBgColor: '#ffebf1',
  titleMinWidth: 80,
  titlePaddingTopBottom: 8,
  titlePaddingLeftRight: 12,
  titleRadius: 4,
  splitLineColor: 'transparent',
};

/** 演示商品列表（与旧版 pc-product-group/index.ts 的 demoProductList 一致）。 */
const demoProductList: ProductItem[] = [
  {
    productId: 0,
    productSn: '',
    productName: '商品的大标题雨价格在后台他会自动调用读取',
    productDesc: '',
    productPrice: 88.8,
    marketPrice: 98.8,
    picThumb: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1732004872pw39D1oGqdAaZMpvyo.jpg',
  },
  {
    productId: 0,
    productSn: '',
    productName: '商品的大标题雨价格在后台他会自动调用读取',
    productDesc: '',
    productPrice: 56.8,
    marketPrice: 68.88,
    picThumb: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1732004872f6EcZnbAqdW5kIGzxL.jpg',
  },
  {
    productId: 0,
    productSn: '',
    productName: '商品的大标题雨价格在后台他会自动调用读取',
    productDesc: '',
    productPrice: 48.8,
    marketPrice: 69.9,
    picThumb: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1732004872o3s8aqPGdICr1DOCdB.jpg',
  },
  {
    productId: 0,
    productSn: '',
    productName: '商品的大标题雨价格在后台他会自动调用读取',
    productDesc: '',
    productPrice: 48.8,
    marketPrice: 69.9,
    picThumb: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1732004872Mry8L9BWOCiawPhp72.jpg',
  },
  {
    productId: 0,
    productSn: '',
    productName: '商品的大标题雨价格在后台他会自动调用读取',
    productDesc: '',
    productPrice: 32.0,
    marketPrice: 39.0,
    picThumb: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1732004872yPYr4zSj7AXrfw9oON.jpg',
  },
  {
    productId: 0,
    productSn: '',
    productName: '商品的大标题雨价格在后台他会自动调用读取',
    productDesc: '',
    productPrice: 32.0,
    marketPrice: 39.0,
    picThumb: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1732004872NlX49KeGeYSN4Tw0wa.jpg',
  },
];

const demoProductGroups: ProductGroupItem[] = [
  {
    sourceType: 'products',
    title: '为你推荐',
    titlePic: {
      picUrl: 'https://oss.vortmall.com/demo/upload/c4ca4238/2026/02/07/147580fe25834bb09199267ee601b834.png',
      picThumb: 'https://oss.vortmall.com/demo/upload/c4ca4238/2026/02/07/147580fe25834bb09199267ee601b834.png',
    },
    productList: [...demoProductList],
  },
  {
    sourceType: 'products',
    title: '热卖',
    titlePic: { picUrl: '', picThumb: '' },
    productList: [...demoProductList],
  },
  {
    sourceType: 'products',
    title: '折扣',
    titlePic: { picUrl: '', picThumb: '' },
    productList: [...demoProductList],
  },
  {
    sourceType: 'products',
    title: '预售',
    titlePic: { picUrl: '', picThumb: '' },
    productList: [...demoProductList],
  },
];

/** 商品分组模块默认值（对应旧版 productGroupDefaults）。 */
const productGroupDefaults: AnyRecord = {
  productSource: 'products',
  productGroups: demoProductGroups,
  groupList: [],
  productCardStyle: 1,
  listStyle: 4,
  cardPadding: 0,
  cardRadius: 4,
  showProductName: 1,
  productNameRow: 1,
  productNameWeight: 400,
  productNameSize: 16,
  showProductPrice: 1,
  productPriceMarginTop: 10,
  productPriceWeight: 400,
  productPriceSize: 28,
  crossedOutPrice: 1,
  showSales: 1,
  showShopTag: 1,
  buyBtnStyle: defaultBuyBtnStyle,
  productColor: defaultProductColor,
  groupTitle: defaultGroupTitle,
  moduleStyle: { boxPaddingTop: 5, boxPaddingBottom: 5, boxPadding: 10, backgroundColor: '' },
  contentStyle: {
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeftRight: 0,
    boxRadius: 0,
    backgroundColor: '',
    backgroundPic: { picUrl: '', picThumb: '' },
    backgroundPicFillType: 'cover',
    boxShadow: 0,
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

function pickPic(source?: ProductItem | null): string {
  if (!source) return '';
  return source.picUrl || source.picThumb || source.picLarge || '';
}

function imageFormat(path?: string): string {
  if (!path) return '';
  return path;
}

function productImage(source?: { picUrl?: string; picThumb?: string; picLarge?: string } | null): string {
  if (!source) return '';
  return imageFormat(source.picUrl || source.picThumb || source.picLarge || '');
}

function formatImage(url?: string): string {
  return imageFormat(url);
}

function formatPriceParts(price?: number | string): { int: string; dec: string } {
  if (price === undefined || price === null) return { int: '0', dec: '00' };
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (!Number.isFinite(num)) return { int: '0', dec: '00' };
  const text = num.toFixed(2);
  const parts = text.split('.');
  return { int: parts[0] || '0', dec: parts[1] || '00' };
}

export default function PcProductGroupPreview({ data }: { data: Record<string, any> }) {
  const config = useMemo(() => deepMerge(productGroupDefaults as AnyRecord, data), [JSON.stringify(data)]);
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'slide-left' | 'slide-right'>('slide-left');
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const [currentProductList, setCurrentProductList] = useState<ProductItem[]>([]);

  const productGroups = (config.productGroups || []) as ProductGroupItem[];
  const groupTitle = (config.groupTitle || {}) as AnyRecord;

  const updateArrows = () => {
    const el = tabsRef.current;
    if (!el) {
      setShowLeftArrow(false);
      setShowRightArrow(false);
      return;
    }
    setShowLeftArrow(el.scrollLeft > 0);
    setShowRightArrow(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  // Tab 列表变化 / 挂载后刷新箭头可见性（对应旧版 watch(tabList) + onMounted nextTick）
  useEffect(() => {
    updateArrows();
  }, [productGroups.length]);

  const scrollTabs = (direction: 'left' | 'right') => {
    const el = tabsRef.current;
    if (!el) return;
    const step = el.clientWidth * 0.6;
    el.scrollBy({ left: direction === 'left' ? -step : step, behavior: 'smooth' });
  };

  const getColumnsCount = (): number => {
    const listStyle = config.listStyle ?? 4;
    const map: Record<number, number> = { 4: 4, 6: 5, 7: 6 };
    return map[listStyle] || 4;
  };

  const groupsKey = JSON.stringify(productGroups);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      const groups = productGroups;
      const index = activeIndex;
      if (!groups.length || !groups[index]) {
        if (alive) setCurrentProductList([]);
        return;
      }
      const group = groups[index];
      const sourceType = group.sourceType || 'products';

      if (sourceType === 'productGroup') {
        if (!group.productGroupId) {
          if (alive) setCurrentProductList([]);
          return;
        }
        try {
          const cols = getColumnsCount();
          const result = await apiGet<{ records?: ProductItem[]; list?: ProductItem[] }>('/product/product/list', {
            productGroupId: group.productGroupId,
            page: 1,
            size: cols * 3,
          });
          if (alive) setCurrentProductList(result.records || result.list || []);
        } catch {
          if (alive) setCurrentProductList([]);
        }
        return;
      }

      // 手动选择商品
      const productIds = group.productList?.map((p) => p.productId).filter((id): id is number => !!id && id > 0);
      if (productIds && productIds.length > 0) {
        try {
          const result = await apiGet<{ records?: ProductItem[]; list?: ProductItem[] }>('/product/product/list', {
            ids: productIds.join(','),
            page: 1,
            size: 100,
          });
          if (!alive) return;
          const records = result.records || result.list || [];
          setCurrentProductList(records.length ? records : group.productList || []);
        } catch {
          if (alive) setCurrentProductList(group.productList || []);
        }
      } else if (alive) {
        setCurrentProductList(group.productList || []);
      }
    };
    void run();
    return () => {
      alive = false;
    };
  }, [groupsKey, activeIndex]);

  const showGroupTitle = Number(groupTitle.showTitle ?? 1) === 1;
  // 显示开关统一做数字归一化：保存后重新载入时这些值可能为字符串 "0"/"1"
  const showProductName = Number(config.showProductName ?? 1) !== 0;
  const showProductPrice = Number(config.showProductPrice ?? 1) !== 0;
  const showCrossedOutPrice = Number(config.crossedOutPrice ?? 1) !== 0;
  const showSales = Number(config.showSales ?? 1) !== 0;
  const showShopTag = Number(config.showShopTag ?? 1) !== 0;
  const showBuyBtn = Number((config.buyBtnStyle as AnyRecord)?.showBtn ?? 1) !== 0;

  const buyBtnStyle = (config.buyBtnStyle || defaultBuyBtnStyle) as AnyRecord;
  const buyBtnType = Number(buyBtnStyle.btnType ?? 1);
  const buyIconClass = buyBtnType === 2 ? 'icon-gouwuche' : buyBtnType === 3 ? 'icon-gouwuche1' : 'icon-jia1';
  const buyBtnClass = [
    buyBtnType === 1 ? 'dec-pc-product-group__cart-btn--style-1' : '',
    buyBtnType === 2 ? 'dec-pc-product-group__cart-btn--style-2' : '',
    buyBtnType === 3 ? 'dec-pc-product-group__cart-btn--style-3' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleTabClick = (index: number) => {
    setSlideDirection(index > activeIndex ? 'slide-left' : 'slide-right');
    setActiveIndex(index);
  };

  const moduleClasses = `dec-pc-product-group--card-style-${config.productCardStyle ?? 1} dec-pc-product-group--list-style-${config.listStyle ?? 2}`;

  const pc = (config.productColor || {}) as AnyRecord;
  const ms = (config.moduleStyle || {}) as AnyRecord;
  const cs = (config.contentStyle || {}) as AnyRecord;
  const DEFAULT_PRICE_WEIGHT = 400;
  const DEFAULT_PRICE_INT_SIZE = 28;
  const DEFAULT_PRICE_MARGIN_TOP = 10;

  const cssVars = {
    // 模块样式
    '--dec-box-padding': `${ms.boxPadding ?? 10}px`,
    '--dec-box-padding-top': `${ms.boxPaddingTop ?? 5}px`,
    '--dec-box-padding-bottom': `${ms.boxPaddingBottom ?? 5}px`,
    '--dec-module-bg': ms.backgroundColor || 'transparent',
    // 内容样式
    '--dec-content-padding-top': `${cs.paddingTop ?? 0}px`,
    '--dec-content-padding-bottom': `${cs.paddingBottom ?? 0}px`,
    '--dec-content-padding-lr': `${cs.paddingLeftRight ?? 0}px`,
    '--dec-content-radius': `${cs.boxRadius ?? 0}px`,
    '--dec-content-bg': cs.backgroundColor || 'transparent',
    '--dec-content-shadow': cs.boxShadow ? '0 2px 8px rgba(93, 113, 127, 0.08)' : 'none',
    // 商品卡片样式
    '--dec-card-padding': `${config.cardPadding ?? 0}px`,
    '--dec-card-radius': `${config.cardRadius ?? 4}px`,
    '--dec-card-bg': pc.backgroundColor || '#ffffff',
    // 商品信息样式
    '--dec-item-gap': `${pc.infoLeftRightPadding ?? 3}px`,
    '--dec-info-padding-lr': `${pc.infoLeftRightPadding ?? 3}px`,
    '--dec-title-color': pc.titleColor || '#19191b',
    '--dec-title-weight': config.productNameWeight ?? 400,
    '--dec-title-size': `${config.productNameSize ?? 16}px`,
    '--dec-title-rows': config.productNameRow ?? 1,
    '--dec-price-color': pc.priceColor || 'var(--main-bg, #ff4d4f)',
    '--dec-price-weight': String(DEFAULT_PRICE_WEIGHT),
    '--dec-price-size': `${DEFAULT_PRICE_INT_SIZE}px`,
    '--dec-price-dec-size': `${DEFAULT_PRICE_INT_SIZE - 2}px`,
    '--dec-price-margin-top': `${DEFAULT_PRICE_MARGIN_TOP}px`,
    '--dec-origin-price-color': pc.crossedOutPriceColor || '#999999',
    // 分组标题样式
    '--dec-tab-margin-lr': `${groupTitle.marginLeftRight ?? 0}px`,
    '--dec-tab-title-size': `${groupTitle.bigTitleFontSize ?? 14}px`,
    '--dec-tab-title-color': groupTitle.titleColor || '#444444',
    '--dec-tab-title-active-color': groupTitle.activeTitleColor || '#FF0F23',
    '--dec-tab-active-bg': groupTitle.activeTitleBgColor || '#ffebf1',
    '--dec-tab-title-min-width': `${groupTitle.titleMinWidth ?? 80}px`,
    '--dec-tab-title-padding-tb': `${groupTitle.titlePaddingTopBottom ?? 8}px`,
    '--dec-tab-title-padding-lr': `${groupTitle.titlePaddingLeftRight ?? 12}px`,
    '--dec-tab-title-radius': `${groupTitle.titleRadius ?? 4}px`,
    '--dec-tab-line-color': groupTitle.splitLineColor || 'transparent',
  } as CSSProperties;

  const itemWidthStyle = (index: number): CSSProperties => {
    const listStyle = config.listStyle ?? 2;
    const gap = 'var(--dec-item-gap, 3px)';
    if (listStyle === 5) {
      // 一大两小布局：第一个占100%，后续占50%
      return { width: index % 3 === 0 ? '100%' : `calc((100% - ${gap}) / 2)` };
    }
    if (listStyle === 6) {
      return { width: `calc((100% - (${gap} * 4)) / 5)` };
    }
    if (listStyle === 7) {
      return { width: `calc((100% - (${gap} * 5)) / 6)` };
    }
    if (listStyle >= 1 && listStyle <= 4) {
      return { width: `calc((100% - (${gap} * ${listStyle - 1})) / ${listStyle})` };
    }
    return {};
  };

  return (
    <div className={`dec-pc-product-group ${moduleClasses}`} style={cssVars}>
      <div className="dec-pc-product-group__container">
        {/* 分组标题栏 */}
        {showGroupTitle ? (
          <div className="dec-pc-product-group__tabs-wrapper">
            {showLeftArrow ? (
              <div
                className="dec-pc-product-group__arrow dec-pc-product-group__arrow--left"
                onClick={(e) => {
                  e.stopPropagation();
                  scrollTabs('left');
                }}
              >
                <span className="dec-pc-product-group__arrow-btn">
                  <svg
                    className="dec-pc-product-group__arrow-icon dec-pc-product-group__arrow-icon--flip"
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="none"
                    viewBox="0 0 16 16"
                  >
                    <path stroke="#1A1A1A" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6.25 4.5 9.75 8l-3.5 3.5" />
                  </svg>
                </span>
              </div>
            ) : null}

            <div
              ref={tabsRef}
              className="dec-pc-product-group__tabs"
              onScroll={updateArrows}
              onMouseEnter={updateArrows}
            >
              {productGroups.map((item, index) => (
                <div
                  key={index}
                  className={`dec-pc-product-group__tab${index === activeIndex ? ' dec-pc-product-group__tab--active' : ''}`}
                  onClick={() => handleTabClick(index)}
                >
                  {index > 0 ? <div className="dec-pc-product-group__tab-line" /> : null}
                  <div className="dec-pc-product-group__tab-content">
                    {productImage(item.titlePic) ? (
                      <img className="dec-pc-product-group__tab-icon" src={productImage(item.titlePic)} alt="" />
                    ) : null}
                    <div className="dec-pc-product-group__tab-title">{item.title}</div>
                  </div>
                </div>
              ))}
            </div>

            {showRightArrow ? (
              <div
                className="dec-pc-product-group__arrow dec-pc-product-group__arrow--right"
                onClick={(e) => {
                  e.stopPropagation();
                  scrollTabs('right');
                }}
              >
                <span className="dec-pc-product-group__arrow-btn">
                  <svg
                    className="dec-pc-product-group__arrow-icon"
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="none"
                    viewBox="0 0 16 16"
                  >
                    <path stroke="#1A1A1A" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6.25 4.5 9.75 8l-3.5 3.5" />
                  </svg>
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* 商品列表 */}
        <div className="dec-pc-product-group__products">
          <div
            key={activeIndex}
            className={`dec-pc-product-group__list dec-pc-product-group__list--enter-${slideDirection}`}
          >
            {currentProductList.map((product, index) => {
              const priceParts = formatPriceParts(product.productPrice);
              return (
                <div key={index} className="dec-pc-product-group__item" style={itemWidthStyle(index)}>
                  <div className="dec-pc-product-group__card">
                    {/* 商品图片 */}
                    <div className="dec-pc-product-group__image">
                      <div
                        className="dec-pc-product-group__image-inner"
                        style={{ backgroundImage: `url(${formatImage(pickPic(product))})` }}
                      />
                    </div>
                    {/* 商品信息 */}
                    <div className="dec-pc-product-group__info">
                      {showProductName ? (
                        <div className="dec-pc-product-group__name">{product.productName}</div>
                      ) : null}
                      {showSales ? (
                        <div className="dec-pc-product-group__status-wrap">
                          <div className="dec-pc-product-group__sales">已售 {product.virtualSales ?? 0}</div>
                        </div>
                      ) : null}
                      <div className="dec-pc-product-group__price-box">
                        <div className="dec-pc-product-group__price-row">
                          {showProductPrice ? (
                            <span className="dec-pc-product-group__price">
                              <span className="dec-pc-product-group__price-currency">¥</span>
                              <span className="dec-pc-product-group__price-int">{priceParts.int}</span>
                              <span className="dec-pc-product-group__price-dec">.{priceParts.dec}</span>
                            </span>
                          ) : null}
                          {showCrossedOutPrice ? (
                            <span className="dec-pc-product-group__origin-price">
                              <span className="dec-pc-product-group__price-originCurrency">¥</span>
                              {product.marketPrice}
                            </span>
                          ) : null}
                        </div>
                        {showBuyBtn ? (
                          <span className={`dec-pc-product-group__cart-btn ${buyBtnClass}`}>
                            <span className={`dec-pc-product-group__cart-icon iconfont-pc ${buyIconClass}`} />
                          </span>
                        ) : null}
                      </div>
                      {showShopTag ? (
                        <div className="dec-pc-product-group__shop">{product.shopTitle || '官方自营'}</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
