'use client';

/**
 * 商品卡 —— 复刻 java-b2b2c-overseas-v5.8.61/view/pc/components/product/ProductCard.vue
 *
 * DOM 层级与类名与原版逐段对齐：
 *   .product-card-container
 *     ├ .top-wrap > .pro_pic > a > img.img(.sold-out) + img.product-style-border
 *     │            └ .more（isMore：右上角删除气泡）
 *     └ .center-wrap
 *         ├ .pro_name（预售标签 + 名称）
 *         ├ .desc-wrap > .virtual-sales（已售 N / 已售罄）
 *         ├ .price-wrap > .box > .price + .buy > .view_detail（加购圆钮）
 *         └ .other-wrap（店铺名，无 shop 时回落「官方自营」）
 *
 * 样式见同目录 product-card.scss（原版 scoped less 平移）。
 *
 * 已移植：预售标签、已售数量 / 已售罄、售罄图片半透明、价格（FormatPrice 结构）、
 *         加购圆钮（多规格或秒杀商品跳详情，单规格直接加购）、店铺名、删除气泡。
 * 未移植：拼团 tag（groupData.type === 7，购物车推荐位不传 groupData）、
 *         秒杀倒计时（原版 template 内已注释）、批发价链路 useProductCardBuy
 *         （本站在售为零售口径，价格统一取 productPrice）。
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Toast } from '@douyinfe/semi-ui';
import Add from '@icon-park/react/es/icons/Add';
import { apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
export interface ProductCardItem {
  productId?: number | string;
  productName?: string;
  brief?: string;
  picThumb?: string;
  picUrl?: string;
  productPrice?: number | string;
  price?: number | string;
  productStock?: number | string;
  seckillStock?: number | string;
  virtualSales?: number | string;
  isSeckill?: number | string;
  productSn?: string;
  shopId?: number | string;
  shop?: { shopTitle?: string };
  shopName?: string;
  productSku?: unknown[];
  productType?: number | string;
  productSaleMode?: number | string;
  saleMode?: number | string;
  presaleInfo?: { saleMode?: number | string };
  /** 旧版活动信息：[{ type }]，搜索页用它渲染 .activity-tags */
  activityInfo?: Array<{ type?: number | string }>;
}

interface ProductCardProps {
  product: ProductCardItem;
  /** 右上角「更多 → 删除」气泡，收藏 / 浏览记录场景用 */
  isMore?: boolean;
  /** 加购成功后的回调，购物车页用于刷新列表 */
  onCallback?: () => void;
  onDelete?: (product: ProductCardItem) => void;
  /**
   * 销量行的口径。原版恒显示「已售 N」（sales）；
   * 搜索 / 列表页按装修 showSales 配置显示「库存 N」，传 stock。
   */
  salesMode?: 'sales' | 'stock';
  /** 图片左上角店铺名角标（搜索页 showShopTag） */
  showShopTag?: boolean;
  /**
   * 旧版 SearchProductCard.vue 的 fixed-name-two-lines：
   * 名称固定两行高度并用 -webkit-line-clamp 截断（搜索页传 true）。
   */
  fixedNameTwoLines?: boolean;
  /**
   * 旧版 SearchProductCard.vue 的 activityInfo：[{ type }]，按 1 秒杀 / 3 满减 /
   * 4 折扣 / 5 满赠 / 6 限时折扣 / 7 拼团 映射成 .activity-tags > .activity-tag。
   * type 为 2（优惠券）时不显示，与旧版一致。
   */
  activityInfo?: Array<{ type?: number | string }>;
}

/** 复刻 components/format/Price.vue 的 ￥ / 整数 / 小数 三段结构 */
function splitPrice(value: unknown): { integer: string; decimals: string } {
  const raw = String(value ?? '');
  if (!raw || !/^(\d+)(\.\d+)?$/.test(raw)) return { integer: '0', decimals: '.00' };
  const [integer, decimals] = Number(raw).toFixed(2).split('.');
  return { integer, decimals: `.${decimals}` };
}

function productLink(product: ProductCardItem): string {
  return `/product/${product.productId || ''}`;
}

/** 原版 isSoldOut：普通商品看 productStock，秒杀商品看 seckillStock */
function isSoldOut(product: ProductCardItem): boolean {
  const stock = Number(product.productStock ?? 0);
  const seckillStock = Number(product.seckillStock ?? 0);
  const seckill = product.isSeckill;
  if (seckill === undefined || seckill === null || Number(seckill) === 0) return stock === 0;
  return Number(seckill) === 1 ? seckillStock === 0 : stock === 0;
}

/** 原版 isPresale：兼容 productSaleMode / saleMode / presaleInfo.saleMode */
function isPresale(product: ProductCardItem): boolean {
  const mode = product.productSaleMode ?? product.saleMode ?? product.presaleInfo?.saleMode;
  const numeric = Number(mode);
  return Number.isNaN(numeric) ? false : numeric > 0;
}

/** 原版多规格 / 虚拟商品走「查看详情」，单规格直接加购 */
function needsDetail(product: ProductCardItem): boolean {
  const skuCount = Array.isArray(product.productSku) ? product.productSku.length : 0;
  return skuCount > 1 || [7, 8].includes(Number(product.productType));
}

