'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Button, Card, InputNumber, Modal, Tag, Toast } from '@douyinfe/semi-ui';
import { IconCart, IconCreditCard } from '@douyinfe/semi-icons';
import type { ProductDetailResponse } from '@/lib/api';
import { addToCart } from '@/lib/api';
import { apiGet, apiPost } from '@/lib/client-api';
import RawImageDownloadButton from '@/components/RawImageDownloadButton';
import ProductJoiningClient from '@/components/ProductJoiningClient';
import ProductCard, { type ProductCardItem } from '@/components/product/ProductCard';
import { useProductColumns } from '@/components/product/use-product-columns';
import '@/components/product/product-card.scss';
import { ProductLayout, type ProductBlocks, type DetailSection } from '@/components/product/ProductLayouts';

import { useTranslation } from 'react-i18next';
/**
 * 商品详情（源码对照 java-b2b2c-overseas-v5.8.61/view/pc/pages/item/src/Product.vue
 * + components/product/{ProductSku,ProductInfo,PicShow,Buy,Comment,Consultation,
 * CouponList,ShopInfo,ShareModal}.vue）
 *
 * 三套风格（结构级布局，见 components/product/ProductLayouts.tsx）：
 *   1 经典版 old      —— 左画廊 / 右信息 + 下方左侧栏 + Tab（源码 .container）
 *   2 国内标准版 new  —— 左画廊 + Tab / 右 sticky 独立滚动（源码 .container-new）
 *   3 跨境简约版 overseas —— 左画廊 + 锚点长滚动 / 右 sticky 独立滚动（源码 .container-overseas）
 * 由后台「装修 → PC端装修 → 商品页风格」productDetailStyleType 切换，?uiStyle= 可预览。
 *
 * 历史补齐（task-107）：
 * - 商品评价 / 商品咨询 Tab（`product/product/getComment`、`getCommentList`、
 *   `getFeedbackList`，分页「加载更多」）；
 * - 优惠券面板（`product/product/getCoupon` + `user/coupon/claim`）；
 * - 秒杀面板（`promotion/seckill/price`，随 SKU 切换刷新）；
 * - 拼团面板（`promotion/groupon/getGrouponInfo`）；
 * - 预售面板（详情 `presaleInfo` + `product/product/getPresaleDepositAmount` 定金）；
 * - 店铺信息卡（`shop/shop/detail`）；
 * - 猜你喜欢（`common/recommend/guessLike`）；
 * - 分享弹窗（复制链接 + 二维码 + 微博/QQ 空间分享）；
 * - SKU 规格图切换主图（选中带 attrPic 的规格值即切换主图，取消选择恢复）；
 * - B2B 批发阶梯价展示（详情 `wholesalePriceList` 存在时）。
 */

interface SkuValue {
  value: string;
  attributesId: number;
  stock: number;
  /** 规格原图（attrPic）：切到 624px 主图位时用，避免 200px 缩略图被拉伸发糊 */
  pic?: string;
  /** 规格缩略图（attrPicThumb）：仅用于 80px 规格按钮 */
  picThumb?: string;
}

interface SkuGroup {
  name: string;
  values: SkuValue[];
}

interface SkuRow {
  skuId?: number;
  skuStock?: number;
  skuPrice?: string | number;
  price?: string | number;
  isEnabled?: number | null;
  limitNumber?: number;
  picThumb?: string;
  picUrl?: string;
  /** 规格值（旧版 skuValue，管道符分隔，如「红色|L」），B2B 批量列表标题用 */
  skuValue?: string;
  skuData?: Array<{ name?: string; value?: string }>;
}

interface CommentRow {
  commentId?: number;
  content?: string;
  rank?: number;
  addTime?: string;
  username?: string;
  nickname?: string;
  avatar?: string;
  pics?: Array<string | Record<string, any>>;
  replies?: Array<Record<string, any>>;
}

interface ConsultRow {
  id?: number;
  content?: string;
  title?: string;
  username?: string;
  addTime?: string;
  createTime?: string;
  replyContent?: string;
  replies?: Array<Record<string, any>>;
}

interface CouponItem {
  couponId?: number;
  couponName?: string;
  couponMoney?: number | string;
  couponDiscount?: number | string;
  couponType?: number;
  couponDesc?: string;
  minOrderAmount?: number | string;
  receiveNum?: number;
  limitNum?: number;
  isReceive?: number;
}

