'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Button, Card, InputNumber, Modal, Tag, Toast } from '@douyinfe/semi-ui';
import { IconCart, IconCreditCard } from '@douyinfe/semi-icons';
import type { ProductDetailResponse } from '@/lib/api';
import { addToCart } from '@/lib/api';
import { apiGet, apiPost } from '@/lib/client-api';
import RawImageDownloadButton from '@/components/RawImageDownloadButton';
import ProductCard, { type ProductCardItem } from '@/components/product/ProductCard';
import { useProductColumns } from '@/components/product/use-product-columns';
import '@/components/product/product-card.scss';
import { ProductLayout, type ProductBlocks, type DetailSection } from '@/components/product/ProductLayouts';

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
  pic?: string;
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
          pic: value?.attrPicThumb || value?.attrPic,
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

  // —— 评价 / 咨询 ——
  const [tab, setTab] = useState<'detail' | 'params' | 'comment' | 'consult'>('detail');
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

  const stock = Number(selectedSku?.skuStock ?? item.productStock ?? 0);
  const limit = Number(selectedSku?.limitNumber ?? item.limitNumber ?? 0);
  const maxQuantity = limit > 0 ? limit : stock > 0 ? stock : 1;
  const outOfStock = stock <= 0;
  const skuDisabled = selectedSku?.isEnabled === 0;
  const price = selectedSku?.skuPrice ?? selectedSku?.price ?? item.productPrice;
  const requireSku = skuGroups.length > 0 && !selectedSku;
  const mainImage = skuPic || selectedSku?.picThumb || selectedSku?.picUrl || pictures[activeImage]?.picUrl || pictures[activeImage]?.picThumb || '';

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

  // —— 首屏并行加载：优惠券 / 拼团 / 店铺 / 推荐 / 评价统计 / 评价首屏 / 咨询首屏 ——
  useEffect(() => {
    if (!productId) return;
    let alive = true;
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
      Toast.error({ content: limit > 0 && maxQuantity === limit ? `限购${limit}件` : '库存不足' });
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
      const result = await addToCart({
        id: Number(item.productId),
        number: quantity,
        skuId: selectedSku?.skuId ? Number(selectedSku.skuId) : skuId,
        isQuick: next === 'buy' ? 1 : 0,
      });
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
  const commentGoodPercent = pickString(commentStat, ['goodPercent'], '0.00');
  const commentAverage = pickNumber(commentStat, ['averageRank'], 0);

  // —— 跨境版锚点长滚动：点击定位 + 滚动高亮（源码 changeType / sectionRefs / tab-main）——
  const [activeAnchor, setActiveAnchor] = useState('detail');
  const anchorKeys = ['detail', 'comment', 'consult', 'service', 'article'];
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
      <Link href="/">首页</Link>
      <span>/</span>
      <Link href="/search">全部商品</Link>
      <span>/</span>
      <span className="pds-crumb__current" title={item.productName || ''}>{item.productName}</span>
    </nav>
  );

  /** 跨境版顶部 flex_csb 右侧：分享至 + 社交渠道（源码 shareWidth） */
  const shareSocial = (
    <div className="pds-share-social">
      <span className="pds-share-social__title">分享至</span>
      <button type="button" onClick={() => void openShare()}>复制链接</button>
      <a
        href={`https://service.weibo.com/share/share.php?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(item.productName || '')}`}
        target="_blank"
        rel="noreferrer"
      >
        微博
      </a>
      <a
        href={`https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(item.productName || '')}`}
        target="_blank"
        rel="noreferrer"
      >
        QQ 空间
      </a>
      <button type="button" onClick={() => void openShare()}>二维码</button>
    </div>
  );

  /** 源码 ProductShopInfo / OverseasShopInfo */
  const shopCard = shopInfo ? (
    <div className="pds-shop">
      <div className="pds-shop__logo">
        {pickString(shopInfo, ['shopLogo']) ? <img src={pickString(shopInfo, ['shopLogo'])} alt="" /> : null}
      </div>
      <div className="pds-shop__info">
        <div className="pds-shop__name">
          <b>{pickString(shopInfo, ['shopTitle'], '店铺')}</b>
          {pickString(shopInfo, ['shopBadge']) ? <Tag color="orange">{pickString(shopInfo, ['shopBadge'])}</Tag> : null}
        </div>
        <div className="pds-shop__meta">
          {pickString(shopInfo, ['shopDetailedAddress'], '')}
          {pickString(shopInfo, ['kefuPhone'], '') ? ` · 客服 ${pickString(shopInfo, ['kefuPhone'])}` : ''}
        </div>
      </div>
      <div className="pds-shop__actions">
        {shopId > 0 ? <Link href={`/shop/${shopId}`}><Button size="small">进入店铺</Button></Link> : null}
      </div>
    </div>
  ) : null;

  /** 源码 ProductThumb / ProductThumbNew / OverseasThumb */
  const gallery = (
    <div className="pds-gallery">
      <div className="pds-gallery__main">
        <img src={mainImage} alt={item.productName} />
      </div>
      <div className="pds-gallery__thumbs">
        {pictures.map((pic: any, index: number) => (
          <button
            key={pic.picId || index}
            type="button"
            className={index === activeImage && !skuPic ? 'is-active' : ''}
            onClick={() => {
              setSkuPic('');
              setActiveImage(index);
            }}
          >
            <img src={pic.picThumb || pic.picUrl} alt="" />
          </button>
        ))}
      </div>
    </div>
  );

  /** 经典版画廊下方 share_wish：商品编号 / 收藏 / 分享 */
  const galleryMeta = (
    <div className="pds-gallery-meta">
      <span className="pds-gallery-meta__sn" title={item.productSn || ''}>商品编号：{item.productSn || '-'}</span>
      <div className="pds-gallery-meta__tools">
        <button type="button" onClick={() => void collect()} disabled={collecting}>
          {collected ? '已收藏' : '收藏'}
        </button>
        <button type="button" onClick={() => void openShare()}>分享</button>
      </div>
    </div>
  );

  /** 源码 product_name：标签 + 名称 + 卖点 */
  const heading = (
    <div className="pds-heading">
      <div className="pds-tags">
        {item.isNew ? <Tag color="blue">新品</Tag> : null}
        {item.isHot ? <Tag color="orange">热销</Tag> : null}
        {detail.deliveryModeText ? <Tag color="green">{detail.deliveryModeText}</Tag> : null}
        {outOfStock ? <Tag color="red">已售罄</Tag> : null}
      </div>
      <h1>{item.productName}</h1>
      {item.productBrief ? <p className="pds-brief">{item.productBrief}</p> : null}
    </div>
  );

  /** 营销面板：秒杀 / 拼团 / 预售 / 优惠券 */
  const promos = (
    <>
      {seckillPrice !== null ? (
        <div className="pds-panel pds-panel--seckill">
          <div className="pds-panel__row">
            <Tag color="red">限时秒杀</Tag>
            <b className="pds-panel__price">¥ {yuan(seckillPrice)}</b>
            {Number(price) > seckillPrice ? <del>¥ {yuan(price)}</del> : null}
          </div>
          <p className="pds-panel__note">秒杀价随规格变化，实际以下单结算为准</p>
        </div>
      ) : null}

      {grouponInfo && grouponPrice ? (
        <div className="pds-panel pds-panel--groupon">
          <div className="pds-panel__row">
            <Tag color="orange">拼团</Tag>
            <b className="pds-panel__price">¥ {yuan(grouponPrice)}</b>
            {grouponNum > 0 ? <span className="pds-panel__note">{grouponNum} 人成团</span> : null}
            {grouponNum > 0 ? <span className="pds-panel__note">已拼 {grouponJoined} 件</span> : null}
          </div>
          {grouponInfo?.grouponPromotionId || grouponInfo?.grouponId ? (
            <Link className="pds-panel__link" href={`/seckill?grouponPromotionId=${grouponInfo.grouponPromotionId || grouponInfo.grouponId}`}>
              去拼团 &gt;
            </Link>
          ) : null}
        </div>
      ) : null}

      {presaleInfo || Number((item as any).prepayPrice) > 0 ? (
        <div className="pds-panel pds-panel--presale">
          <div className="pds-panel__row">
            <Tag color="blue">预售</Tag>
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
            <span>优惠券</span>
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
                  <div className="pds-coupon__desc">满{Number(coupon.minOrderAmount || 0).toFixed(0)}可用</div>
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

  const priceBlock = (
    <>
      <div className="pds-price">
        <span className="pds-price__label">本站价：</span>
        <b className="pds-price__value">¥{yuan(price)}</b>
        {Number(item.marketPrice) > 0 ? <del className="pds-price__origin">¥{yuan(item.marketPrice)}</del> : null}
      </div>
      <div className="pds-pills">
        {coupons.length ? <span className="pds-pill">满折</span> : null}
        {seckillPrice !== null ? <span className="pds-pill">限时秒杀</span> : null}
        {grouponInfo ? <span className="pds-pill">满赠</span> : null}
        <a className="pds-pill__more" href="#pds-sec-detail">更多优惠 &gt;</a>
      </div>
      <div className="pds-sales">销量：<b>{item.virtualSales ?? item.sales ?? 0}</b> 件</div>
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

  /** 源码 ProductSku / OverseasProductInfo 规格区 */
  const sku = skuGroups.length ? (
    <div className="pds-sku">
      {skuGroups.map((group) => (
        <div key={group.name} className="pds-sku__group">
          <span className="pds-sku__label">{group.name}</span>
          <div className="pds-sku__list">
            {group.values.map((value) => {
              const active = selected[group.name] === value.value;
              const soldOut = value.stock === 0;
              return (
                <Button
                  key={`${group.name}-${value.value}-${value.attributesId}`}
                  theme={active ? 'solid' : 'light'}
                  type={active ? 'primary' : 'tertiary'}
                  disabled={soldOut}
                  onClick={() => toggleSpec(group, value)}
                >
                  {value.pic ? <img src={value.pic} alt="" className="pds-sku__pic" /> : null}
                  {value.value}
                  {soldOut ? '（缺货）' : ''}
                </Button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  ) : skuList.length > 1 ? (
    <div className="pds-sku">
      <div className="pds-sku__group">
        <span className="pds-sku__label">规格</span>
        <div className="pds-sku__list">
          {skuList.map((skuRow) => (
            <Button
              key={skuRow.skuId}
              theme={Number(skuRow.skuId) === Number(skuId) ? 'solid' : 'light'}
              type={Number(skuRow.skuId) === Number(skuId) ? 'primary' : 'tertiary'}
              disabled={Number(skuRow.skuStock ?? 0) <= 0 || skuRow.isEnabled === 0}
              onClick={() => {
                const nextSkuId = Number(skuRow.skuId);
                setSkuId(nextSkuId);
                setQuantity(1);
                setSkuPic(skuRow.picThumb || skuRow.picUrl || '');
                if (typeof window !== 'undefined') {
                  const url = new URL(window.location.href);
                  url.searchParams.set('skuId', String(nextSkuId));
                  window.history.replaceState({ ...window.history.state }, '', url.href);
                }
              }}
            >
              {(skuRow.skuData || []).map((entry) => `${entry.name || ''}：${entry.value || ''}`).join(' / ') || `规格 ${skuRow.skuId}`}
            </Button>
          ))}
        </div>
      </div>
    </div>
  ) : null;

  const wholesale = wholesalePriceList.length ? (
    <div className="pds-sku pds-wholesale">
      <span className="pds-sku__label">批量采购</span>
      <table className="account-table">
        <thead><tr><th>起订数量</th><th>批发价</th></tr></thead>
        <tbody>
          {wholesalePriceList.map((tier, index) => (
            <tr key={index}>
              <td>{pickNumber(tier, ['minNum', 'min_num', 'startNum', 'start_num'], 0)}+</td>
              <td className="is-income">¥ {yuan(pick(tier, ['price', 'wholesalePrice', 'wholesale_price'], 0))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : null;

  const qty = (
    <div className="pds-qty">
      <span className="pds-qty__label">数量</span>
      <div className="pds-stepper">
        <button type="button" disabled={outOfStock || quantity <= 1} onClick={() => changeQuantity(Math.max(1, quantity - 1))}>−</button>
        <input
          value={quantity}
          inputMode="numeric"
          onChange={(event) => changeQuantity(Math.max(1, Math.min(maxQuantity, Number(event.target.value.replace(/\D/g, '')) || 1)))}
        />
        <button type="button" disabled={outOfStock || quantity >= maxQuantity} onClick={() => changeQuantity(Math.min(maxQuantity, quantity + 1))}>＋</button>
      </div>
      <span className="pds-qty__stock">件（库存：{stock > 0 ? '充足' : '不足'}）</span>
      {limit > 0 ? <span className="pds-limit">限购 {limit} 件</span> : null}
    </div>
  );

  /** 源码 Buy / FloatBuyBar / #overseas-product-buy-actions */
  const actions = (
    <div className="pds-actions">
      <Button
        size="large"
        theme="solid"
        type="primary"
        icon={<IconCart />}
        loading={adding}
        disabled={outOfStock || skuDisabled || requireSku}
        onClick={() => void add()}
      >
        加入购物车
      </Button>
      <Button
        size="large"
        theme="light"
        type="primary"
        icon={<IconCreditCard />}
        disabled={outOfStock || skuDisabled || requireSku}
        onClick={() => void add('buy')}
      >
        立即购买
      </Button>
      <Button size="large" loading={collecting} onClick={() => void collect()}>
        {collected ? '已收藏' : '收藏'}
      </Button>
      <Button size="large" onClick={() => void openShare()}>分享</Button>
      <RawImageDownloadButton productId={productId} shopId={shopId || undefined} />
    </div>
  );

  const tips = (
    <>
      {requireSku ? <p className="pds-tips">请选择完整规格后购买</p> : null}
      {outOfStock ? <p className="pds-tips">该商品暂时缺货，敬请期待</p> : null}
    </>
  );

  /** 源码服务说明（新版分段卡片 / 跨境 accordion） */
  const services = (
    <div className="pds-accordion">
      {[
        { key: 'ship', title: '售全球', desc: '支持全国及海外配送，具体运费以下单结算为准。' },
        { key: 'fast', title: '24小时发货', desc: '现货商品付款后 24 小时内发出，节假日顺延。' },
        { key: 'refund', title: '7天无理由退换货', desc: '签收后 7 天内，商品不影响二次销售可申请退换。' },
        { key: 'ontime', title: '准时到达', desc: '超时未送达可联系客服协调处理。' },
      ].map((row) => (
        <div className={`pds-accordion__row${openService === row.key ? ' is-open' : ''}`} key={row.key}>
          <button type="button" onClick={() => setOpenService(openService === row.key ? null : row.key)}>
            <span>{row.title}</span>
            <i>{openService === row.key ? '⌃' : '⌄'}</i>
          </button>
          {openService === row.key ? <p>{row.desc}</p> : null}
        </div>
      ))}
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
      {!detail.descArr?.length ? <p className="pds-empty">暂无详情</p> : null}
    </div>
  );

  const paramsContent = (
    <div className="pds-params">
      <div><span>商品名称</span><b>{item.productName}</b></div>
      <div><span>商品编号</span><b>{item.productSn || '-'}</b></div>
      <div><span>库存</span><b>{stock}</b></div>
      <div><span>上架时间</span><b>{formatDateTime(item.addTime) || '-'}</b></div>
      {skuList.length ? <div><span>规格</span><b>{skuList.map((row: any) => `${row.name || ''}：${row.value || ''}`).join(' / ')}</b></div> : null}
      {detail.attrList?.normal?.length ? detail.attrList.normal.map((attr: any) => (
        <div key={attr.attrName}><span>{attr.attrName}</span><b>{Array.isArray(attr.attrList) ? attr.attrList.map((v: any) => v.attrValue).filter(Boolean).join(' / ') : '-'}</b></div>
      )) : null}
    </div>
  );

  const commentContent = (
    <div className="pds-comments">
      <div className="pds-comments__stat">
        <div>
          <div className="pds-comments__score">{commentAverage || 0}<span>分</span></div>
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
            <div className="pds-more"><Button loading={commentLoading} onClick={() => void loadMoreComments()}>加载更多评价</Button></div>
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
            <div className="pds-more"><Button loading={consultLoading} onClick={() => void loadMoreConsults()}>加载更多咨询</Button></div>
          ) : null}
        </>
      ) : (
        <p className="pds-empty">{consultLoading ? '咨询加载中...' : '暂无咨询'}</p>
      )}
    </div>
  );

  /** 经典版 / 国内标准版：Tab 切换式详情（源码 ProductDetailTabs / ProductDetailNew） */
  const tabs = (
    <div className="pds-tabs">
      <div className="pds-tabs__nav">
        {([
          { key: 'detail', label: '商品详情' },
          { key: 'params', label: '规格参数' },
          { key: 'comment', label: `商品评价(${commentTotal})` },
          { key: 'consult', label: `商品咨询(${consultTotal})` },
        ] as const).map((entry) => (
          <button
            key={entry.key}
            type="button"
            className={tab === entry.key ? 'is-active' : ''}
            onClick={() => setTab(entry.key)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div className="pds-tabs__body">
        {tab === 'detail' ? (
          <Card className="pds-card" title="商品详情">
            {descContent}
            <div className="pds-back"><Link href="/">返回首页</Link></div>
          </Card>
        ) : tab === 'params' ? (
          <Card className="pds-card" title="规格参数">{paramsContent}</Card>
        ) : tab === 'comment' ? (
          <Card className="pds-card" title="商品评价">{commentContent}</Card>
        ) : (
          <Card className="pds-card" title="商品咨询">{consultContent}</Card>
        )}
      </div>
    </div>
  );

  /** 跨境版：5 个顺序铺开的锚点区块（源码 goods_desc × 5 + tab-main 吸顶） */
  const sections: DetailSection[] = [
    { key: 'detail', label: '商品详情', content: <>{descContent}{paramsContent}</> },
    { key: 'comment', label: '用户评价', content: commentContent },
    { key: 'consult', label: '商品咨询', content: consultContent },
    { key: 'service', label: '售后服务', content: services },
    { key: 'article', label: '相关文章', content: (
      <div className="pds-articles">
        {recommend.length ? recommend.slice(0, 4).map((row, index) => (
          <Link key={index} href={`/product/${pickNumber(row, ['productId', 'product_id'], 0)}`}>
            {pickString(row, ['productName', 'product_name'])}
          </Link>
        )) : <p className="pds-empty">暂无相关文章</p>}
      </div>
    ) },
  ];

  /** 经典版左侧栏（源码 lyecs_side：ProductCompetitorsList / ProductRelevanceArticle） */
  const sideRail = (
    <div className="pds-rail">
      <div className="pds-rail__card">
        <h3>同店推荐</h3>
        {recommend.length ? recommend.slice(0, 5).map((row, index) => (
          <Link className="pds-rail__item" key={index} href={`/product/${pickNumber(row, ['productId', 'product_id'], 0)}`}>
            <img src={pickString(row, ['picThumb', 'pic_thumb', 'picUrl', 'pic_url'])} alt="" />
            <span>{pickString(row, ['productName', 'product_name'])}</span>
            <b>¥ {yuan(pick(row, ['productPrice', 'product_price'], 0))}</b>
          </Link>
        )) : <p className="pds-empty">暂无推荐</p>}
      </div>
      <div className="pds-rail__card">
        <h3>服务保障</h3>
        <ul>
          <li>正品保障 · 官方渠道</li>
          <li>7 天无理由退换</li>
          <li>24 小时极速发货</li>
          <li>专属客服在线咨询</li>
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
        <Button size="large" theme="solid" type="primary" loading={adding} disabled={outOfStock || skuDisabled || requireSku} onClick={() => void add()}>
          加入购物车
        </Button>
        <Button size="large" theme="light" type="primary" disabled={outOfStock || skuDisabled || requireSku} onClick={() => void add('buy')}>
          立即购买
        </Button>
        <Button size="large" loading={collecting} onClick={() => void collect()}>
          {collected ? '已收藏' : '收藏'}
        </Button>
      </div>
    </div>
  );

  /** 源码 ShareModal.vue */
  const shareModal = (
    <Modal title="分享商品" visible={shareOpen} onCancel={() => setShareOpen(false)} footer={null} width={420}>
      <div className="pds-share-modal">
        <textarea
          readOnly
          value={`${item.productName || ''}，¥${yuan(price)} ${shareUrl}`}
        />
        <div className="pds-share-modal__row">
          <input readOnly value={shareUrl} />
          <Button theme="solid" type="primary" onClick={() => void copyShare()}>复制链接</Button>
        </div>
        {qrData ? <img className="pds-share-modal__qr" src={qrData} alt="商品二维码" /> : null}
        <div className="pds-share-modal__links">
          <a
            href={`https://service.weibo.com/share/share.php?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(`${item.productName || ''} ¥${yuan(price)}`)}`}
            target="_blank"
            rel="noreferrer"
          >
            分享到微博
          </a>
          <a
            href={`https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(item.productName || '')}`}
            target="_blank"
            rel="noreferrer"
          >
            分享到 QQ 空间
          </a>
        </div>
      </div>
    </Modal>
  );

  const blocks: ProductBlocks = {
    crumb,
    shareSocial,
    shopCard,
    gallery,
    galleryMeta,
    heading,
    promos,
    price: priceBlock,
    attrs,
    sku,
    wholesale,
    qty,
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
