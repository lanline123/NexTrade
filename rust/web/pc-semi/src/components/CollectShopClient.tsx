'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

interface ShopProduct { productId?: number; productName?: string; productPrice?: string | number; picThumb?: string; }
interface ShopObject { shopId?: number; shopTitle?: string; shopLogo?: string; hotProduct?: ShopProduct[]; newProduct?: ShopProduct[]; bestProduct?: ShopProduct[]; }
interface CollectShop { id?: number; collectId?: number; shop: ShopObject; }

export default function CollectShopClient() {
  const [rows, setRows] = useState<CollectShop[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const size = 10;

  const load = () => {
    setLoading(true);
    apiGet<{ records?: CollectShop[]; total?: number }>('user/user/collectionShop', { page, size })
      .then((result) => {
        setRows(Array.isArray(result?.records) ? result.records : []);
        setTotal(Number(result?.total || 0));
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [page]);

  const cancel = async (item: CollectShop) => {
    try {
      await apiPost('user/user/collectionShop/cancel', { id: item.collectId || item.id || item.shop.shopId });
      Toast.success({ content: '已取消收藏' });
      load();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '操作失败' });
    }
  };

  const pages = Math.max(1, Math.ceil(total / size));

  return (
    <Card className="member-card collect-shop" loading={loading}>
      {rows.length ? (
        <div className="collect-shop__list">
          {rows.map((item) => {
            const products = [...(item.shop.hotProduct || []), ...(item.shop.newProduct || []), ...(item.shop.bestProduct || [])].slice(0, 6);
            return (
              <article className="collect-shop__item" key={`${item.shop.shopId}-${item.id || item.collectId || ''}`}>
                <div className="collect-shop__head">
                  <Link href={`/shop/${item.shop.shopId || ''}`} className="collect-shop__logo">
                    <img src={item.shop.shopLogo || ''} alt={item.shop.shopTitle || ''} />
                  </Link>
                  <div>
                    <Link href={`/shop/${item.shop.shopId || ''}`} className="collect-shop__name">{item.shop.shopTitle || '店铺'}</Link>
                    <button type="button" className="collect-shop__cancel" onClick={() => void cancel(item)}>取消收藏</button>
                  </div>
                </div>
                <div className="collect-shop__products">
                  {products.map((product) => (
                    <Link className="collect-shop__product" key={product.productId} href={`/product/${product.productId || ''}`} target="_blank">
                      <img src={product.picThumb || ''} alt={product.productName || ''} />
                      <span>{product.productName || ''}</span>
                      <b>¥ {Number(product.productPrice || 0).toFixed(2)}</b>
                    </Link>
                  ))}
                  {!products.length ? <span className="collect-shop__empty">暂无商品</span> : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : <div className="comment-empty">暂无收藏店铺</div>}
      {pages > 1 ? (
        <div className="comment-pagination">
          <button type="button" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>上一页</button>
          <span>{page} / {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage((n) => n + 1)}>下一页</button>
        </div>
      ) : null}
    </Card>
  );
}
