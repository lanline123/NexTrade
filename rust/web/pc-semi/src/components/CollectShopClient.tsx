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
import { Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';
import FormatPrice from '@/components/FormatPrice';

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
/** 源码 collectshop/List.vue：每组最多显示 5 条，超出后左右翻页 */
const PAGE_SIZE = 5;
/**
 * 源码 collectshop/List.vue 的 isStore() 分支（门店版文案）：
 * 旧版由构建期环境变量 VITE_IS_STORE 决定；新版沿用 NEXT_PUBLIC_PC_IS_STORE 约定。
 * 跨境 B2C 部署下恒为 false，标题/按钮保持「收藏的店铺 / 进入店铺」。
 */
const IS_STORE = process.env.NEXT_PUBLIC_PC_IS_STORE === '1';

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

    /** 源码 collectshop/List.vue：pageTitle / cardTitle / enterLabel / emptyText */
    const pageTitle = IS_STORE ? t('收藏的门店') : t('收藏的店铺');
    const cardTitle = IS_STORE ? t('收藏门店') : t('收藏店铺');
    const enterLabel = IS_STORE ? t('进入门店') : t('进入店铺');
    const emptyText = IS_STORE ? t('您还没有收藏的门店') : t('您还没有收藏的店铺');

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
    <div className="info-row collect-product mp-collect-shop">
      {/* 源码 collectshop/List.vue：cardTitle（门店版为「收藏门店」） */}
      <div className="title-or-tabs">
        <span className="card-title">{cardTitle}</span>
      </div>
      <div className="page-info-body">
        <div className="collect-list-content">
          {rows.length ? (
            <>
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
                  <div className="card" key={key}>
                    <div className="left-card">
                      <div className="inner-div" onClick={() => void cancel(item)}>{t('取消收藏')}</div>
                      <div className="logo">
                        <img className="image" src={item.shop.shopLogo || ''} alt={item.shop.shopTitle || ''} />
                      </div>
                      <div className="title">{item.shop.shopTitle || t('店铺')}</div>
                      <div className="operation-card">
                        <Link href={shopHref} target="_blank" className="butt butt1">
                          <i className="iconfont-pc icon-guanli font-color" />{enterLabel}
                        </Link>
                        {item.shop.kefuLink ? (
                          <a href={String(item.shop.kefuLink)} target="_blank" rel="noreferrer" className="butt">
                            <i className="iconfont-pc icon-kefu font-color" />{t('联系客服')}
                          </a>
                        ) : null}
                      </div>
                    </div>

                    <div className="right-card">
                      <div className="top-bar">
                        <div className="left-bar">
                          {(Object.keys(TAB_LABEL) as ProductTab[]).map((name) => (
                            <div
                              key={name}
                              className={`inner-div${tab === name ? ' inner-div-hover' : ''}`}
                              onClick={() => setTabs((current) => ({ ...current, [key]: name }))}
                            >
                              {TAB_LABEL[name]}
                            </div>
                          ))}
                        </div>
                        {all.length > PAGE_SIZE ? (
                          <div className="right-bar">
                            <div className="inner-div" onClick={() => setOffsets((c) => ({ ...c, [key]: Math.max(0, offset - PAGE_SIZE) }))}>
                              <span className="iconfont-pc icon-jiantou_zuo" />
                            </div>
                            <div className="inner-div" onClick={() => setOffsets((c) => ({ ...c, [key]: offset + PAGE_SIZE }))}>
                              <span className="iconfont-pc icon-jiantou_you" />
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="product-list">
                        {visible.length ? (
                          visible.map((product) => (
                            <Link className="product-card" key={product.productId} href={`/product/${product.productId || ''}`} target="_blank">
                              <div className="product-img-wrap">
                                <img className="image" src={product.picThumb || ''} alt={product.productName || ''} />
                              </div>
                              <div className="product_price">
                                <FormatPrice value={product.productPrice} fontSize="14px" fontWeight={400} />
                              </div>
                            </Link>
                          ))
                        ) : (
                          <div className="no-data">{loading ? null : <span>{t('暂无商品')}</span>}</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {pages > 1 ? (
                <div className="el-page">
                  <div className="pagination">
                    <button type="button" disabled={page <= 1} aria-label={t('上一页')} onClick={() => setPage((n) => n - 1)}>
                      {'<'}
                    </button>
                    {Array.from({ length: pages }, (_, index) => index + 1).map((number) => (
                      <button
                        type="button"
                        key={number}
                        className={number === page ? 'is-active' : ''}
                        onClick={() => setPage(number)}
                      >
                        {number}
                      </button>
                    ))}
                    <button type="button" disabled={page >= pages} aria-label={t('下一页')} onClick={() => setPage((n) => n + 1)}>
                      {'>'}
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="no-result">
              <div className="empty">
                <img className="empty-img" src="/assets/images/empty-box.png" alt="" />
                <div className="empty-text">{emptyText}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
