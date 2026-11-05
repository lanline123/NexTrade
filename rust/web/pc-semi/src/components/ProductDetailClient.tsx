'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Card, InputNumber, Tag, Toast } from '@douyinfe/semi-ui';
import { IconCart, IconCreditCard } from '@douyinfe/semi-icons';
import type { ProductDetailResponse } from '@/lib/api';
import { addToCart } from '@/lib/api';
import { apiPost } from '@/lib/client-api';

function yuan(value: unknown): string {
  const amount = Number(value || 0);
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  const price = useMemo(() => {
    const selected = detail.skuList?.find((sku) => sku.skuId === skuId);
    return selected?.productPrice ?? item.productPrice;
  }, [detail.skuList, skuId, item.productPrice]);

  const requireLogin = () => {
    if (typeof window === 'undefined') return true;
    if (localStorage.getItem('accessToken')) return true;
    window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    return false;
  };

  const add = async (next?: 'cart' | 'checkout') => {
    if (!requireLogin()) return;
    setAdding(true);
    try {
      await addToCart({ id: Number(item.productId), number: quantity, skuId, isQuick: 0 });
      if (next === 'checkout') {
        window.location.href = '/order/check';
        return;
      }
      Toast.success({ content: '已加入购物车' });
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
            <span>库存：{item.productStock ?? 0}</span>
            <span>销量：{item.virtualSales ?? 0}</span>
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

          {detail.skuList?.length ? (
            <div className="pc-product-detail__sku">
              <span>规格</span>
              <div className="pc-product-detail__sku-list">
                {detail.skuList.map((sku: any) => (
                  <Button
                    key={sku.skuId}
                    theme={sku.skuId === skuId ? 'solid' : 'light'}
                    type={sku.skuId === skuId ? 'primary' : 'tertiary'}
                    onClick={() => setSkuId(sku.skuId)}
                  >
                    {String(sku.skuName || sku.skuSpec || `规格 ${sku.skuId}`)}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="pc-product-detail__quantity">
            <span>数量</span>
            <InputNumber min={1} max={Number(item.productStock) || 9999} value={quantity} onChange={(value) => setQuantity(Number(value) || 1)} />
          </div>

          <div className="pc-product-detail__actions">
            <Button size="large" theme="solid" type="primary" icon={<IconCart />} loading={adding} onClick={() => void add()}>
              加入购物车
            </Button>
            <Button size="large" theme="light" type="primary" icon={<IconCreditCard />} onClick={() => void add('checkout')}>
              立即购买
            </Button>
            <Button size="large" onClick={collect}>收藏</Button>
          </div>

          <div className="pc-product-detail__services">
            <span>
              支持配送
            </span>
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
              <b>{item.productStock ?? 0}</b>
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
