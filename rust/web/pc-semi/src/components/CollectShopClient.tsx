'use client';

/**
 * 我的收藏店铺
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/collectshop/List.vue
 * - 左卡：店铺 logo/名称、进入店铺、联系客服、取消收藏
 * - 右卡：热销 / 新品 / 精品 三组商品 Tab（源码 itemBar 切换，超 5 条翻页）
 * 接口：GET  /api/user/user/collectionShop
 *       POST /api/user/user/collectionShop/cancel
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
interface ShopProduct { productId?: number; productName?: string; productPrice?: string | number; picThumb?: string; }
interface ShopObject {
  shopId?: number;
  shopTitle?: string;
  shopLogo?: string;
  kefuLink?: string;
  hotProduct?: ShopProduct[];
  newProduct?: ShopProduct[];
  bestProduct?: ShopProduct[];
}
interface CollectShop { id?: number; collectId?: number; shop: ShopObject; }

type ProductTab = 'hot' | 'new' | 'best';

const TAB_LABEL: Record<ProductTab, string> = { hot: '热销商品', new: '新品上市', best: '精品推荐' };
/** 源码：每组最多显示 5 条，超出后左右翻页 */
const PAGE_SIZE = 5;

export default function CollectShopClient() {
    const { t } = useTranslation();
  const [rows, setRows] = useState<CollectShop[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  /** 每个收藏项的商品 Tab 与偏移：key = 收藏 id */
  const [tabs, setTabs] = useState<Record<string, ProductTab>>({});
  const [offsets, setOffsets] = useState<Record<string, number>>({});
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
      await apiPost('user/user/collectionShop/cancel', {
        id: item.collectId || item.id || 0,
        shopId: item.shop.shopId || 0,
      });
      Toast.success({ content: '已取消收藏' });
      load();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '操作失败' });
    }
  };

  const productsOf = (shop: ShopObject, tab: ProductTab): ShopProduct[] => {
    if (tab === 'new') return shop.newProduct || [];
    if (tab === 'best') return shop.bestProduct || [];
    return shop.hotProduct || [];
  };

  const pages = Math.max(1, Math.ceil(total / size));

  return (
    <Card className="member-card collect-shop" loading={loading}>
      {rows.length ? (
        <div className="collect-shop__list">
          {rows.map((item) => {
            const key = String(item.id ?? item.collectId ?? item.shop.shopId ?? '');
            const tab = tabs[key] || 'hot';
            const offset = offsets[key] || 0;
            const all = productsOf(item.shop, tab);
            const visible = all.slice(offset, offset + PAGE_SIZE);
            const canPrev = offset > 0;
            const canNext = offset + PAGE_SIZE < all.length;
            const shopHref = `/shop/${item.shop.shopId || ''}`;
            return (
              <article className="collect-shop__item" key={key}>
                <div className="collect-shop__left">
                  <Link href={shopHref} className="collect-shop__logo">
                    <img src={item.shop.shopLogo || ''} alt={item.shop.shopTitle || ''} />
                  </Link>
                  <Link href={shopHref} className="collect-shop__name">{item.shop.shopTitle || t('店铺')}</Link>
                  <div className="collect-shop__ops">
                    <Link href={shopHref} target="_blank" className="collect-shop__btn">{t('进入店铺')}</Link>
                    {item.shop.kefuLink ? (
                      <a href={String(item.shop.kefuLink)} target="_blank" rel="noreferrer" className="collect-shop__btn">{t('联系客服')}</a>
                    ) : null}
                    <button type="button" className="collect-shop__btn collect-shop__cancel" onClick={() => void cancel(item)}>{t('取消收藏')}</button>
                  </div>
                </div>

                <div className="collect-shop__right">
                  <div className="collect-shop__tabs">
                    <div className="collect-shop__tabs-left">
                      {(Object.keys(TAB_LABEL) as ProductTab[]).map((name) => (
                        <button
                          key={name}
                          type="button"
                          className={tab === name ? 'is-active' : ''}
                          onClick={() => setTabs((current) => ({ ...current, [key]: name }))}
                        >
                          {TAB_LABEL[name]}
                        </button>
                      ))}
                    </div>
                    {all.length > PAGE_SIZE ? (
                      <div className="collect-shop__tabs-right">
                        <button type="button" disabled={!canPrev} onClick={() => setOffsets((c) => ({ ...c, [key]: Math.max(0, offset - PAGE_SIZE) }))}>‹</button>
                        <button type="button" disabled={!canNext} onClick={() => setOffsets((c) => ({ ...c, [key]: offset + PAGE_SIZE }))}>›</button>
                      </div>
                    ) : null}
                  </div>

                  <div className="collect-shop__products">
                    {visible.map((product) => (
                      <Link className="collect-shop__product" key={product.productId} href={`/product/${product.productId || ''}`} target="_blank">
                        <img src={product.picThumb || ''} alt={product.productName || ''} />
                        <span className="collect-shop__product-name">{product.productName || ''}</span>
                        <b>¥ {Number(product.productPrice || 0).toFixed(2)}</b>
                      </Link>
                    ))}
                    {!visible.length ? <span className="collect-shop__empty">{t('暂无商品')}</span> : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : <div className="comment-empty">{t('暂无收藏店铺')}</div>}
      {pages > 1 ? (
        <div className="comment-pagination">
          <button type="button" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>{t('上一页')}</button>
          <span>{page} / {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage((n) => n + 1)}>{t('下一页')}</button>
        </div>
      ) : null}
    </Card>
  );
}
