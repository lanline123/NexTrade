'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Card, InputNumber, Modal, Tag, Toast } from '@douyinfe/semi-ui';
import { IconCart, IconCreditCard } from '@douyinfe/semi-icons';
import type { ProductDetailResponse } from '@/lib/api';
import { addToCart } from '@/lib/api';
import { apiGet, apiPost } from '@/lib/client-api';

/**
 * 商品详情（源码对照 java-b2b2c-overseas-v5.8.61/view/pc/pages/item/src/Product.vue
 * + components/product/{ProductSku,ProductInfo,PicShow,Buy,Comment,Consultation,
 * CouponList,ShopInfo,ShareModal}.vue）
 *
 * 本轮补齐（task-107）：
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

export default function ProductDetailClient({ detail }: { detail: ProductDetailResponse }) {
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
  const [tab, setTab] = useState<'detail' | 'comment' | 'consult'>('detail');
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

  // —— 收藏 / 分享 ——
  const [collected, setCollected] = useState(false);
  const [collecting, setCollecting] = useState(false);
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

  const mainContent = (
    <>
      <div className="pc-product-detail">
        <div className="pc-product-detail__gallery">
          <div className="pc-product-detail__main-image">
            <img src={mainImage} alt={item.productName} />
          </div>
          <div className="pc-product-detail__thumbs">
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

        <div className="pc-product-detail__info">
          <div className="pc-product-detail__tags">
            {item.isNew ? <Tag color="blue">新品</Tag> : null}
            {item.isHot ? <Tag color="orange">热销</Tag> : null}
            {detail.deliveryModeText ? <Tag color="green">{detail.deliveryModeText}</Tag> : null}
            {outOfStock ? <Tag color="red">已售罄</Tag> : null}
          </div>
          <h1>{item.productName}</h1>
          {item.productBrief ? <p className="pc-product-detail__brief">{item.productBrief}</p> : null}

          {/* 秒杀价面板 */}
          {seckillPrice !== null ? (
            <div className="pc-product-detail__panel" style={{ border: '1px solid #ffe0e3', background: '#fff5f6', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <Tag color="red">限时秒杀</Tag>
                <b style={{ color: '#e1251b', fontSize: 22 }}>¥ {yuan(seckillPrice)}</b>
                {Number(price) > seckillPrice ? <del style={{ color: '#98a2b3' }}>¥ {yuan(price)}</del> : null}
              </div>
              <p style={{ margin: '6px 0 0', color: '#8c8c8c', fontSize: 12 }}>秒杀价随规格变化，实际以下单结算为准</p>
            </div>
          ) : null}

          {/* 拼团面板 */}
          {grouponInfo && grouponPrice ? (
            <div className="pc-product-detail__panel" style={{ border: '1px solid #ffe7d1', background: '#fff9f2', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <Tag color="orange">拼团</Tag>
                <b style={{ color: '#e1251b', fontSize: 22 }}>¥ {yuan(grouponPrice)}</b>
                {grouponNum > 0 ? <span style={{ color: '#8c8c8c', fontSize: 12 }}>{grouponNum} 人成团</span> : null}
                {grouponNum > 0 ? (
                  <span style={{ color: '#8c8c8c', fontSize: 12 }}>已拼 {grouponJoined} 件</span>
                ) : null}
              </div>
              {grouponInfo?.grouponPromotionId || grouponInfo?.grouponId ? (
                <Link
                  href={`/seckill?grouponPromotionId=${grouponInfo.grouponPromotionId || grouponInfo.grouponId}`}
                  style={{ display: 'inline-block', marginTop: 6, color: '#e1251b', fontSize: 13 }}
                >
                  去拼团 &gt;
                </Link>
              ) : null}
            </div>
          ) : null}

          {/* 预售面板 */}
          {presaleInfo || Number((item as any).prepayPrice) > 0 ? (
            <div className="pc-product-detail__panel" style={{ border: '1px solid #e6f0ff', background: '#f6f9ff', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Tag color="blue">预售</Tag>
                {presaleDeposit > 0 ? <b style={{ color: '#155bd4' }}>定金 ¥ {yuan(presaleDeposit)}</b> : null}
                {Number((item as any).prepayPrice) > 0 ? (
                  <span style={{ color: '#667085', fontSize: 13 }}>预售价 ¥ {yuan((item as any).prepayPrice)}</span>
                ) : null}
              </div>
              {presaleInfo && typeof presaleInfo === 'object' ? (
                <p style={{ margin: '6px 0 0', color: '#8c8c8c', fontSize: 12 }}>
                  {pickString(presaleInfo, ['presaleStartTime', 'startTime', 'preSaleStartTime'], '')}
                  {pickString(presaleInfo, ['presaleEndTime', 'endTime', 'preSaleEndTime'], '') ? ' 至 ' : ''}
                  {pickString(presaleInfo, ['presaleEndTime', 'endTime', 'preSaleEndTime'], '')}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* 优惠券面板 */}
          {coupons.length ? (
            <div className="pc-product-detail__panel" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ color: '#344054', fontWeight: 600, fontSize: 14 }}>优惠券</span>
                <Link href="/coupon/list" style={{ color: '#e1251b', fontSize: 12 }}>领券中心 &gt;</Link>
              </div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {coupons.slice(0, 6).map((coupon) => {
                  const received = Number(coupon.isReceive) === 1;
                  return (
                    <div
                      key={coupon.couponId}
                      style={{ flex: '0 0 auto', minWidth: 150, border: '1px solid #ffe0e3', borderRadius: 8, padding: '8px 10px', background: received ? '#f7f8fa' : '#fff5f6' }}
                    >
                      <div style={{ color: '#e1251b', fontWeight: 700 }}>
                        {Number(coupon.couponType) === 2 ? `${Number(coupon.couponDiscount || 0)}折` : `¥${Number(coupon.couponMoney || 0).toFixed(0)}`}
                      </div>
                      <div style={{ fontSize: 12, color: '#667085', margin: '2px 0 6px' }}>
                        满{Number(coupon.minOrderAmount || 0).toFixed(0)}可用
                      </div>
                      <Button size="small" theme={received ? 'borderless' : 'solid'} type="primary" disabled={received} onClick={() => void claimCoupon(coupon)}>
                        {received ? '已领取' : '领取'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="pc-product-detail__price-box">
            <span className="pc-product-detail__price-label">价格</span>
            <b className="pc-product-detail__price">¥ {yuan(price)}</b>
            {Number(item.marketPrice) > 0 ? <del>¥ {yuan(item.marketPrice)}</del> : null}
          </div>

          <div className="pc-product-detail__meta">
            <span>商品编号：{item.productSn || '-'}</span>
            <span>库存：{stock}</span>
            <span>销量：{item.virtualSales ?? item.sales ?? 0}</span>
            {limit > 0 ? <span>限购：{limit} 件</span> : null}
          </div>

          {detail.attrList?.normal?.length ? (
            <div className="pc-product-detail__attrs">
              {detail.attrList.normal.map((attr: any) => (
                <div key={attr.attrName}>
                  <span>{attr.attrName}</span>
                  <b>{Array.isArray(attr.attrList) ? attr.attrList.map((v: any) => v.attrValue).filter(Boolean).join(' / ') : attr.attrList || '-'}</b>
                </div>
              ))}
            </div>
          ) : null}

          {skuGroups.length ? (
            <div className="pc-product-detail__sku">
              {skuGroups.map((group) => (
                <div key={group.name} className="pc-product-detail__sku-group">
                  <span>{group.name}</span>
                  <div className="pc-product-detail__sku-list">
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
                          {value.pic ? <img src={value.pic} alt="" className="pc-product-detail__sku-pic" /> : null}
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
            <div className="pc-product-detail__sku">
              <span>规格</span>
              <div className="pc-product-detail__sku-list">
                {skuList.map((sku) => (
                  <Button
                    key={sku.skuId}
                    theme={Number(sku.skuId) === Number(skuId) ? 'solid' : 'light'}
                    type={Number(sku.skuId) === Number(skuId) ? 'primary' : 'tertiary'}
                    disabled={Number(sku.skuStock ?? 0) <= 0 || sku.isEnabled === 0}
                    onClick={() => {
                      const nextSkuId = Number(sku.skuId);
                      setSkuId(nextSkuId);
                      setQuantity(1);
                      setSkuPic(sku.picThumb || sku.picUrl || '');
                      if (typeof window !== 'undefined') {
                        const url = new URL(window.location.href);
                        url.searchParams.set('skuId', String(nextSkuId));
                        window.history.replaceState({ ...window.history.state }, '', url.href);
                      }
                    }}
                  >
                    {(sku.skuData || []).map((entry) => `${entry.name || ''}：${entry.value || ''}`).join(' / ') || `规格 ${sku.skuId}`}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {/* B2B 批量采购：批发阶梯价（详情 wholesalePriceList 存在时） */}
          {wholesalePriceList.length ? (
            <div className="pc-product-detail__sku" style={{ marginTop: 12 }}>
              <span>批量采购</span>
              <table className="account-table" style={{ marginTop: 6 }}>
                <thead>
                  <tr><th>起订数量</th><th>批发价</th></tr>
                </thead>
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
          ) : null}

          <div className="pc-product-detail__quantity">
            <span>数量</span>
            <InputNumber
              min={1}
              max={maxQuantity}
              value={quantity}
              disabled={outOfStock}
              onChange={(value) => changeQuantity(Number(value) || 1)}
            />
            {limit > 0 ? <span className="pc-product-detail__limit">限购 {limit} 件</span> : null}
          </div>

          <div className="pc-product-detail__actions">
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
          </div>
          {requireSku ? <p className="pc-product-detail__tips">请选择完整规格后购买</p> : null}
          {outOfStock ? <p className="pc-product-detail__tips">该商品暂时缺货，敬请期待</p> : null}

          <div className="pc-product-detail__services">
            <span>支持配送</span>
            <span>正品保障</span>
            <span>售后无忧</span>
          </div>

          {/* 店铺信息 */}
          {shopInfo ? (
            <div className="pc-product-detail__panel" style={{ marginTop: 16, border: '1px solid #f2f4f7', borderRadius: 12, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', background: '#f7f8fa', flex: '0 0 auto' }}>
                  {pickString(shopInfo, ['shopLogo']) ? (
                    <img src={pickString(shopInfo, ['shopLogo'])} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : null}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <b style={{ color: '#344054' }}>{pickString(shopInfo, ['shopTitle'], '店铺')}</b>
                    {pickString(shopInfo, ['shopBadge']) ? <Tag color="orange">{pickString(shopInfo, ['shopBadge'])}</Tag> : null}
                  </div>
                  <div style={{ color: '#98a2b3', fontSize: 12, marginTop: 4 }}>
                    {pickString(shopInfo, ['shopDetailedAddress'], '')}
                    {pickString(shopInfo, ['kefuPhone'], '') ? ` · 客服 ${pickString(shopInfo, ['kefuPhone'])}` : ''}
                  </div>
                </div>
                {shopId > 0 ? (
                  <Link href={`/shop/${shopId}`}>
                    <Button size="small">进入店铺</Button>
                  </Link>
                ) : null}
              </div>
            </div>
          ) : shopId > 0 ? (
            <div className="pc-product-detail__panel" style={{ marginTop: 16 }}>
              <Link href={`/shop/${shopId}`} style={{ color: '#155bd4', fontSize: 13 }}>进入店铺 &gt;</Link>
            </div>
          ) : null}
        </div>
      </div>

      {/* 商品详情 / 商品评价 / 商品咨询 Tabs */}
      <div className="pc-product-detail__tabs" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid #f2f4f7', marginBottom: 16 }}>
          {([
            { key: 'detail', label: '商品详情' },
            { key: 'comment', label: `商品评价(${commentTotal})` },
            { key: 'consult', label: `商品咨询(${consultTotal})` },
          ] as const).map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setTab(entry.key)}
              style={{
                padding: '10px 2px',
                border: 'none',
                borderBottom: tab === entry.key ? '2px solid #e1251b' : '2px solid transparent',
                background: 'transparent',
                color: tab === entry.key ? '#e1251b' : '#344054',
                fontWeight: tab === entry.key ? 600 : 400,
                fontSize: 15,
                cursor: 'pointer',
              }}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {tab === 'detail' ? (
          <div className="pc-product-detail__content">
            <Card className="pc-product-detail__card" title="商品详情">
              <div className="pc-product-detail__desc">
                {(detail.descArr || []).map((desc, index) =>
                  desc.type === 'pic' || desc.pic ? (
                    <img key={index} src={desc.pic} alt="" />
                  ) : desc.html ? (
                    <div key={index} dangerouslySetInnerHTML={{ __html: desc.html }} />
                  ) : null,
                )}
                {!detail.descArr?.length ? <p className="pc-product-detail__empty">暂无详情</p> : null}
              </div>
            </Card>

            <Card className="pc-product-detail__card" title="商品参数">
              <div className="pc-product-detail__params">
                <div><span>商品名称</span><b>{item.productName}</b></div>
                <div><span>商品编号</span><b>{item.productSn || '-'}</b></div>
                <div><span>库存</span><b>{stock}</b></div>
                <div><span>上架时间</span><b>{formatDateTime(item.addTime) || '-'}</b></div>
              </div>
            </Card>

            <div className="pc-product-detail__back">
              <Link href="/">返回首页</Link>
            </div>
          </div>
        ) : tab === 'comment' ? (
          <Card className="pc-product-detail__card" title="商品评价">
            <div style={{ display: 'flex', gap: 24, alignItems: 'center', padding: '8px 0 16px', borderBottom: '1px solid #f2f4f7' }}>
              <div>
                <div style={{ color: '#e1251b', fontSize: 32, fontWeight: 700 }}>{commentAverage || 0}<span style={{ fontSize: 14, color: '#98a2b3' }}>分</span></div>
                <div style={{ color: '#98a2b3', fontSize: 12 }}>共 {commentTotal} 条评价</div>
              </div>
              <div style={{ flex: 1, color: '#667085', fontSize: 13, lineHeight: 1.9 }}>
                <div>好评率：{commentGoodPercent}%</div>
                <div>
                  好评 {pickNumber(commentStat, ['goodCount'], 0)} · 中评 {pickNumber(commentStat, ['moderateCount'], 0)} · 差评 {pickNumber(commentStat, ['badCount'], 0)}
                </div>
              </div>
            </div>
            {comments.length ? (
              <div>
                {comments.map((comment, index) => {
                  const pics = Array.isArray(comment.pics) ? comment.pics : [];
                  return (
                    <div key={comment.commentId || index} style={{ padding: '14px 0', borderBottom: '1px solid #f7f8fa' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {comment.avatar ? <img src={comment.avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} /> : null}
                        <b style={{ color: '#344054', fontSize: 13 }}>{comment.username || comment.nickname || '匿名用户'}</b>
                        <span style={{ color: '#f5a623', fontSize: 12 }}>{'★'.repeat(Number(comment.rank || 5))}</span>
                        <span style={{ color: '#98a2b3', fontSize: 12 }}>{formatDateTime(comment.addTime)}</span>
                      </div>
                      <p style={{ margin: '8px 0 0', color: '#344054', fontSize: 14, whiteSpace: 'pre-wrap' }}>{comment.content || ''}</p>
                      {pics.length ? (
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          {pics.slice(0, 6).map((pic, picIndex) => (
                            <img
                              key={picIndex}
                              src={typeof pic === 'string' ? pic : pickString(pic as Record<string, any>, ['picUrl', 'url', 'pic'])}
                              alt=""
                              style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6 }}
                            />
                          ))}
                        </div>
                      ) : null}
                      {(comment.replies || []).map((reply, replyIndex) => (
                        <div key={replyIndex} style={{ marginTop: 8, padding: '8px 12px', background: '#f7f8fa', borderRadius: 8, color: '#667085', fontSize: 13 }}>
                          商家回复：{pickString(reply, ['content', 'replyContent', 'reply_content'])}
                        </div>
                      ))}
                    </div>
                  );
                })}
                {comments.length < commentTotal ? (
                  <div style={{ textAlign: 'center', paddingTop: 16 }}>
                    <Button loading={commentLoading} onClick={() => void loadMoreComments()}>加载更多评价</Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <p style={{ color: '#98a2b3', padding: '16px 0' }}>{commentLoading ? '评价加载中...' : '暂无评价'}</p>
            )}
          </Card>
        ) : (
          <Card className="pc-product-detail__card" title="商品咨询">
            <div style={{ color: '#667085', fontSize: 13, paddingBottom: 12, borderBottom: '1px solid #f2f4f7' }}>
              共 {consultTotal} 条咨询，咨询内容由商家回复后展示。
            </div>
            {consults.length ? (
              <div>
                {consults.map((consult, index) => (
                  <div key={consult.id || index} style={{ padding: '14px 0', borderBottom: '1px solid #f7f8fa' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <b style={{ color: '#344054', fontSize: 13 }}>{consult.username || '会员'}</b>
                      <span style={{ color: '#98a2b3', fontSize: 12 }}>{formatDateTime(consult.addTime || consult.createTime)}</span>
                    </div>
                    <p style={{ margin: '8px 0 0', color: '#344054', fontSize: 14, whiteSpace: 'pre-wrap' }}>{consult.content || consult.title || ''}</p>
                    {consult.replyContent ? (
                      <div style={{ marginTop: 8, padding: '8px 12px', background: '#f7f8fa', borderRadius: 8, color: '#667085', fontSize: 13 }}>
                        商家回复：{consult.replyContent}
                      </div>
                    ) : null}
                  </div>
                ))}
                {consults.length < consultTotal ? (
                  <div style={{ textAlign: 'center', paddingTop: 16 }}>
                    <Button loading={consultLoading} onClick={() => void loadMoreConsults()}>加载更多咨询</Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <p style={{ color: '#98a2b3', padding: '16px 0' }}>{consultLoading ? '咨询加载中...' : '暂无咨询'}</p>
            )}
          </Card>
        )}
      </div>

      {/* 猜你喜欢（common/recommend/guessLike） */}
      {recommend.length ? (
        <div className="pc-product-detail__recommend" style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>猜你喜欢</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
            {recommend.slice(0, 8).map((row) => (
              <Link
                key={pickNumber(row, ['productId', 'product_id'], 0)}
                href={`/product/${pickNumber(row, ['productId', 'product_id'], 0)}`}
                style={{ display: 'block', color: 'inherit', background: '#fff', borderRadius: 12, overflow: 'hidden' }}
              >
                <div style={{ width: '100%', aspectRatio: '1 / 1', background: '#f7f8fa' }}>
                  <img
                    src={pickString(row, ['picThumb', 'pic_thumb', 'picUrl', 'pic_url'])}
                    alt={pickString(row, ['productName', 'product_name'])}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div style={{ padding: 10 }}>
                  <div style={{ fontSize: 13, color: '#344054', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {pickString(row, ['productName', 'product_name'])}
                  </div>
                  <div style={{ color: '#e1251b', fontWeight: 600, marginTop: 4 }}>
                    ¥ {yuan(pick(row, ['productPrice', 'product_price'], 0))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* 分享弹窗（ShareModal.vue：文案 + 链接复制 + 二维码 + 社交分享） */}
      <Modal title="分享商品" visible={shareOpen} onCancel={() => setShareOpen(false)} footer={null} width={420}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <textarea
            readOnly
            value={`${item.productName || ''}，¥${yuan(price)} ${shareUrl}`}
            style={{ width: '100%', minHeight: 64, padding: 8, borderRadius: 8, border: '1px solid #e5e6eb', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <input readOnly value={shareUrl} style={{ flex: 1, height: 32, padding: '0 8px', border: '1px solid #e5e6eb', borderRadius: 8 }} />
            <Button theme="solid" type="primary" onClick={() => void copyShare()}>复制链接</Button>
          </div>
          {qrData ? <img src={qrData} alt="商品二维码" style={{ width: 160, height: 160, alignSelf: 'center' }} /> : null}
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', color: '#667085', fontSize: 13 }}>
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
    </>
  );

  return mainContent;
}