export default function ProductCard({
  product,
  isMore = false,
  onCallback,
  onDelete,
  salesMode = 'sales',
  showShopTag = false,
  fixedNameTwoLines = false,
  activityInfo,
}: ProductCardProps) {
    const { t } = useTranslation();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  /** 旧版 el-popover：more 三点按钮弹出「删除」气泡 */
  const [moreOpen, setMoreOpen] = useState(false);
  const soldOut = isSoldOut(product);
  const href = productLink(product);
  const image = product.picThumb || product.picUrl || '';
  const price = splitPrice(product.productPrice ?? product.price);
  const shopTitle = product.shop?.shopTitle || t('官方自营');

  async function addToCart(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (adding || !product.productId) return;
    setAdding(true);
    try {
      await apiPost('cart/cart/addToCart', { id: Number(product.productId), number: 1 });
      Toast.success({ content: '已加入购物车' });
      onCallback?.();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '加入购物车失败' });
    } finally {
      setAdding(false);
    }
  }

  const addButton = (
    <div className={`view_detail buy-btn${soldOut ? ' disabled' : ''}`} aria-label={t('加入购物车')}>
      <Add size={26} />
    </div>
  );

  // 点击卡片外收起 more 气泡
  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-card-more]')) setMoreOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [moreOpen]);

  /* 旧版 SearchProductCard.vue 第 195-213 行：活动类型文字映射，type 2（优惠券）不显示 */
  const ACTIVITY_TYPE_TEXT: Record<number, string> = {
    1: '秒杀',
    3: '满减',
    4: '折扣',
    5: '满赠',
    6: '限时折扣',
    7: '拼团',
  };
  const activityTags = Array.isArray(activityInfo)
    ? activityInfo
        .filter((item) => {
          const type = Number(item?.type);
          return type !== 2 && Boolean(ACTIVITY_TYPE_TEXT[type]);
        })
        .map((item) => ACTIVITY_TYPE_TEXT[Number(item.type)])
    : [];

  return (
    <div
      className="product-card-container"
      onClick={() => {
        // 旧版容器 @click="toProduct"：整卡可点（more/加购内部各自 stopPropagation）
        router.push(href);
      }}
    >
      <div className="top-wrap">
        <div className="pro_pic">
          <Link href={href} target="_blank" onClick={(event) => event.stopPropagation()}>
            <img
              className={`img${soldOut ? ' sold-out' : ''}`}
              src={image}
              alt={product.productName || ''}
              loading="lazy"
            />
          </Link>
          {showShopTag && shopTitle !== '官方自营' ? (
            <span className="shop-tag">{shopTitle}</span>
          ) : null}
        </div>
        {isMore ? (
          <div className="more" data-card-more onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="more__btn"
              aria-label={t('更多操作')}
              aria-expanded={moreOpen}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setMoreOpen((current) => !current);
              }}
            >
              {/* 旧版 SvgIcon name="more"：横向三圆点 */}
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                <circle cx="4" cy="10" r="1.6" fill="currentColor" />
                <circle cx="10" cy="10" r="1.6" fill="currentColor" />
                <circle cx="16" cy="10" r="1.6" fill="currentColor" />
              </svg>
            </button>
            {moreOpen ? (
              <div className="more__pop">
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setMoreOpen(false);
                    onDelete?.(product);
                  }}
                >
                  {t('删除')}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="center-wrap">
        <div className={`pro_name${fixedNameTwoLines ? ' pro_name--fixed-two-lines' : ''}`}>
          {isPresale(product) ? <span className="presale-text">{t('预售')}</span> : null}
          {product.productName || ''}
        </div>

        {product.brief ? <div className="pro_brief">{product.brief}</div> : null}

        <div className="desc-wrap">
          <div className="virtual-sales">
            {salesMode === 'stock'
              ? t('库存 {n}', { n: Number(product.productStock ?? 0) })
              : soldOut
                ? t('已售罄')
                : t('已售 {n}', { n: Number(product.virtualSales ?? 0) })}
          </div>
        </div>

        {/* 旧版 SearchProductCard.vue：活动标签行（.center-wrap > .activity-tags > .activity-tag） */}
        {activityTags.length > 0 ? (
          <div className="activity-tags">
            {activityTags.map((tag, index) => (
              <span className="activity-tag" key={`${tag}-${index}`}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {/* 原版此处是 groupData.type === 7 的拼团 tag，否则占位 24px；推荐位恒为占位 */}
        <div className="price-slot" />

        <div className="price-wrap">
          <div className="box">
            <div className="price align-bottom">
              <div className="util">￥</div>
              <div className="num">{price.integer}</div>
              {price.decimals ? <div className="num decimal">{price.decimals}</div> : null}
            </div>
          </div>
          <div className="buy">
            {needsDetail(product) || soldOut ? (
              <Link href={href} target="_blank" onClick={(event) => event.stopPropagation()}>
                {addButton}
              </Link>
            ) : (
              <span onClick={addToCart}>{addButton}</span>
            )}
          </div>
        </div>

        <div className="other-wrap">
          {product.shop?.shopTitle || t('官方自营')}
        </div>
      </div>
    </div>
  );
}