function yuan(value: unknown): string {
  const amount = Number(value || 0);
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 兼容后端 snake_case / 前端 camelCase 两种字段命名。 */
function pick(obj: Record<string, any> | undefined | null, keys: string[], fallback: any = undefined): any {
  if (!obj) return fallback;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return fallback;
}

function pickString(obj: Record<string, any> | undefined | null, keys: string[], fallback = ''): string {
  const value = pick(obj, keys);
  return value === undefined || value === null ? fallback : String(value);
}

function pickNumber(obj: Record<string, any> | undefined | null, keys: string[], fallback = 0): number {
  const value = Number(pick(obj, keys));
  return Number.isFinite(value) ? value : fallback;
}

function formatDateTime(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string' && value.includes('-')) return value;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '';
  return new Date(num * 1000).toLocaleString('zh-CN');
}

function buildSkuGroups(detail: ProductDetailResponse): SkuGroup[] {
  const spe = ((detail as any).attrList?.spe || []) as Array<Record<string, any>>;
  return spe
    .map((group) => ({
      name: String(group?.attrName ?? ''),
      values: ((group?.attrList || []) as Array<Record<string, any>>)
        .map((value) => ({
          value: String(value?.attrValue ?? ''),
          attributesId: Number(value?.attributesId ?? 0),
          stock: Number(value?.skuStock ?? -1),
          pic: value?.attrPic || value?.attrPicThumb || '',
          picThumb: value?.attrPicThumb || value?.attrPic || '',
        }))
        .filter((value) => value.value),
    }))
    .filter((group) => group.name && group.values.length > 0);
}

export default function ProductDetailClient({
  detail,
  uiStyle = 'overseas',
}: {
  detail: ProductDetailResponse;
  /** 1=经典(old) / 2=新版(new) / 3=跨境(overseas)，源码 ?uiStyle= 可预览 */
  uiStyle?: 'old' | 'new' | 'overseas';
}) {
  const { t } = useTranslation();
  const item = detail.item || {};
  const productId = Number(item.productId) || 0;
  const shopId = Number((detail as any).shopId ?? item.shopId) || 0;
  const pictures = detail.picList?.length
    ? detail.picList
    : [{ picUrl: item.picLarge || item.picUrl, picThumb: item.picThumb }];

  const [activeImage, setActiveImage] = useState(0);
  const [skuPic, setSkuPic] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [skuId, setSkuId] = useState<number | undefined>(undefined);
  const [adding, setAdding] = useState(false);

  /**
   * SKU 实时可用性（价格 / 库存 / 划线价）。
   *
   * 旧版 pages/item/src/Product.vue 切规格时调 GET /product/product/getProductAvailability
   * 重拉当前 SKU 的 price/stock，页面价格、库存、限购上限随规格变化。
   * 新版此前直接用 skuList 里的静态 skuPrice → 切规格后价格/库存不刷新（价格错误风险）。
   */
  const [availability, setAvailability] = useState<Record<string, any> | null>(null);

  /**
   * B2B 批量采购（旧版 components/product/B2bTab.vue + B2bSku.vue + ProductAmount.vue）。
   * 仅当 isB2B && skuList.length > 1 && bulkPurchase === 1 时启用。
   */
  const [b2bTabIndex, setB2bTabIndex] = useState<0 | 1>(0);
  const [b2bSkuList, setB2bSkuList] = useState<Array<Record<string, any>>>([]);
  const [b2bAmount, setB2bAmount] = useState<Record<string, any> | null>(null);

  /**
   * 带价附加属性选中项（attr_type=2）。
   * 旧版 components/product/ProductAttr.vue 的 checkedAttrs：按组下标记录 attributesId，
   * 提交时以逗号串拼接。此处保持同构。
   */
  const [selectedExtraAttrs, setSelectedExtraAttrs] = useState<Array<number | string | null>>([]);
  // 旧版 OverseasThumb/Thumb：视频缩略图（videoCover + ▶）排在相册之后，点中主区播放 video
  const videoList = ((detail as any).videoList || []) as Array<{ videoUrl?: string; videoCover?: string }>;
  const [playingVideo, setPlayingVideo] = useState(-1);
  // 「相关文章」区块（旧版 ProductRelevanceArticle）与 Tab 开关
  const [relateArticles, setRelateArticles] = useState<Array<Record<string, any>>>([]);
  const [afterSalesFlag, setAfterSalesFlag] = useState(true);
  const [commentEnabled, setCommentEnabled] = useState(1);

  // —— 评价 / 咨询 ——
  const [tab, setTab] = useState<'detail' | 'comment' | 'consult' | 'service'>('detail');
  const [commentStat, setCommentStat] = useState<Record<string, any>>({});
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentTotal, setCommentTotal] = useState(0);
  const [commentPage, setCommentPage] = useState(1);
  const [commentLoading, setCommentLoading] = useState(false);
  const [consults, setConsults] = useState<ConsultRow[]>([]);
  const [consultTotal, setConsultTotal] = useState(0);
  const [consultPage, setConsultPage] = useState(1);
  const [consultLoading, setConsultLoading] = useState(false);

  // —— 营销 / 店铺 / 推荐 ——
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [seckillPrice, setSeckillPrice] = useState<number | null>(null);
  const [grouponInfo, setGrouponInfo] = useState<Record<string, any> | null>(null);
  const [presaleDeposit, setPresaleDeposit] = useState(0);
  const [shopInfo, setShopInfo] = useState<Record<string, any> | null>(null);
  const [recommend, setRecommend] = useState<Array<Record<string, any>>>([]);
  /** 猜你喜欢 / 精选好物：商品卡统一走 ProductCard，列数按容器宽度算 5~6 列 */
  const recommendGridRef = useRef<HTMLDivElement | null>(null);
  const recommendColumns = useProductColumns(recommendGridRef);

  // —— 收藏 / 分享 ——
  const [collected, setCollected] = useState(false);
  const [collecting, setCollecting] = useState(false);
  /** 服务说明手风琴（参考新版样式） */
  const [openService, setOpenService] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [qrData, setQrData] = useState('');

  const skuGroups = useMemo(() => buildSkuGroups(detail), [detail]);
  const skuList = (detail.skuList || []) as SkuRow[];
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (typeof window !== 'undefined') {
      const urlSkuId = new URL(window.location.href).searchParams.get('skuId')?.trim() || '';
      const matched = urlSkuId ? ((detail.skuList || []) as SkuRow[]).find((sku) => String(sku.skuId ?? '') === urlSkuId) : undefined;
      if (matched) {
        (matched.skuData || []).forEach((entry) => {
          if (entry.name && entry.value) initial[String(entry.name)] = String(entry.value);
        });
        return initial;
      }
      if (urlSkuId) {
        const url = new URL(window.location.href);
        url.searchParams.delete('skuId');
        window.history.replaceState({ ...window.history.state }, '', url.href);
      }
    }
    const checked = ((detail as any).checkedValue || []) as string[];
    checked.forEach((token) => {
      const text = String(token || '');
      const index = text.indexOf(':');
      if (index > 0) initial[text.slice(0, index)] = text.slice(index + 1);
    });
    return initial;
  });

  const selectedSku = useMemo(() => {
    if (skuGroups.length) {
      const picked = skuGroups
        .map((group) => selected[group.name])
        .filter((value): value is string => Boolean(value));
      if (picked.length !== skuGroups.length) return undefined;
      return skuList.find((sku) => {
        const data = sku.skuData || [];
        if (data.length !== skuGroups.length) return false;
        return skuGroups.every((group) =>
          data.some((entry) => String(entry.name || '') === group.name && String(entry.value || '') === selected[group.name]),
        );
      });
    }
    if (skuId) return skuList.find((sku) => Number(sku.skuId) === Number(skuId));
    return undefined;
  }, [skuGroups, selected, skuList, skuId]);

  /**
   * 实时可用性优先：切规格后 price/stock 由 getProductAvailability 重拉，
   * 静态 skuList 只作为兜底（接口失败时用）。
   */
  const livePrice = availability?.price;
  const liveStock = availability?.stock;
  const stock = Number(liveStock ?? selectedSku?.skuStock ?? item.productStock ?? 0);
  const limit = Number(selectedSku?.limitNumber ?? item.limitNumber ?? 0);
  const maxQuantity = limit > 0 ? limit : stock > 0 ? stock : 1;
  const outOfStock = stock <= 0;
  const skuDisabled = selectedSku?.isEnabled === 0;
  const price = livePrice ?? selectedSku?.skuPrice ?? selectedSku?.price ?? item.productPrice;
  const requireSku = skuGroups.length > 0 && !selectedSku;
  // 优先原图：picThumb 是 200px 缩略图，放进 624px 主图位会明显发糊
  const mainImage = skuPic || selectedSku?.picUrl || selectedSku?.picThumb || pictures[activeImage]?.picUrl || pictures[activeImage]?.picThumb || '';

  const wholesalePriceList = useMemo(() => {
    const raw = (item as any).wholesalePriceList ?? (detail as any).wholesalePriceList;
    if (Array.isArray(raw)) return raw as Array<Record<string, any>>;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as Array<Record<string, any>>) : [];
      } catch {
        return [];
      }
    }
    return [];
  }, [item, detail]);

  const presaleInfo = (item as any).presaleInfo ?? (detail as any).presaleInfo;

  useEffect(() => {
    if (quantity > maxQuantity) setQuantity(maxQuantity);
  }, [maxQuantity, quantity]);

  useEffect(() => {
    if (skuGroups.length === 0 && skuList.length === 1 && !skuId) {
      setSkuId(Number(skuList[0].skuId));
    }
  }, [skuGroups.length, skuList, skuId]);

  /**
   * 切规格 → 重拉当前 SKU 的实时可用性（价格 / 库存）。
   * 旧版 pages/item/src/Product.vue 通过 getProductAvailability 实现，新版此前缺失。
   */
  useEffect(() => {
    if (!productId) return;
    const targetSkuId = Number(selectedSku?.skuId ?? skuId ?? 0);
    let alive = true;
    setAvailability(null);
    apiGet<Record<string, any>>('product/product/getProductAvailability', {
      id: productId,
      skuId: targetSkuId || undefined,
    })
      .then((result) => {
        if (alive && result) setAvailability(result);
      })
      .catch(() => {
        /* 接口失败时回退静态 skuList 的 skuPrice / skuStock */
      });
    return () => {
      alive = false;
    };
  }, [productId, selectedSku?.skuId, skuId]);

  /**
   * B2B 批量采购模式：拉取每个 SKU 的实时 price / stock。
   * 旧版 pages/item/src/Product.vue:956 getBatchProductAvailabilityList。
   */
  const isB2BMode = useMemo(() => {
    const bulk = Number((detail as any).bulkPurchase ?? (item as any).bulkPurchase ?? 0) === 1;
    return bulk && skuList.length > 1;
  }, [detail, item, skuList.length]);

  useEffect(() => {
    if (!isB2BMode || !skuList.length) {
      setB2bSkuList([]);
      return undefined;
    }
    let alive = true;
    const skuIds = skuList.map((sku) => Number(sku.skuId)).filter(Boolean).join(',');
    if (!skuIds) return undefined;
    apiGet<Record<string, any>>('product/product/getBatchProductAvailability', { skuIds })
      .then((result) => {
        if (!alive || !result) return;
        const rows = skuList.map((sku) => {
          const sid = String(sku.skuId ?? '');
          const live = result[sid] || {};
          return {
            skuId: sku.skuId,
            title: String(sku.skuValue ?? '').replace(/\|/g, ','),
            price: live.price ?? sku.skuPrice ?? item.productPrice,
            stock: live.stock ?? sku.skuStock ?? 0,
            num: 0,
          };
        });
        setB2bSkuList(rows);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [isB2BMode, skuList, item.productPrice]);

  // —— 首屏并行加载：优惠券 / 拼团 / 店铺 / 推荐 / 评价统计 / 评价首屏 / 咨询首屏 ——
  useEffect(() => {
    if (!productId) return;
    let alive = true;
    // 旧版 Product.vue:841：周期购商品跳 pcmobile（H5 承载）
    if (Number((detail as any).deliveryMode) === 2) {
      const target = new URLSearchParams({ path: '/pages/product/index', id: String(productId) });
      if (shopId) target.set('shopId', String(shopId));
      window.location.href = `/pcmobile?${target.toString()}`;
      return;
    }
    // 旧版 ProductRelevanceArticle：详情区「相关文章」区块
    apiGet<Array<Record<string, any>>>('category/category/relateArticle', { productId })
      .then((list) => alive && setRelateArticles(Array.isArray(list) ? list : []))
      .catch(() => undefined);
    // 旧版 afterSalesFlag：售后 Tab 开关（showTemplateContent=false 隐藏，缺省展示）
    apiGet<Record<string, any> | null>('common/config/afterSalesService')
      .then((config) => alive && setAfterSalesFlag(Number(config?.showTemplateContent ?? 1) !== 0))
      .catch(() => undefined);
    // D1146：评价开关关闭时隐藏「评价」Tab（旧 commonStore.productCommentEnabled）
    apiGet<Record<string, any> | null>('common/config/base')
      .then((base) => alive && setCommentEnabled(Number(base?.productCommentEnabled ?? 1)))
      .catch(() => undefined);
    apiGet<CouponItem[]>('product/product/getCoupon', { id: productId, shopId })
      .then((list) => alive && setCoupons(Array.isArray(list) ? list : []))
      .catch(() => undefined);
    apiGet<Record<string, any> | null>('promotion/groupon/getGrouponInfo', { productId })
      .then((info) => alive && setGrouponInfo(info || null))
      .catch(() => undefined);
    if (shopId > 0) {
      apiGet<Record<string, any> | null>('shop/shop/detail', { shopId })
        .then((info) => alive && setShopInfo(info || null))
        .catch(() => undefined);
    }
    apiGet<Array<Record<string, any>>>('common/recommend/guessLike', { page: 1, size: 8, shopId: shopId || undefined })
      .then((list) => alive && setRecommend(Array.isArray(list) ? list : []))
      .catch(() => undefined);
    apiGet<Record<string, any>>('product/product/getComment', { id: productId, shopId })
      .then((stat) => {
        if (!alive) return;
        setCommentStat(stat || {});
        setCommentTotal(pickNumber(stat, ['total'], 0));
      })
      .catch(() => undefined);
    setCommentLoading(true);
    apiGet<{ records?: CommentRow[]; total?: number }>('product/product/getCommentList', { id: productId, page: 1, shopId })
      .then((result) => {
        if (!alive) return;
        setComments(Array.isArray(result?.records) ? result.records : []);
        setCommentTotal((prev) => Math.max(prev, pickNumber(result, ['total'], 0)));
      })
      .catch(() => undefined)
      .finally(() => alive && setCommentLoading(false));
    setConsultLoading(true);
    apiGet<{ records?: ConsultRow[]; total?: number }>('product/product/getFeedbackList', { productId, page: 1, size: 5 })
      .then((result) => {
        if (!alive) return;
        setConsults(Array.isArray(result?.records) ? result.records : []);
        setConsultTotal(pickNumber(result, ['total'], 0));
      })
      .catch(() => undefined)
      .finally(() => alive && setConsultLoading(false));
    return () => {
      alive = false;
    };
  }, [productId, shopId]);

  // —— 秒杀价随 SKU 变化刷新；预售定金按 SKU 查询 ——
  useEffect(() => {
    if (!productId) return;
    let alive = true;
    const query: Record<string, any> = { productId };
    if (selectedSku?.skuId) query.skuId = Number(selectedSku.skuId);
    apiGet<{ seckillPrice?: number | string | null }>('promotion/seckill/price', query)
      .then((result) => {
        if (!alive) return;
        const value = pick(result, ['seckillPrice', 'seckill_price']);
        setSeckillPrice(value === undefined || value === null ? null : Number(value));
      })
      .catch(() => alive && setSeckillPrice(null));
    // getPresaleDepositAmount 要求 skuId 必填：未选规格时回退默认 SKU。
    const depositSkuId = Number(selectedSku?.skuId || skuId || skuList[0]?.skuId || 0);
    if (presaleInfo && depositSkuId > 0) {
      apiGet<number | string>('product/product/getPresaleDepositAmount', { productId, skuId: depositSkuId })
        .then((amount) => alive && setPresaleDeposit(Number(amount) || 0))
        .catch(() => undefined);
    }
    return () => {
      alive = false;
    };
  }, [productId, selectedSku?.skuId, presaleInfo]);

  const requireLogin = () => {
    if (typeof window === 'undefined') return true;
    if (localStorage.getItem('accessToken')) return true;
    window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    return false;
  };

  /** 规格选择 + SKU 主图切换 + 地址栏 skuId 同步。 */
  const toggleSpec = (group: SkuGroup, value: SkuValue) => {
    if (value.stock === 0) {
      Toast.warning({ content: '该规格暂时缺货' });
      return;
    }
    const active = selected[group.name] === value.value;
    const next = { ...selected, [group.name]: active ? '' : value.value };
    setSelected(next);
    setQuantity(1);
    // SKU 图切换：选中带图的规格值 → 主图切到该图；取消选择 → 恢复相册主图
    setSkuPic(active ? '' : value.pic || '');
    const matched = skuGroups.length
      ? skuList.find((sku) => {
          const data = sku.skuData || [];
          return (
            data.length === skuGroups.length &&
            skuGroups.every((entry) => data.some((row) => String(row.name || '') === entry.name && String(row.value || '') === next[entry.name]))
          );
        })
      : undefined;
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (matched?.skuId) url.searchParams.set('skuId', String(matched.skuId));
      else url.searchParams.delete('skuId');
      window.history.replaceState({ ...window.history.state }, '', url.href);
      if (matched?.skuId) setSkuId(Number(matched.skuId));
    }
  };

  const changeQuantity = (value: number) => {
    const next = Math.floor(Number(value) || 1);
    if (next < 1) return;
    if (next > maxQuantity) {
      Toast.error({ content: limit > 0 && maxQuantity === limit ? t('限购{n}件', { n: limit }) : t('库存不足') });
      return;
    }
    setQuantity(next);
  };

  const add = async (next?: 'cart' | 'buy') => {
    if (requireSku) {
      Toast.warning({ content: '请先选择商品规格' });
      return;
    }
    if (outOfStock || skuDisabled) {
      Toast.error({ content: '该商品暂时缺货' });
      return;
    }
    if (!requireLogin()) return;
    setAdding(true);
    try {
      const grouponData = buildGrouponData();
      const result = await addToCart({
        id: Number(item.productId),
        number: quantity,
        skuId: selectedSku?.skuId ? Number(selectedSku.skuId) : skuId,
        isQuick: next === 'buy' ? 1 : 0,
        // 带价附加属性（attr_type=2）：旧版 ProductAttr.vue 选中后以 id 串提交
        ...(extraAttrIds ? { extraAttrIds } : {}),
        // 旧版 Buy.vue：拼团商品加购时携带 grouponData（参团/开团上下文）
        ...(grouponData ? { grouponData } : {}),
      } as Parameters<typeof addToCart>[0]);
      if (next === 'buy') {
        const flowType = Number((result as any)?.flowType) || 1;
        const query = new URLSearchParams({ flowType: String(flowType) });
        const pickupSkuId = selectedSku?.skuId || skuId;
        if (pickupSkuId) query.set('skuId', String(pickupSkuId));
        window.location.href = `/order/check?${query.toString()}`;
        return;
      }
      Toast.success({ content: '已加入购物车' });
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('pc-cart-change'));
    } catch (error) {
      const message = error instanceof Error ? error.message : '加入购物车失败';
      if (message.includes('登录') || message.includes('401')) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      } else {
        Toast.error({ content: message });
      }
    } finally {
      setAdding(false);
    }
  };

  /**
   * 带价附加属性：选中/取消切换（再次点击同一项取消）。
   * 旧版 components/product/ProductAttr.vue handleAttrClick。
   */
  const toggleExtraAttr = (groupIndex: number, attributesId?: number | string) => {
    setSelectedExtraAttrs((current) => {
      const next = [...current];
      next[groupIndex] = current[groupIndex] === attributesId ? null : (attributesId ?? null);
      return next;
    });
  };

  /** 选中的附加属性 id 串（提交给后端，对齐旧版 checkedAttrs.filter(Boolean).join(",")） */
  const extraAttrIds = selectedExtraAttrs.filter(Boolean).join(',');

  /**
   * B2B 批量采购：修改某个 SKU 的采购数量。
   * 旧版 components/product/B2bSku.vue handleNumberChange（带 300ms 防抖）。
   */
  const changeB2bNum = (index: number, value: number) => {
    setB2bSkuList((current) =>
      current.map((row, i) => {
        if (i !== index) return row;
        const max = Math.max(0, Number(row.stock) || 0);
        const next = Math.max(0, Math.min(max, Math.floor(Number(value) || 0)));
        return { ...row, num: next };
      }),
    );
  };

  /**
   * B2B 批量采购：重算合计（件数 / 总额）。
   * 旧版 components/product/B2bSku.vue __getProductAmount → POST /product/product/getProductAmount
   * （参数 {id, skuItem}）；接口不可用时本地兜底累加。
   */
  useEffect(() => {
    if (!isB2BMode || b2bTabIndex !== 1 || !b2bSkuList.length) {
      setB2bAmount(null);
      return undefined;
    }
    const selected = b2bSkuList.filter((row) => Number(row.num) > 0);
    if (!selected.length) {
      setB2bAmount({ count: 0, total: 0 });
      return undefined;
    }
    let alive = true;
    const skuItem = selected.map((row) => ({
      skuId: Number(row.skuId) || 0,
      num: Number(row.num) || 0,
      price: Number(row.price) || 0,
    }));
    apiPost<Record<string, any>>('product/product/getProductAmount', { id: productId, skuItem })
      .then((result) => {
        if (!alive || !result) return;
        const count = Number(result.count ?? selected.reduce((sum, row) => sum + Number(row.num || 0), 0));
        const total = Number(result.total ?? selected.reduce((sum, row) => sum + Number(row.num || 0) * Number(row.price || 0), 0));
        setB2bAmount({ ...result, count, total });
      })
      .catch(() => {
        const count = selected.reduce((sum, row) => sum + Number(row.num || 0), 0);
        const total = selected.reduce((sum, row) => sum + Number(row.num || 0) * Number(row.price || 0), 0);
        setB2bAmount({ count, total });
      });
    return () => {
      alive = false;
    };
  }, [isB2BMode, b2bTabIndex, b2bSkuList, productId]);

  const collect = async () => {
    if (!requireLogin()) return;
    setCollecting(true);
    try {
      if (collected) {
        await apiPost('user/collectProduct/cancel', { productId });
        setCollected(false);
        Toast.success({ content: '已取消收藏' });
      } else {
        await apiPost('user/collectProduct/save', { productId });
        setCollected(true);
        Toast.success({ content: '已收藏商品' });
      }
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '收藏失败' });
    } finally {
      setCollecting(false);
    }
  };

  const claimCoupon = async (coupon: CouponItem) => {
    if (!requireLogin()) return;
    try {
      await apiPost('user/coupon/claim', { couponId: coupon.couponId });
      Toast.success({ content: '领取成功' });
      setCoupons((list) => list.map((row) => (row.couponId === coupon.couponId ? { ...row, isReceive: 1 } : row)));
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '领取失败' });
    }
  };

  const loadMoreComments = async () => {
    const next = commentPage + 1;
    setCommentLoading(true);
    try {
      const result = await apiGet<{ records?: CommentRow[]; total?: number }>('product/product/getCommentList', {
        id: productId,
        page: next,
        shopId,
      });
      setComments((list) => [...list, ...((result?.records || []) as CommentRow[])]);
      setCommentTotal((prev) => Math.max(prev, pickNumber(result, ['total'], 0)));
      setCommentPage(next);
    } catch {
      Toast.error({ content: '评价加载失败' });
    } finally {
      setCommentLoading(false);
    }
  };

  const loadMoreConsults = async () => {
    const next = consultPage + 1;
    setConsultLoading(true);
    try {
      const result = await apiGet<{ records?: ConsultRow[]; total?: number }>('product/product/getFeedbackList', {
        productId,
        page: next,
        size: 5,
      });
      setConsults((list) => [...list, ...((result?.records || []) as ConsultRow[])]);
      setConsultTotal((prev) => Math.max(prev, pickNumber(result, ['total'], 0)));
      setConsultPage(next);
    } catch {
      Toast.error({ content: '咨询加载失败' });
    } finally {
      setConsultLoading(false);
    }
  };

  const openShare = async () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href.split('#')[0];
    setShareUrl(url);
    setShareOpen(true);
    if (!qrData) {
      try {
        const QRCode = (await import('qrcode')).default;
        setQrData(await QRCode.toDataURL(url, { width: 160, margin: 1 }));
      } catch {
        setQrData('');
      }
    }
  };

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      Toast.success({ content: '商品链接已复制' });
    } catch {
      window.prompt('复制商品链接', shareUrl);
    }
  };

  const grouponPrice = grouponInfo ? pick(grouponInfo, ['grouponPrice', 'minGroupPrice', 'groupon_price']) : null;
  const grouponNum = grouponInfo ? pickNumber(grouponInfo, ['minGroupNum', 'min_group_num'], 0) : 0;
  const grouponJoined = grouponInfo ? pickNumber(grouponInfo, ['joinNumCount', 'join_num_count'], 0) : 0;
  // 旧版 Product.vue:821 / groupByInvited.vue:296：被邀请参团进详情时 URL 携带 grouponPromotionRecordId，
  // 加购时随 grouponData 下发，后端据此参到指定的团（开团时不带）。
  const [grouponRecordId, setGrouponRecordId] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setGrouponRecordId(Number(new URL(window.location.href).searchParams.get('grouponPromotionRecordId')) || 0);
  }, [productId]);

  /** 旧版 Buy.vue:88-96：拼团上下文 grouponData（活动 + 活动商品 + 明细 + 参团记录）。 */
  const buildGrouponData = (): Record<string, number> | undefined => {
    if (!grouponInfo) return undefined;
    const promotionId = pickNumber(grouponInfo, ['grouponPromotionId', 'grouponId'], 0);
    const itemId = pickNumber(grouponInfo, ['grouponPromotionItemId'], 0);
    if (!promotionId || !itemId) return undefined;
    const details = (grouponInfo.grouponPromotionDetails || []) as Array<Record<string, any>>;
    const matched = selectedSku?.skuId
      ? details.find((row) => Number(row.skuId) === Number(selectedSku.skuId))
      : undefined;
    const detailRow = matched || details[0];
    const data: Record<string, number> = {
      grouponPromotionId: promotionId,
      grouponPromotionItemId: itemId,
      grouponDetailId: detailRow ? pickNumber(detailRow, ['grouponDetailId'], 0) : 0,
      price: Number(pick(grouponInfo, ['grouponPrice', 'minGroupPrice', 'minGrouponPrice'], 0)),
    };
    if (grouponRecordId > 0) data.grouponPromotionRecordId = grouponRecordId;
    return data;
  };
  const commentGoodPercent = pickString(commentStat, ['goodPercent'], '0.00');
  const commentAverage = pickNumber(commentStat, ['averageRank'], 0);

  /** 跨境版折扣角标：现价 / 市场价 → 「x.x折」，无市场价或现价不低于市场价时不展示 */
  const discountFold = useMemo(() => {
    const market = Number(item.marketPrice);
    const current = Number(price);
    if (!(market > 0) || !(current > 0) || current >= market) return '';
    return String(Math.round((current / market) * 100) / 10);
  }, [item.marketPrice, price]);

  // —— 跨境版锚点长滚动：点击定位 + 滚动高亮（源码 changeType / sectionRefs / tab-main）——
  const [activeAnchor, setActiveAnchor] = useState('detail');
  // 与下方 sections 顺序一致（评价/售后受开关控制；此处先于 sections 声明，避免引用未初始化变量）
  const anchorKeys = [
    'detail',
    ...(commentEnabled === 1 ? ['comment'] : []),
    'consult',
    ...(afterSalesFlag ? ['service'] : []),
    'article',
  ];
  useEffect(() => {
    if (uiStyle !== 'overseas') return;
    const onScroll = () => {
      let current = anchorKeys[0];
      for (const key of anchorKeys) {
        const el = document.getElementById(`pds-sec-${key}`);
        if (el && el.getBoundingClientRect().top <= 150) current = key;
      }
      setActiveAnchor(current);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
    // anchorKeys 为组件内常量，无需进入依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiStyle]);

  const scrollToAnchor = (key: string) => {
    const el = document.getElementById(`pds-sec-${key}`);
    if (el && typeof window !== 'undefined') {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76, behavior: 'smooth' });
    }
    setActiveAnchor(key);
  };

  // ==================== 内容块（三套布局共用，共享全部状态与交互）====================

  /** 源码 CommonCategoryNavigation / OverseasCategoryNavigation */
  const crumb = (
    <nav className="pds-crumb">
      <Link href="/">{t('首页')}</Link>
      <span>/</span>
      <Link href="/search">{t('全部商品')}</Link>
      <span>/</span>
      <span className="pds-crumb__current" title={item.productName || ''}>{item.productName}</span>
    </nav>
  );

  /** 跨境版顶部 flex_csb 右侧：分享至 + 社交渠道（源码 shareWidth） */
  const shareSocial = (
    <div className="pds-share-social">
      <span className="pds-share-social__title">{t('分享至')}</span>
      <button type="button" onClick={() => void openShare()}>{t('复制链接')}</button>
      <a
        href={`https://service.weibo.com/share/share.php?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(item.productName || '')}`}
        target="_blank"
        rel="noreferrer"
      >{t('微博')}</a>
      <a
        href={`https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(item.productName || '')}`}
        target="_blank"
        rel="noreferrer"
      >{t('QQ 空间')}</a>
      <button type="button" onClick={() => void openShare()}>{t('二维码')}</button>
    </div>
  );

  /**
   * 源码 pages/item/src/Product.vue 377 `.shop-info` 里是 components/product/ShopInfo.vue。
   * 类名照抄该文件：`.shop-info-wrap > .shop-main > .shop-logo + .name-warp(.name-link >
   * .name > .name-arrow + .shop-badge / .shop-rate > .rate-score …) + .shop-actions(.button-wrap >
   * .tig-button-no-ripple.action-btn > .button-content)`。
   */
  const shopCard = shopInfo ? (
    <div className="shop-info mp-shop-info">
      <div className="shop-info-wrap">
        <div className="shop-main">
          <div className="shop-logo">
            {pickString(shopInfo, ['shopLogo']) ? <img className="img" src={pickString(shopInfo, ['shopLogo'])} alt="" /> : null}
          </div>
          <div className="name-warp">
            <div className="name-link">
              <div className="name">
                {shopId > 0 ? <Link href={`/shop/${shopId}`}>{pickString(shopInfo, ['shopTitle'], '店铺')}</Link> : pickString(shopInfo, ['shopTitle'], '店铺')}
                <i className="name-arrow" />
                {pickString(shopInfo, ['shopBadge']) ? <span className="shop-badge">{pickString(shopInfo, ['shopBadge'])}</span> : null}
              </div>
              <div className="shop-rate">
                <span className="rate-score">{pickString(shopInfo, ['shopDetailedAddress'], '')}</span>
              </div>
            </div>
          </div>
          <div className="shop-actions">
            {shopId > 0 ? (
              <div className="button-wrap">
                <button type="button" className="tig-button-no-ripple action-btn">
                  <span className="button-content">{t('进入店铺')}</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  ) : null;

  /** 源码 ProductThumb / ProductThumbNew / OverseasThumb（含视频缩略图 + 播放） */
  const gallery = (
    <div className="pds-gallery">
      <div className="pds-gallery__main">
        {playingVideo >= 0 && videoList[playingVideo]?.videoUrl ? (
          <video
            key={videoList[playingVideo].videoUrl}
            src={videoList[playingVideo].videoUrl}
            controls
            autoPlay
            style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
          />
        ) : (
          <img src={mainImage} alt={item.productName} />
        )}
      </div>
      <div className="pds-gallery__thumbs">
        {pictures.map((pic: any, index: number) => (
          <button
            key={pic.picId || index}
            type="button"
            className={index === activeImage && !skuPic && playingVideo < 0 ? 'is-active' : ''}
            onClick={() => {
              setSkuPic('');
              setActiveImage(index);
              setPlayingVideo(-1);
            }}
          >
            <img src={pic.picThumb || pic.picUrl} alt="" />
          </button>
        ))}
        {videoList.map((video, index) => (
          <button
            key={`video-${index}`}
            type="button"
            className={playingVideo === index ? 'is-active' : ''}
            onClick={() => setPlayingVideo(index)}
          >
            <img src={video.videoCover || pictures[0]?.picThumb || ''} alt={t('商品视频')} />
            <span className="pds-gallery__video-icon" aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );

  /** 经典版画廊下方 share_wish：商品编号 / 收藏 / 分享 */
  /** 源码 385 `.share_wish.flex`：386 `.product-number` + 388 `.product-tools`（390 收藏图标） */
  const galleryMeta = (
    <div className="share_wish flex">
      <span className="product-number" title={item.productSn || ''}>
        商品编号：{item.productSn || '-'}
      </span>
      <div className="product-tools">
        <span
          className={`iconfont-pc collect ico-color ${collected ? 'icon-yishoucang' : 'icon-shoucang'}`}
          onClick={() => void collect()}
        >
          <i>{collected ? '已收藏' : '收藏'}</i>
        </span>
        <button type="button" className="hand-pointer" onClick={() => void openShare()}>{t('分享')}</button>
      </div>
    </div>
  );

  /** 源码 overseas/Thumb.vue:39-42：跨境版收藏心形浮在主图右上角（经典版才放画廊下方 share_wish） */
  const collectButton = (
    <button
      type="button"
      className={`pds-os__collect${collected ? ' is-collected' : ''}`}
      onClick={() => void collect()}
      aria-label={collected ? t('已收藏') : t('收藏')}
      title={collected ? t('已收藏') : t('收藏')}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill={collected ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.2l7.8-7.7 1.1-1.1a5.5 5.5 0 0 0 0-7.8z" />
      </svg>
    </button>
  );

  /** 源码 416 `.product_name`：417 `.name` / 420 `.productName > .tagName`(预售) + 424 `p.desc` */
  const heading = (
    <div className="product_name">
      {/* 源码 overseas/ProductInfo.vue .product_name 只有预售才带 .tagName，
          跨境版普通商品不显示「新品 / 热销 / 普通商品」这类前缀标签 */}
      {uiStyle !== 'overseas' && item.isNew ? <span className="tagName">{t('新品')}</span> : null}
      {uiStyle !== 'overseas' && item.isHot ? <span className="tagName">{t('热销')}</span> : null}
      {uiStyle !== 'overseas' && detail.deliveryModeText ? <span className="tagName">{detail.deliveryModeText}</span> : null}
      {outOfStock ? <span className="tagName">{t('已售罄')}</span> : null}
      {/*
        旧版 417/420 两个分支按 isPresale 切换；新版详情接口没有预售字段，
        所以固定走非预售分支 `.name`（预售版是 `.productName > .tagName`）。
      */}
      <div className="name">{item.productName}</div>
      {item.productBrief ? <p className="desc">{item.productBrief}</p> : null}
    </div>
  );

  /** 营销面板：秒杀 / 拼团 / 预售 / 优惠券 / 进行中拼单 */
  const promos = (
    <>
      {grouponInfo ? (
        <ProductJoiningClient productId={productId} groupon={grouponInfo} skuId={selectedSku?.skuId ? Number(selectedSku.skuId) : skuId} number={quantity} />
      ) : null}
      {seckillPrice !== null ? (
        <div className="pds-panel pds-panel--seckill">
          <div className="pds-panel__row">
            <Tag color="red">{t('限时秒杀')}</Tag>
            <b className="pds-panel__price">¥ {yuan(seckillPrice)}</b>
            {Number(price) > seckillPrice ? <del>¥ {yuan(price)}</del> : null}
          </div>
          <p className="pds-panel__note">{t('秒杀价随规格变化，实际以下单结算为准')}</p>
        </div>
      ) : null}

      {grouponInfo && grouponPrice ? (
        <div className="pds-panel pds-panel--groupon">
          <div className="pds-panel__row">
            <Tag color="orange">{grouponRecordId > 0 ? '好友邀请参团' : '拼团'}</Tag>
            <b className="pds-panel__price">¥ {yuan(grouponPrice)}</b>
            {grouponNum > 0 ? <span className="pds-panel__note">{grouponNum} 人成团</span> : null}
            {grouponNum > 0 ? <span className="pds-panel__note">已拼 {grouponJoined} 件</span> : null}
          </div>
          {/* 旧版无「去拼团」跳转：参团/开团由本页加购按钮承担（grouponData 随 addToCart 下发）；
              进行中拼单列表（旧 ProductJoining）在中优先级批次补齐 */}
          {grouponRecordId > 0 ? (
            <p className="pds-panel__note">你正在参加好友发起的拼团，选择规格后点击「立即购买 / 加入购物车」即参团</p>
          ) : null}
        </div>
      ) : null}

      {presaleInfo || Number((item as any).prepayPrice) > 0 ? (
        <div className="pds-panel pds-panel--presale">
          <div className="pds-panel__row">
            <Tag color="blue">{t('预售')}</Tag>
            {presaleDeposit > 0 ? <b>定金 ¥ {yuan(presaleDeposit)}</b> : null}
            {Number((item as any).prepayPrice) > 0 ? <span>预售价 ¥ {yuan((item as any).prepayPrice)}</span> : null}
          </div>
          {presaleInfo && typeof presaleInfo === 'object' ? (
            <p className="pds-panel__note">
              {pickString(presaleInfo, ['presaleStartTime', 'startTime', 'preSaleStartTime'], '')}
              {pickString(presaleInfo, ['presaleEndTime', 'endTime', 'preSaleEndTime'], '') ? ' 至 ' : ''}
              {pickString(presaleInfo, ['presaleEndTime', 'endTime', 'preSaleEndTime'], '')}
            </p>
          ) : null}
        </div>
      ) : null}

      {coupons.length ? (
        <div className="pds-panel pds-panel--coupon">
          <div className="pds-panel__head">
            <span>{t('优惠券')}</span>
            <Link href="/coupon/list">领券中心 &gt;</Link>
          </div>
          <div className="pds-coupons">
            {coupons.slice(0, 6).map((coupon) => {
              const received = Number(coupon.isReceive) === 1;
              return (
                <div className={`pds-coupon${received ? ' is-received' : ''}`} key={coupon.couponId}>
                  <div className="pds-coupon__value">
                    {Number(coupon.couponType) === 2 ? `${Number(coupon.couponDiscount || 0)}折` : `¥${Number(coupon.couponMoney || 0).toFixed(0)}`}
                  </div>
                  <div className="pds-coupon__desc">{t('满{n}可用', { n: Number(coupon.minOrderAmount || 0).toFixed(0) })}</div>
                  <Button size="small" theme={received ? 'borderless' : 'solid'} type="primary" disabled={received} onClick={() => void claimCoupon(coupon)}>
                    {received ? '已领取' : '领取'}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </>
  );

  /**
   * 源码 components/product/ProductInfo.vue 123–157 `.basic.bg`：市场价 / 本站价 / 评价 / 优惠活动；
   * 237–263 `.basic-info`：销量 / 服务。旧版老 UI 分支（`uiVersion !== 'new'`）的标记结构。
   * 价格用旧版 FormatPrice 的产物结构 `<div class="price align-bottom"><div class="util">…`
   *
   * 跨境版分流：overseas/ProductInfo.vue 204–224 的 `.item.main-price-box` 是
   * 「主价（24/36px）+ 划线市场价」同一基线行，销量是「已售 N 件」小灰字行；
   * 与经典版「市场价：/本站价：」标签行式结构不同，故按 uiStyle 分别渲染。
   */
  const priceBlock =
    uiStyle === 'overseas' ? (
      <div className="basic">
        <div className="item main-price-box">
          <div className="price1">
            <div className="price align-bottom">
              <div className="util">¥</div>
              <div className="num">{yuan(price)}</div>
            </div>
          </div>
          {Number(item.marketPrice) > 0 ? (
            <div className="market_price">
              <div className="price align-bottom" style={{ textDecoration: 'line-through' }}>
                <div className="util">¥</div>
                <div className="num">{yuan(item.marketPrice)}</div>
              </div>
            </div>
          ) : null}
          {discountFold ? <span className="pds-os__discount">{discountFold}{t('折')}</span> : null}
        </div>
        {commentTotal > 0 ? (
          <div className="item">
            <div className="rank-info">
              <div className="star">
                <span className={`icon-star icon-star-${commentAverage || 5}`} />
              </div>
              <div className="evaluate">
                {t('已有')} <span className="font-color"> {commentTotal}</span> {t('人评价')}，{commentGoodPercent}% {t('好评')}
              </div>
            </div>
          </div>
        ) : null}
        <div className="item pds-os__sold">
          <div className="num">
            {t('已售')} {item.virtualSales ?? item.sales ?? 0} {t('件')}
          </div>
        </div>
        {coupons.length ? (
          <div className="item">
            <div className="coupon-list-wrap">
              {coupons.map((coupon: any, index: number) => (
                <span className="lyecsquan" key={coupon.couponId ?? index}>
                  {coupon.couponName || coupon.name || t('优惠券')}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    ) : (
    <>
      <div className="basic bg">
        {Number(item.marketPrice) > 0 ? (
          <div className="item">
            <div className="tit">{t('市场价')}：</div>
            <div className="market_price">
              <div className="price align-bottom" style={{ textDecoration: 'line-through' }}>
                <div className="util">¥</div>
                <div className="num">{yuan(item.marketPrice)}</div>
              </div>
            </div>
          </div>
        ) : null}
        <div className="item">
          <div className="tit">{t('本站价')}：</div>
          <div className="price1">
            <div className="price align-bottom">
              <div className="util">¥</div>
              <div className="num">{yuan(price)}</div>
            </div>
          </div>
          {commentTotal > 0 ? (
            <div className="rank-info">
              <div className="tit2">{t('评价')}：</div>
              <div className="star">
                <span className={`icon-star icon-star-${commentAverage || 5}`} />
              </div>
              <div className="evaluate">
                {t('已有')} <span className="font-color"> {commentTotal}</span> {t('人评价')}，{commentGoodPercent}% {t('好评')}
              </div>
            </div>
          ) : null}
        </div>
        {coupons.length ? (
          <div className="item">
            <div className="tit">{t('优惠活动')}：</div>
            <div className="coupon-list-wrap">
              {coupons.map((coupon: any, index: number) => (
                <span className="lyecsquan" key={coupon.couponId ?? index}>
                  {coupon.couponName || coupon.name || t('优惠券')}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div className="basic-info">
        <div className="item">
          <div className="tit">{t('销量')}：</div>
          <div className="num">{item.virtualSales ?? item.sales ?? 0} {t('件')}</div>
        </div>
      </div>
    </>
    );

  const attrs = detail.attrList?.normal?.length ? (
    <div className="pds-attrs">
      {detail.attrList.normal.map((attr: any) => (
        <div key={attr.attrName}>
          <span>{attr.attrName}</span>
          <b>{Array.isArray(attr.attrList) ? attr.attrList.map((v: any) => v.attrValue).filter(Boolean).join(' / ') : attr.attrList || '-'}</b>
        </div>
      ))}
    </div>
  ) : null;

  /**
   * 带价附加属性（attr_type=2，旧版 components/product/ProductAttr.vue）。
   *
   * 每项是一个可点击标签：文案 + 价格（attrPrice）。点击选中/取消，
   * 选中结果以 attributesId 逗号串提交（与旧版 checkedAttrs.join(",") 一致）。
   * 后端 group_attributes 已按 attr_type 分出 extra 并带 attr_price（见
   * crates/services/src/catalog/product_manage.rs:1484），此前仅前端未渲染。
   */
  const extraAttrs = (detail.attrList as any)?.extra as Array<Record<string, any>> | undefined;
  const extraAttrBlock = Array.isArray(extraAttrs) && extraAttrs.length ? (
    <div className="pds-extra-attrs">
      {extraAttrs.map((group, groupIndex) => (
        <div className="pds-extra-attrs__group" key={group.attrName ?? groupIndex}>
          <div className="pds-extra-attrs__title">{group.attrName}</div>
          <div className="pds-extra-attrs__list">
            {(Array.isArray(group.attrList) ? group.attrList : []).map((sub: any) => {
              const active = selectedExtraAttrs[groupIndex] === sub.attributesId;
              return (
                <button
                  type="button"
                  key={sub.attributesId ?? `${groupIndex}-${sub.attrValue}`}
                  className={`pds-extra-attrs__tag${active ? ' is-active' : ''}`}
                  onClick={() => toggleExtraAttr(groupIndex, sub.attributesId)}
                >
                  <span className="pds-extra-attrs__value">{sub.attrValue}</span>
                  {sub.attrPrice !== undefined && sub.attrPrice !== null && sub.attrPrice !== '' ? (
                    <span className="pds-extra-attrs__price">¥ {Number(sub.attrPrice).toFixed(2)}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  ) : null;

  /**
   * B2B 批量采购 Tab（源码 components/product/B2bTab.vue：单品采购 / 批量采购）。
   * 仅 B2B 场景 + 多规格 + bulkPurchase=1 时出现。
   */
  const b2bTab = isB2BMode ? (
    <div className="pds-b2b-tab">
      <button
        type="button"
        className={`pds-b2b-tab__item${b2bTabIndex === 0 ? ' is-active' : ''}`}
        onClick={() => setB2bTabIndex(0)}
      >
        {t('单品采购')}
      </button>
      <button
        type="button"
        className={`pds-b2b-tab__item${b2bTabIndex === 1 ? ' is-active' : ''}`}
        onClick={() => setB2bTabIndex(1)}
      >
        {t('批量采购')}
      </button>
    </div>
  ) : null;

  /**
   * B2B 批量 SKU 列表 + 合计（源码 components/product/B2bSku.vue + ProductAmount.vue）。
   * 每个 SKU 一行：规格名 / 单价 / 库存 / 采购数量。
   */
  const b2bPanel = isB2BMode && b2bTabIndex === 1 ? (
    <div className="pds-b2b">
      <div className="pds-b2b__list">
        {b2bSkuList.map((row, index) => (
          <div className="pds-b2b__row" key={String(row.skuId ?? index)}>
            <div className="pds-b2b__title">{row.title || t('规格')}</div>
            <div className="pds-b2b__meta">
              <span className="pds-b2b__price">¥ {Number(row.price || 0).toFixed(2)}</span>
              <span className="pds-b2b__stock">{t('库存')}：{Number(row.stock || 0)}</span>
            </div>
            <InputNumber
              className="pds-b2b__num"
              min={0}
              max={Number(row.stock || 0)}
              value={Number(row.num || 0)}
              onChange={(value) => changeB2bNum(index, Number(value) || 0)}
            />
          </div>
        ))}
      </div>
      {b2bAmount && Number(b2bAmount.count || 0) > 0 ? (
        <div className="pds-b2b__total">
          <span>{t('合计')}{Number(b2bAmount.count || 0)}{t('件')}</span>
          <span>{t('商品金额')}：¥ {Number(b2bAmount.total || 0).toFixed(2)}</span>
        </div>
      ) : null}
    </div>
  ) : null;

  /**
   * 源码 components/product/ProductSku.vue（老 UI 分支）：`.product-sku-info > .sku-item
   * > .sku-header(.tit + .attrWidth) + .flex.flex-wrap > .sku-tag(.checked/.disabled)`
   */
  const sku = skuGroups.length ? (
    // 源码 components/product/ProductSku.vue 跨境分支：
    // .product-sku-info-overseas > .sku-item.flex.align-start > .tit + .sku-tag.flex-wrap > .tag
    // 注意 .sku-tag 是「容器」，.tag 才是「按钮」；旧实现把两者用反了，
    // 导致 core-pages.scss 的 .sku-tag .tag{border/80px 图} 全部不命中，
    // 带图规格散成「一排图 + 一排字」。
    <div className="mp-product-sku">
      <div className="product-sku-info product-sku-info-overseas">
        {skuGroups.map((group) => (
          <div key={group.name} className="sku-item flex align-start">
            <div className="tit">{group.name}：</div>
            <div className="sku-tag flex-wrap">
              {group.values.map((value) => {
                const active = selected[group.name] === value.value;
                const soldOut = value.stock === 0;
                return (
                  <div
                    key={`${group.name}-${value.value}-${value.attributesId}`}
                    className={`tag${active ? ' checked' : ''}${soldOut ? ' disabled outstock' : ''}`}
                    onClick={() => { if (!soldOut) toggleSpec(group, value); }}
                  >
                    {value.pic ? (
                      <div className="sku-tag__pic">
                        <img src={value.picThumb || value.pic} alt="" />
                        <p className="attrWidth">{value.value}</p>
                      </div>
                    ) : (
                      <div><p>{value.value}</p></div>
                    )}
                    {active ? <i className="iconfont-pc icon-gou" /> : null}
                    {soldOut ? <span className="outstock">{t('缺货')}</span> : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  ) : skuList.length > 1 ? (
    <div className="mp-product-sku">
      <div className="product-sku-info product-sku-info-overseas">
        <div className="sku-item flex align-start">
          <div className="tit">{t('规格')}：</div>
          <div className="sku-tag flex-wrap">
            {skuList.map((skuRow) => {
              const active = Number(skuRow.skuId) === Number(skuId);
              const soldOut = Number(skuRow.skuStock ?? 0) <= 0 || skuRow.isEnabled === 0;
              return (
                <div
                  key={skuRow.skuId}
                  className={`tag${active ? ' checked' : ''}${soldOut ? ' disabled outstock' : ''}`}
                onClick={() => {
                  if (soldOut) return;
                  const nextSkuId = Number(skuRow.skuId);
                  setSkuId(nextSkuId);
                  setQuantity(1);
                  setSkuPic(skuRow.picUrl || skuRow.picThumb || '');
                  if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    url.searchParams.set('skuId', String(nextSkuId));
                    window.history.replaceState({ ...window.history.state }, '', url.href);
                  }
                }}
              >
                {(skuRow.skuData || []).map((entry) => `${entry.name || ''}：${entry.value || ''}`).join(' / ') || t('规格 {id}', { id: skuRow.skuId })}
                {active ? <i className="iconfont-pc icon-gou" /> : null}
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </div>
  ) : null;

  /**
   * 源码 components/product/B2bSku.vue（第 2–23 行，老 UI 分支）：
   * `.b2b-sku > .b2b-sku-content > .sku-item(.title + .price-box(.stock) + .num)`。
   * 逐档价格用旧版 FormatPrice 的产物结构。
   */
  const wholesale = wholesalePriceList.length ? (
    <div className="mp-b2b-sku">
      <div className="b2b-sku">
      <div className="b2b-sku-content">
        {wholesalePriceList.map((tier, index) => {
          const tierNum = pickNumber(tier, ['minNum', 'min_num', 'startNum', 'start_num'], 0);
          const tierPrice = pick(tier, ['price', 'wholesalePrice', 'wholesale_price'], 0);
          return (
            <div className="sku-item" key={index}>
              <div className="title">{tierNum ? `${tierNum}${t('件起')}` : t('批量价')}</div>
              <div className="price-box">
                <div className="price align-bottom">
                  <div className="util">¥</div>
                  <div className="num">{yuan(tierPrice)}</div>
                </div>
                <div className="stock">{stock}{t('件可售')}</div>
              </div>
              <div className="num">
                <InputNumber min={0} max={stock} value={0} disabled />
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  ) : null;

  /** 源码 ProductInfo.vue 284–320 老 UI 分支：`.number-box > .title + .con`（标题带冒号，输入框后跟库存） */
  const qty = (
    <div className="number-box">
      <div className="title">{t('数量')}：</div>
      <div className="con">
        <InputNumber
          min={1}
          max={maxQuantity}
          value={quantity}
          disabled={outOfStock}
          onChange={(value) => changeQuantity(Math.max(1, Math.min(maxQuantity, Number(value) || 1)))}
        />
        <span className="stock-text">
          {t('件')}
          {limit > 0 ? `（${t('限购')} ${limit} ${t('件')}）` : ''}
        </span>
      </div>
    </div>
  );

  /**
   * 数量区：批量采购模式下用批量面板替代单品数量选择器。
   * 旧版 ProductInfo.vue：<template v-if="tabIndex !== 1"> 才渲染 ProductSku 与数量步进器，
   * 批量模式（tabIndex===1）只渲染 ProductB2bSku。
   */
  const qtyBlock = isB2BMode && b2bTabIndex === 1 ? b2bPanel : qty;

  // 旧版 ProductInfo 用 product.productType 判断预约商品（5/6）；新接口字段同名，缺失时按普通商品处理
  const isReservation = Number((item as any).productType) === 5 || Number((item as any).productType) === 6;

  /**
   * 源码 components/product/ProductInfo.vue 350–463：`.add_cart` 内是 ProductBuy（Buy.vue）
   * 包住的旧版按钮 —— `.buy(.disabled) > .buy-btn`（加购）/ `.buy > .buy-btn.buynow`（立即购买）；
   * 售罄且非预约商品时换成 `.buy-btn.buynow` 的「查看其他商品」跳 /search。
   */
  const actions = (
    <div className="add_cart">
      {outOfStock && !isReservation ? (
        <div className="buy">
          <Link href="/search">
            <button type="button" className="buy-btn buynow">{t('查看其他商品')}</button>
          </Link>
        </div>
      ) : (
        <>
          <div
            className={`buy mp-buy${outOfStock || skuDisabled || requireSku ? ' disabled' : ''}`}
            onClick={() => { if (!outOfStock && !skuDisabled && !requireSku) void add(); }}
          >
            <button type="button" className="buy-btn" disabled={outOfStock || skuDisabled || requireSku}>
              {adding ? t('加入中…') : t('加入购物车')}
            </button>
          </div>
          <div
            className={`buy mp-buy${outOfStock || skuDisabled || requireSku ? ' disabled' : ''}`}
            onClick={() => { if (!outOfStock && !skuDisabled && !requireSku) void add('buy'); }}
          >
            <button type="button" className="buy-btn buynow" disabled={outOfStock || skuDisabled || requireSku}>
              {isReservation ? t('立即预约') : t('立即购买')}
            </button>
          </div>
        </>
      )}
      <RawImageDownloadButton productId={productId} shopId={shopId || undefined} />
    </div>
  );

  const tips = (
    <>
      {requireSku ? <p className="pds-tips">{t('请选择完整规格后购买')}</p> : null}
      {outOfStock ? <p className="pds-tips">{t('该商品暂时缺货，敬请期待')}</p> : null}
    </>
  );

  /**
   * 源码 ProductInfo.vue 527 附近的 `.serviceAction`：旧版把服务说明做成售后气泡。
   * ⚠️ 这里的四条文案是占位（新接口里还没有 serviceList 字段），结构用旧版类名，
   * 等接口补 serviceList 后应改成从数据渲染。
   */
  const services = (
    <div className="serviceAction">
      <div className="goods_desc shouhou advisory" id="shouhou">
        {[
          { key: 'ship', title: '售全球', desc: '支持全国及海外配送，具体运费以下单结算为准。' },
          { key: 'fast', title: '24小时发货', desc: '现货商品付款后 24 小时内发出，节假日顺延。' },
          { key: 'refund', title: '7天无理由退换货', desc: '签收后 7 天内，商品不影响二次销售可申请退换。' },
          { key: 'ontime', title: '准时到达', desc: '超时未送达可联系客服协调处理。' },
        ].map((row) => (
          <div className={`item${openService === row.key ? ' is-open' : ''}`} key={row.key}>
            <div className="tit hand-pointer" onClick={() => setOpenService(openService === row.key ? null : row.key)}>
              {row.title}
            </div>
            {openService === row.key ? <div className="desc_text">{row.desc}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );

  // —— 可复用内容：详情描述 / 规格参数 / 评价列表 / 咨询列表 ——
  const descContent = (
    <div className="pds-desc">
      {(detail.descArr || []).map((desc, index) =>
        desc.type === 'pic' || desc.pic ? (
          <img key={index} src={desc.pic} alt="" />
        ) : desc.html ? (
          <div key={index} dangerouslySetInnerHTML={{ __html: desc.html }} />
        ) : null,
      )}
      {!detail.descArr?.length ? <p className="pds-empty">{t('暂无详情')}</p> : null}
    </div>
  );

  const paramsContent = (
    <div className="pds-params">
      <div><span>{t('商品名称')}</span><b>{item.productName}</b></div>
      <div><span>{t('商品编号')}</span><b>{item.productSn || '-'}</b></div>
      <div><span>{t('库存')}</span><b>{stock}</b></div>
      <div><span>{t('上架时间')}</span><b>{formatDateTime(item.addTime) || '-'}</b></div>
      {skuList.length ? <div><span>{t('规格')}</span><b>{skuList.map((row: any) => `${row.name || ''}：${row.value || ''}`).join(' / ')}</b></div> : null}
      {detail.attrList?.normal?.length ? detail.attrList.normal.map((attr: any) => (
        <div key={attr.attrName}><span>{attr.attrName}</span><b>{Array.isArray(attr.attrList) ? attr.attrList.map((v: any) => v.attrValue).filter(Boolean).join(' / ') : '-'}</b></div>
      )) : null}
    </div>
  );

  const commentContent = (
    <div className="pds-comments">
      <div className="pds-comments__stat">
        <div>
          <div className="pds-comments__score">{commentAverage || 0}<span>{t('分')}</span></div>
          <div className="pds-comments__total">共 {commentTotal} 条评价</div>
        </div>
        <div className="pds-comments__bars">
          <div>好评率：{commentGoodPercent}%</div>
          <div>好评 {pickNumber(commentStat, ['goodCount'], 0)} · 中评 {pickNumber(commentStat, ['moderateCount'], 0)} · 差评 {pickNumber(commentStat, ['badCount'], 0)}</div>
        </div>
      </div>
      {comments.length ? (
        <>
          {comments.map((comment, index) => {
            const pics = Array.isArray(comment.pics) ? comment.pics : [];
            return (
              <div className="pds-comment" key={comment.commentId || index}>
                <div className="pds-comment__head">
                  {comment.avatar ? <img src={comment.avatar} alt="" /> : null}
                  <b>{comment.username || comment.nickname || '匿名用户'}</b>
                  <span className="pds-comment__stars">{'★'.repeat(Number(comment.rank || 5))}</span>
                  <span className="pds-comment__time">{formatDateTime(comment.addTime)}</span>
                </div>
                <p className="pds-comment__text">{comment.content || ''}</p>
                {pics.length ? (
                  <div className="pds-comment__pics">
                    {pics.slice(0, 6).map((pic, picIndex) => (
                      <img
                        key={picIndex}
                        src={typeof pic === 'string' ? pic : pickString(pic as Record<string, any>, ['picUrl', 'url', 'pic'])}
                        alt=""
                      />
                    ))}
                  </div>
                ) : null}
                {(comment.replies || []).map((reply, replyIndex) => (
                  <div className="pds-reply" key={replyIndex}>
                    商家回复：{pickString(reply, ['content', 'replyContent', 'reply_content'])}
                  </div>
                ))}
              </div>
            );
          })}
          {comments.length < commentTotal ? (
            <div className="pds-more"><Button loading={commentLoading} onClick={() => void loadMoreComments()}>{t('加载更多评价')}</Button></div>
          ) : null}
        </>
      ) : (
        <p className="pds-empty">{commentLoading ? '评价加载中...' : '暂无评价'}</p>
      )}
    </div>
  );

  const consultContent = (
    <div className="pds-consults">
      <div className="pds-consults__note">共 {consultTotal} 条咨询，咨询内容由商家回复后展示。</div>
      {consults.length ? (
        <>
          {consults.map((consult, index) => (
            <div className="pds-consult" key={consult.id || index}>
              <div className="pds-consult__head">
                <b>{consult.username || '会员'}</b>
                <span>{formatDateTime(consult.addTime || consult.createTime)}</span>
              </div>
              <p className="pds-consult__text">{consult.content || consult.title || ''}</p>
              {consult.replyContent ? <div className="pds-reply">商家回复：{consult.replyContent}</div> : null}
            </div>
          ))}
          {consults.length < consultTotal ? (
            <div className="pds-more"><Button loading={consultLoading} onClick={() => void loadMoreConsults()}>{t('加载更多咨询')}</Button></div>
          ) : null}
        </>
      ) : (
        <p className="pds-empty">{consultLoading ? '咨询加载中...' : '暂无咨询'}</p>
      )}
    </div>
  );

  /**
   * 经典版：源码 pages/item/src/ProductDetailTabs.vue（289 行）的 Tab 区。
   * `.lyecs_main > .goods_tab_wrap.sticky-element > .tabs > ul.flex > li > a.tab_a(.current) > span`
   * 内容区 `.goods_desc(.paidcontent/.shouhou/.goods_ask) > .tab_title > h2 > span.icon`，
   * 产品详情里先 `.goods_description`（付费内容）→ `.shuxin.flex`（属性）→ `.goods_description`（富文本）。
   * 旧版没有单独「规格参数」Tab，属性是 `.shuxin` 放在产品详情里，所以这里也不单列。
   */
  const tabs = (
    // 生成样式为 .mp-product-tabs { .lyecs_main { ... } }，必须父子嵌套（对齐旧版组件根结构）
    <div className="mp-product-tabs">
      <div className="lyecs_main">
      <div className="goods_tab_wrap sticky-element">
        <div className="tabs">
          <ul className="flex">
            <li onClick={() => setTab('detail')}>
              <a href="javascript:;" tab-data="info" className={`tab_a${tab === 'detail' ? ' current' : ''}`}>
                <span>{t('产品详情')}</span>
              </a>
            </li>
            {commentEnabled === 1 ? (
              <li onClick={() => setTab('comment')}>
                <a href="javascript:;" tab-data="com" className={`tab_a${tab === 'comment' ? ' current' : ''}`}>
                  <span>{t('用户评价')}<em>({commentTotal})</em></span>
                </a>
              </li>
            ) : null}
            <li onClick={() => setTab('consult')}>
              <a href="javascript:;" tab-data="ask" className={`tab_a${tab === 'consult' ? ' current' : ''}`}>
                <span>{t('商品咨询')}<em>({consultTotal})</em></span>
              </a>
            </li>
            <li onClick={() => setTab('service')}>
              <a href="javascript:;" tab-data="ser" className={`tab_a${tab === 'service' ? ' current' : ''}`}>
                <span>{t('售后服务')}</span>
              </a>
            </li>
          </ul>
        </div>
      </div>

      {tab === 'detail' ? (
        <div className="goods_desc paidcontent" id="xiangqing">
          {detail.attrList?.normal?.length ? (
            <ul className="shuxin flex">
              {detail.attrList.normal.map((attr: any, index: number) => (
                <li key={index}>
                  {attr.attrName}：{(attr.attrList || []).map((row: any) => row.attrValue).join(' ')}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="goods_description">
            {(detail.descArr || []).map((desc, index) =>
              desc.type === 'pic' || desc.pic ? (
                <img className="el-img" key={index} src={desc.pic} alt={item.productName || ''} />
              ) : desc.html ? (
                <div className="desc-text-item" key={index} dangerouslySetInnerHTML={{ __html: desc.html }} />
              ) : null,
            )}
            {!detail.descArr?.length ? <p className="pds-empty">{t('暂无详情')}</p> : null}
          </div>
        </div>
      ) : null}

      {tab === 'comment' && commentEnabled === 1 ? (
        <div className="goods_desc" id="pingjia">
          <div className="tab_title">
            <h2><span className="icon" />{t('用户评价')}</h2>
          </div>
          {commentContent}
        </div>
      ) : null}

      {tab === 'consult' ? (
        <div className="goods_desc goods_ask" id="zixun">
          <div className="tab_title">
            <h2><span className="icon" />{t('商品咨询')}</h2>
          </div>
          {consultContent}
        </div>
      ) : null}

      {tab === 'service' ? (
        <div className="goods_desc shouhou" id="shouhou">
          <div className="tab_title">
            <h2><span className="icon" />{t('售后服务')}</h2>
          </div>
          {services}
        </div>
      ) : null}
      </div>
    </div>
  );

  /** 跨境版：5 个顺序铺开的锚点区块（源码 goods_desc × 5 + tab-main 吸顶） */
  // 旧版 menuList 联动：评价关闭隐藏「评价」，afterSalesFlag=false 隐藏「售后」（D1146）
  const sections: DetailSection[] = [
    { key: 'detail', label: '商品详情', content: <>{descContent}{paramsContent}</> },
    ...(commentEnabled === 1 ? [{ key: 'comment', label: '用户评价', content: commentContent }] : []),
    { key: 'consult', label: '商品咨询', content: consultContent },
    ...(afterSalesFlag ? [{ key: 'service', label: '售后服务', content: services }] : []),
    { key: 'article', label: '相关文章', content: (
      <div className="pds-articles">
        {relateArticles.length ? relateArticles.map((row, index) => (
          <Link key={pickNumber(row, ['articleId', 'id'], index)} href={`/article/issue/info?articleId=${pickNumber(row, ['articleId', 'id'], 0)}`}>
            {pickString(row, ['title', 'articleTitle'])}
          </Link>
        )) : <p className="pds-empty">{t('暂无相关文章')}</p>}
      </div>
    ) },
  ];

  /** 经典版左侧栏（源码 lyecs_side：ProductCompetitorsList / ProductRelevanceArticle） */
  const sideRail = (
    <div className="pds-rail">
      <div className="pds-rail__card">
        <h3>{t('同店推荐')}</h3>
        {recommend.length ? recommend.slice(0, 5).map((row, index) => (
          <Link className="pds-rail__item" key={index} href={`/product/${pickNumber(row, ['productId', 'product_id'], 0)}`}>
            <img src={pickString(row, ['picThumb', 'pic_thumb', 'picUrl', 'pic_url'])} alt="" />
            <span>{pickString(row, ['productName', 'product_name'])}</span>
            <b>¥ {yuan(pick(row, ['productPrice', 'product_price'], 0))}</b>
          </Link>
        )) : <p className="pds-empty">{t('暂无推荐')}</p>}
      </div>
      <div className="pds-rail__card">
        <h3>{t('服务保障')}</h3>
        <ul>
          <li>{t('正品保障 · 官方渠道')}</li>
          <li>{t('7 天无理由退换')}</li>
          <li>{t('24 小时极速发货')}</li>
          <li>{t('专属客服在线咨询')}</li>
        </ul>
      </div>
    </div>
  );

  /** 源码猜你喜欢 / ProdSwiper「精选好物」—— 商品卡统一走 ProductCard */
  const recommendBlock = recommend.length ? (
    <section className="pds-recommend">
      <h2 className="com-pc-title">{uiStyle === 'overseas' ? '精选好物' : '猜你喜欢'}</h2>
      <div
        className="product-card-grid"
        ref={recommendGridRef}
        style={{ '--you-like-columns': recommendColumns } as React.CSSProperties}
      >
        {recommend.slice(0, 8).map((row, index) => (
          <ProductCard
            key={`${pickNumber(row, ['productId', 'product_id'], 0)}-${index}`}
            product={row as ProductCardItem}
          />
        ))}
      </div>
    </section>
  ) : null;

  /** 国内标准版全局浮动购买栏（源码 FloatBuyBar） */
  const buybar = (
    <div className="pds-buybar">
      <div className="pds-buybar__inner">
        <Button size="large" theme="solid" type="primary" loading={adding} disabled={outOfStock || skuDisabled || requireSku} onClick={() => void add()}>{t('加入购物车')}</Button>
        <Button size="large" theme="light" type="primary" disabled={outOfStock || skuDisabled || requireSku} onClick={() => void add('buy')}>{t('立即购买')}</Button>
        <Button size="large" loading={collecting} onClick={() => void collect()}>
          {collected ? '已收藏' : '收藏'}
        </Button>
      </div>
    </div>
  );

  /** 源码 ShareModal.vue */
  const shareModal = (
    <Modal title={t('分享商品')} visible={shareOpen} onCancel={() => setShareOpen(false)} footer={null} width={420}>
      <div className="pds-share-modal">
        <textarea
          readOnly
          value={`${item.productName || ''}，¥${yuan(price)} ${shareUrl}`}
        />
        <div className="pds-share-modal__row">
          <input readOnly value={shareUrl} />
          <Button theme="solid" type="primary" onClick={() => void copyShare()}>{t('复制链接')}</Button>
        </div>
        {qrData ? <img className="pds-share-modal__qr" src={qrData} alt={t('商品二维码')} /> : null}
        <div className="pds-share-modal__links">
          <a
            href={`https://service.weibo.com/share/share.php?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(`${item.productName || ''} ¥${yuan(price)}`)}`}
            target="_blank"
            rel="noreferrer"
          >{t('分享到微博')}</a>
          <a
            href={`https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(item.productName || '')}`}
            target="_blank"
            rel="noreferrer"
          >{t('分享到 QQ 空间')}</a>
        </div>
      </div>
    </Modal>
  );

  const blocks: ProductBlocks = {
    crumb,
    shareSocial,
    shopCard,
    gallery,
    collectButton,
    galleryMeta,
    heading,
    promos,
    price: priceBlock,
    attrs,
    b2bTab,
    extraAttrBlock,
    sku,
    wholesale,
    qty: qtyBlock,
    actions,
    tips,
    services,
    tabs,
    sections,
    sideRail,
    recommend: recommendBlock,
    buybar,
    shareModal,
  };

  return (
    <ProductLayout
      uiStyle={uiStyle}
      blocks={blocks}
      activeAnchor={activeAnchor}
      onAnchorClick={scrollToAnchor}
    />
  );
}
