'use client';

/**
 * 积分兑换详情（对照旧版 `pages/exchange/[id].vue` + `pages/item/src/Product.vue` exchange 模式
 * + `components/product/Buy.vue` exchange 分支）。
 *
 * 旧版行为：
 * - 复用完整商品详情组件（productType="exchange"），含规格选择；
 * - 「立即兑换」= addExchangeToCart(isQuick=1) → /order/check?flowType=&skuId=；
 * - 「加入购物车」= addExchangeToCart(isQuick=0) → 提示成功。
 * 接口：GET /api/product/exchange/detail（返回 ClientProductDetailVO + exchangeInfo）
 *      POST /api/product/exchange/addToCart { id(活动ID), number, skuId, isQuick }
 *
 * 本实现：SSR 首屏 + 客户端交互；规格选择复用商详 pds-sku 样式；Semi UI 控件。
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, InputNumber, Tag, Toast } from '@douyinfe/semi-ui';
import { IconCart } from '@douyinfe/semi-icons';
import { apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
import { formatPrice } from '@/lib/currency';
interface SkuValue {
  value: string;
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
  skuData?: Array<{ name?: string; value?: string }>;
}

interface ExchangeDetailData {
  item?: Record<string, any>;
  exchangeInfo?: Record<string, any>;
  skuList?: SkuRow[];
  attrList?: { spe?: Array<Record<string, any>> };
}

/** 价格单位为元（后端 Decimal 字符串直出，见 utils/priceFormat.ts 口径）。 */
function yuan(value: unknown): string {
  return Number(value || 0).toFixed(2);
}
function pick<T>(row: Record<string, any> | undefined, keys: string[], fallback: T): T {
  if (!row) return fallback;
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== '') return value as T;
  }
  return fallback;
}

function buildSkuGroups(data: ExchangeDetailData): SkuGroup[] {
  const spe = (data.attrList?.spe || []) as Array<Record<string, any>>;
  return spe
    .map((group) => ({
      name: String(group?.attrName ?? ''),
      values: ((group?.attrList || []) as Array<Record<string, any>>)
        .map((value) => ({
          value: String(value?.attrValue ?? ''),
          stock: Number(value?.skuStock ?? -1),
          pic: value?.attrPicThumb || value?.attrPic,
        }))
        .filter((value) => value.value),
    }))
    .filter((group) => group.name && group.values.length > 0);
}

