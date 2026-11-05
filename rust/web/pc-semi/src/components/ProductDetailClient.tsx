'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Card, InputNumber, Tag, Toast } from '@douyinfe/semi-ui';
import { IconCart, IconCreditCard } from '@douyinfe/semi-icons';
import type { ProductDetailResponse } from '@/lib/api';
import { addToCart } from '@/lib/api';
import { apiPost } from '@/lib/client-api';

/**
 * 商品详情（源码对照 java-b2b2c-overseas-v5.8.61/view/pc/pages/item/src/Product.vue
 * + components/product/ProductSku.vue / ProductInfo.vue / Buy.vue）
 *
 * 对齐点：
 * - 规格选择：attrList.spe 分组勾选 → skuList 按 skuData（名称:值）匹配 skuId；
 *   缺规格不可加购；规格停用/售罄置灰
 * - 数量上限：`maxProductNumber > 0 ? maxProductNumber : productStock > 0 ? productStock : 1`
 * - 立即购买：addToCart(isQuick=1) 后按返回 flowType 跳 /order/check?flowType=&skuId=
 * - 加入购物车：isQuick=0，成功后提示并广播购物车变化
 * - 商品动作：收藏、分享（复制链接）、评价入口、限购/库存提示
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
  skuData?: Array<{ name?: string; value?: string }>;
}

function yuan(value: unknown): string {
  const amount = Number(value || 0);
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  const pictures = detail.picList?.length
    ? detail.picList
    : [{ picUrl: item.picLarge || item.picUrl, picThumb: item.picThumb }];
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [skuId, setSkuId] = useState<number | undefined>(undefined);
  const [adding, setAdding] = useState(false);

  const skuGroups = useMemo(() => buildSkuGroups(detail), [detail]);
  const skuList = (detail.skuList || []) as SkuRow[];
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    // 地址栏 skuId 命中时按该 SKU 的 skuData 预选（旧版 useProductSkuUrl.applyUrlSkuId）
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

  useEffect(() => {
    if (quantity > maxQuantity) setQuantity(maxQuantity);
  }, [maxQuantity, quantity]);

  // 单规格商品自动选中唯一 SKU；多规格由用户选择（旧版默认 checkedValue）
  useEffect(() => {
    if (skuGroups.length === 0 && skuList.length === 1 && !skuId) {
      setSkuId(Number(skuList[0].skuId));
    }
  }, [skuGroups.length, skuList, skuId]);

  const requireLogin = () => {
    if (typeof window === 'undefined') return true;
    if (localStorage.getItem('accessToken')) return true;
    window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    return false;
  };

  /** 规格选择 + 地址栏 skuId 同步（旧版 useSkuUrlSync：replaceState，不新增历史）。 */
  const toggleSpec = (group: SkuGroup, value: SkuValue) => {
    if (value.stock === 0) {
      Toast.warning({ content: '该规格暂时缺货' });
      return;
    }
    const next = { ...selected, [group.name]: selected[group.name] === value.value ? '' : value.value };
    setSelected(next);
    setQuantity(1);
    if (value.pic) setActiveImage(0);
    // 找到与当前选择完全匹配的 SKU 并写回地址栏；不完整选择时移除 skuId
    const matched = skuGroups.length
      ? skuList.find((sku) => {
          const data = sku.skuData || [];
          return (
            data.length === skuGroups.length &&
            skuGroups.every((item) => data.some((entry) => String(entry.name || '') === item.name && String(entry.value || '') === next[item.name]))
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
    try {
      await apiPost('user/collectProduct/save', { productId: Number(item.productId) });
      Toast.success({ content: '已收藏商品' });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '收藏失败' });
    }
  };

  const share = async () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      Toast.success({ content: '商品链接已复制' });
    } catch {
      window.prompt('复制商品链接', url);
    }
  };

  return (
    <>
      <div className="pc-product-detail">
        <div className="pc-product-detail__gallery">
          <div className="pc-product-detail__main-image">
            <img src={pictures[activeImage]?.picUrl || pictures[activeImage]?.picThumb || ''} alt={item.productName} />
          </div>
          <div className="pc-product-detail__thumbs">
            {pictures.map((pic: any, index: number) => (
              <button
                key={pic.picId || index}
                type="button"
                className={index === activeImage ? 'is-active' : ''}
                onClick={() => setActiveImage(index)}
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
            <Button size="large" onClick={collect}>收藏</Button>
            <Button size="large" onClick={share}>分享</Button>
          </div>
          {requireSku ? <p className="pc-product-detail__tips">请选择完整规格后购买</p> : null}
          {outOfStock ? <p className="pc-product-detail__tips">该商品暂时缺货，敬请期待</p> : null}

          <div className="pc-product-detail__services">
            <span>支持配送</span>
            <span>正品保障</span>
            <span>售后无忧</span>
          </div>
        </div>
      </div>

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
            <div>
              <span>商品名称</span>
              <b>{item.productName}</b>
            </div>
            <div>
              <span>商品编号</span>
              <b>{item.productSn || '-'}</b>
            </div>
            <div>
              <span>库存</span>
              <b>{stock}</b>
            </div>
            <div>
              <span>上架时间</span>
              <b>{item.addTime ? new Date(Number(item.addTime) * 1000).toLocaleString('zh-CN') : '-'}</b>
            </div>
          </div>
        </Card>

        <div className="pc-product-detail__back">
          <Link href="/">返回首页</Link>
        </div>
      </div>
    </>
  );
}