export default function ExchangeDetailClient({ data }: { data: ExchangeDetailData }) {
    const { t } = useTranslation();
  const item = (data.item || {}) as Record<string, any>;
  const info = (data.exchangeInfo || item) as Record<string, any>;
  const activityId = Number(pick(info, ['id', 'exchangeId'], 0));
  const productId = Number(pick(info, ['productId'], pick(item, ['productId'], 0)));
  const activitySkuId = Number(pick(info, ['skuId'], 0));

  const name = String(pick(info, ['productName'], pick(item, ['productName'], '积分兑换商品')));
  const pic = String(pick(info, ['picThumb', 'picUrl'], pick(item, ['picThumb', 'picUrl'], '')));
  const exchangeIntegral = Number(pick(info, ['exchangeIntegral'], 0));
  const deductedAmount = Number(pick(info, ['pointsDeductedAmount'], 0));
  const exchangePrice = Number(pick(info, ['discountsPrice'], pick(item, ['productPrice'], 0)));
  const marketPrice = Number(pick(info, ['marketPrice'], pick(item, ['marketPrice'], 0)));

  const skuGroups = useMemo(() => buildSkuGroups(data), [data]);
  const skuRows = (data.skuList || []) as SkuRow[];
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState<'cart' | 'buy' | null>(null);

  const selectedSku = useMemo(() => {
    if (!skuGroups.length) return undefined;
    const picked = skuGroups.map((group) => selected[group.name]).filter(Boolean);
    if (picked.length !== skuGroups.length) return undefined;
    return skuRows.find((sku) => {
      const rows = sku.skuData || [];
      return (
        rows.length === skuGroups.length &&
        skuGroups.every((group) => rows.some((entry) => String(entry?.name || '') === group.name && String(entry?.value || '') === selected[group.name]))
      );
    });
  }, [skuGroups, selected, skuRows]);

  const requireSku = skuGroups.length > 0 && !selectedSku;
  const stock = Number(selectedSku?.skuStock ?? pick(info, ['productStock'], pick(item, ['productStock'], 0)));
  const skuId = selectedSku?.skuId ?? (activitySkuId > 0 ? activitySkuId : undefined);

  const requireLogin = () => {
    if (typeof window === 'undefined') return true;
    if (localStorage.getItem('accessToken')) return true;
    window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    return false;
  };

  const submit = async (next: 'cart' | 'buy') => {
    if (!activityId) {
      Toast.error({ content: '兑换活动不存在' });
      return;
    }
    if (requireSku) {
      Toast.warning({ content: '请先选择商品规格' });
      return;
    }
    if (stock <= 0) {
      Toast.error({ content: '该商品积分已兑完' });
      return;
    }
    if (!requireLogin()) return;
    setSubmitting(next);
    try {
      // 旧版 Buy.vue exchange 分支：addExchangeToCart { id(活动ID), number, skuId, isQuick }
      const result = await apiPost<Record<string, any>>('product/exchange/addToCart', {
        id: activityId,
        number: quantity,
        ...(skuId ? { skuId: Number(skuId) } : {}),
        isQuick: next === 'buy' ? 1 : 0,
      });
      if (next === 'buy') {
        const flowType = Number(result?.flowType) || 0;
        const query = new URLSearchParams();
        if (flowType) query.set('flowType', String(flowType));
        if (skuId) query.set('skuId', String(skuId));
        window.location.href = `/order/check${query.toString() ? `?${query.toString()}` : ''}`;
        return;
      }
      Toast.success({ content: '已加入购物车' });
      window.dispatchEvent(new Event('pc-cart-change'));
    } catch (error) {
      const message = error instanceof Error ? error.message : '兑换失败';
      if (message.includes('登录') || message.includes('401')) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
      }
      Toast.error({ content: message });
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <section className="exchange-detail-card">
      <div className="exchange-detail-pic">
        {pic ? <img src={pic} alt={name} /> : <span className="exchange-detail-pic__empty">{t('暂无图片')}</span>}
      </div>
      <div className="exchange-detail-info">
        <h1>{name}</h1>

        <div className="exchange-detail-price">
          <Tag color="orange" size="large">{t('积分兑换')}</Tag>
          <b>{exchangeIntegral}</b>
          <span>{t('积分')}</span>
          {deductedAmount > 0 || exchangePrice > 0 ? (
            <>
              <span>+</span>
              <b>{formatPrice(deductedAmount || exchangePrice)}</b>
            </>
          ) : null}
        </div>
        {marketPrice > 0 ? <div className="exchange-detail-meta">{t('市场价：')}<s>{formatPrice(marketPrice)}</s></div> : null}
        <div className="exchange-detail-meta">
          库存：
          {stock > 0 ? (
            <span className="exchange-detail-stock">{stock} 件可兑</span>
          ) : (
            <Tag color="grey" type="solid">{t('已兑完')}</Tag>
          )}
        </div>

        {skuGroups.map((group) => (
          <div key={group.name} className="pds-sku__group">
            <span className="pds-sku__label">{group.name}</span>
            <div className="pds-sku__list">
              {group.values.map((value) => {
                const active = selected[group.name] === value.value;
                const disabled = value.stock === 0;
                return (
                  <button
                    key={value.value}
                    type="button"
                    disabled={disabled}
                    className={`exchange-sku__value${active ? ' is-active' : ''}`}
                    onClick={() =>
                      setSelected((current) => {
                        const next = { ...current };
                        if (next[group.name] === value.value) delete next[group.name];
                        else next[group.name] = value.value;
                        return next;
                      })
                    }
                  >
                    {value.pic ? <img src={value.pic} alt="" className="pds-sku__pic" /> : null}
                    {value.value}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="exchange-detail-quantity">
          <span className="pds-sku__label">{t('数量')}</span>
          <InputNumber
            value={quantity}
            min={1}
            max={stock > 0 ? stock : 1}
            step={1}
            onChange={(value) => setQuantity(Math.max(1, Math.min(stock > 0 ? stock : 1, Number(value) || 1)))}
            style={{ width: 140 }}
          />
        </div>

        <div className="exchange-detail-actions">
          <Button
            theme="solid"
            type="primary"
            icon={<IconCart />}
            size="large"
            disabled={stock <= 0 || requireSku}
            loading={submitting === 'buy'}
            onClick={() => void submit('buy')}
          >{t('立即兑换')}</Button>
          <Button
            size="large"
            disabled={stock <= 0 || requireSku}
            loading={submitting === 'cart'}
            onClick={() => void submit('cart')}
          >{t('加入购物车')}</Button>
          {productId > 0 ? (
            <Link className="exchange-detail-link" href={`/product/${productId}`}>{t('查看商品详情')}</Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
