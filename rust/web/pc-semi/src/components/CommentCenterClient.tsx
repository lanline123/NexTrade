'use client';

/**
 * 评价晒单（PC 会员中心）
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/comment/List.vue
 *
 * 旧版三个 Tab 与接口：
 * - 待评价(0)：GET /api/user/order/list，参数 { page, size, commentStatus: 0 }
 * - 待晒单(1)：GET /api/user/comment/showedList?isShowed=0，参数 { page, size }
 * - 已评价(2)：GET /api/user/comment/list，参数 { page, size }
 * 顶部角标：GET /api/user/comment/subNum → { awaitComment, showPics, commented }
 *
 * 样式对齐 /member/order/list 的 pc-order-panel 面板（下划线 Tab / 发丝线卡片 / 数字分页）。
 *
 * 注意：三个 Tab 的角标与左侧会员导航角标不是同一个数：
 * - Tab 角标来自 `user/comment/subNum`（待评价 / 待晒单 / 已评价），
 * - 左侧「评价晒单」角标来自 `user/order/orderNum.awaitComment`（仅待评价）。
 * 两者都由「已完成且未评价」订单驱动，需与后端 orderNum 口径保持一致。
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Spin, Toast } from '@douyinfe/semi-ui';
import { apiGet } from '@/lib/client-api';
import MemberCommentList, { MemberCommentItem } from '@/components/MemberCommentList';

import { useTranslation } from 'react-i18next';
type TabKey = 'pending' | 'showed' | 'commented';

interface OrderItem {
  productId?: number;
  productName?: string;
  productSn?: string;
  picThumb?: string;
  productImage?: string;
  quantity?: number;
  price?: number | string;
  skuData?: Array<{ name?: string; value?: string }>;
}

interface OrderRow {
  orderId?: number;
  orderSn?: string;
  addTime?: string;
  consignee?: string;
  totalAmount?: number | string;
  items?: OrderItem[];
}

interface CommentReply {
  commentId?: number;
  content?: string;
  addTime?: string;
  kefuName?: string;
}

interface CommentRow {
  commentId?: number;
  productId?: number;
  productName?: string;
  productSn?: string;
  picThumb?: string;
  commentRank?: number;
  content?: string;
  addTime?: string;
  status?: number;
  statusText?: string;
  username?: string;
  isAnonymous?: number;
  avatar?: string;
  commentTag?: string[];
  skuData?: Array<{ name?: string; value?: string }>;
  showPics?: Array<{ picUrl?: string; picThumb?: string }>;
  replies?: CommentReply[];
  kefuName?: string;
  isShowed?: number;
}

interface SubNum {
  awaitComment?: number;
  showPics?: number;
  commented?: number;
}

const TABS: Array<{ key: TabKey; label: string; orderType: number }> = [
  { key: 'pending', label: '待评价', orderType: 0 },
  { key: 'showed', label: '待晒单', orderType: 1 },
  { key: 'commented', label: '晒单评价', orderType: 2 },
];

function money(value: unknown): string {
  return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 规格数据 → 文本（与订单列表 skuText 保持一致，兼容对象/字符串数组） */
function skuText(sku: OrderItem['skuData']): string {
  if (!Array.isArray(sku)) return '';
  return sku
    .map((item) => (item?.name || item?.value ? `${item.name ?? ''}${item.name && item.value ? '：' : ''}${item.value ?? ''}` : ''))
    .filter(Boolean)
    .join('；');
}

export default function CommentCenterClient({ initialTab }: { initialTab?: TabKey }) {
    const { t } = useTranslation();
  const [tab, setTab] = useState<TabKey>(initialTab && TABS.some((item) => item.key === initialTab) ? initialTab : 'pending');
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [subNum, setSubNum] = useState<SubNum>({});
  const [commentEnabled, setCommentEnabled] = useState<number | null>(null);
  const size = 10;

  useEffect(() => {
    // D1146：评价总开关（对应旧版 commonStore.productCommentEnabled）
    fetch('/api/common/config/base')
      .then((response) => response.json())
      .then((json) => setCommentEnabled(Number(json?.data?.productCommentEnabled ?? 1)))
      .catch(() => setCommentEnabled(1));
  }, []);

  const loadSubNum = () => {
    apiGet<SubNum>('user/comment/subNum')
      .then((result) => setSubNum(result || {}))
      .catch(() => setSubNum({}));
  };

  useEffect(() => {
    // D1146：开关关闭时不取数，页面直接呈现空态
    if (commentEnabled === 0) {
      setLoading(false);
      return;
    }
    if (commentEnabled === null) return;
    loadSubNum();
  }, [commentEnabled]);

  useEffect(() => {
    if (commentEnabled !== 1) return;
    setLoading(true);
    const path = tab === 'pending' ? 'user/order/list' : tab === 'showed' ? 'user/comment/showedList' : 'user/comment/list';
    const params = tab === 'pending' ? { page, size, commentStatus: 0 } : { page, size, isShowed: tab === 'showed' ? 0 : undefined };
    apiGet<{ records?: Array<OrderRow & CommentRow>; total?: number }>(path, params)
      .then((result) => {
        const rows = Array.isArray(result?.records) ? result.records : [];
        if (tab === 'commented') {
          setComments(rows as CommentRow[]);
          setOrders([]);
        } else {
          setOrders(rows as OrderRow[]);
          setComments([]);
        }
        setTotal(Number(result?.total || 0));
      })
      .catch((error) => {
        setOrders([]);
        setComments([]);
        Toast.error({ content: error instanceof Error ? error.message : '评价列表加载失败' });
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, commentEnabled]);

  const pages = Math.max(1, Math.ceil(total / size));

  const renderPagination = () =>
    total > size ? (
      <div className="pc-order-panel__foot">
        <div className="pc-pagination">
          {Array.from({ length: pages }).map((_, index) => (
            <button key={index} type="button" className={index + 1 === page ? 'is-active' : ''} onClick={() => setPage(index + 1)}>
              {index + 1}
            </button>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div className="member-orders comment-center">
      <div className="pc-order-panel">
        <div className="pc-order-panel__head">
          <div className="member-orders__tabs">
            {TABS.map((item) => {
              const count = item.key === 'pending' ? subNum.awaitComment : item.key === 'showed' ? subNum.showPics : subNum.commented;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={tab === item.key ? 'is-active' : ''}
                  onClick={() => {
                    setPage(1);
                    setTab(item.key);
                  }}
                >
                  {item.label}
                  {Number(count || 0) > 0 ? <span className="member-orders__num">{count}</span> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pc-order-panel__body">
          {commentEnabled === 0 ? (
            <div className="comment-empty">
              <p>{t('评价功能已关闭')}</p>
            </div>
          ) : loading ? (
            <div className="member-orders__loading"><Spin size="large" /></div>
          ) : tab !== 'commented' ? (
            orders.length ? (
              <div className="member-orders__list">
                {orders.map((item, index) => {
                  const totalCount = (item.items || []).reduce((sum, product) => sum + Number(product.quantity || 0), 0);
                  return (
                    <article className="member-order" key={item.orderId || index}>
                      <header className="member-order__head">
                        <span className={`member-order__status ${tab === 'pending' ? 'is-s0' : 'is-s2'}`}>
                          {tab === 'pending' ? t('待评价') : '待晒单'}
                        </span>
                        <span className="member-order__sn">{item.orderSn || '-'}</span>
                        <span className="comment-center__consignee">收货人：{item.consignee || '-'}</span>
                        <span className="member-order__time">{item.addTime || ''}</span>
                        <Link className="member-order__detail" href={`/member/order/info?id=${item.orderId || ''}`} target="_blank">{t('订单详情')}<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M4 2.5L7.5 6L4 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </Link>
                      </header>
                      {(item.items || []).map((product, productIndex) => (
                        <div className="member-order__shop" key={productIndex}>
                          <Link
                            href={product.productId ? `/product/${product.productId}` : '/search'}
                            target="_blank"
                            className="member-order__shop-main"
                          >
                            <img src={product.picThumb || product.productImage || ''} alt={product.productName || ''} />
                            <div className="member-order__shop-text">
                              <div className="member-order__shop-name">{product.productName || t('商品')}</div>
                              {skuText(product.skuData) ? <div className="member-order__shop-sku">{skuText(product.skuData)}</div> : null}
                            </div>
                          </Link>
                          <div className="member-order__shop-price">
                            <span>¥ {money(product.price)}</span>
                            <span className="member-order__qty">×{product.quantity || 1}</span>
                          </div>
                        </div>
                      ))}
                      <footer className="member-order__foot">
                        <div className="member-order__total">
                          <span>共 {totalCount} 件</span>
                          <span className="member-order__total-label">{t('合计')}</span>
                          <b>¥ {money(item.totalAmount)}</b>
                        </div>
                        <div className="member-order__bot-actions">
                          <Link href={`/member/comment/info?orderId=${item.orderId || ''}`}>
                            <Button size="small" theme="solid" type="primary">{tab === 'pending' ? t('去评价') : '去晒单'}</Button>
                          </Link>
                        </div>
                      </footer>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="member-orders__empty">
                <p className="member-orders__empty-title">{tab === 'pending' ? t('当前筛选下还没有任何订单哦!') : '暂无待晒单订单'}</p>
                <p className="member-orders__empty-sub">{t('现在就去：')}<Link href="/">{t('选购商品')}</Link>
                </p>
              </div>
            )
          ) : comments.length ? (
            /* 已评价列表（CommentList.vue 对照 → MemberCommentList.tsx） */
            <MemberCommentList comments={comments as MemberCommentItem[]} />
          ) : (
            <div className="member-orders__empty">
              <p className="member-orders__empty-title">{t('暂无已评价记录')}</p>
              <p className="member-orders__empty-sub">{t('现在就去：')}<Link href="/">{t('选购商品')}</Link>
              </p>
            </div>
          )}
        </div>

        {commentEnabled !== 0 && !loading ? renderPagination() : null}
      </div>
    </div>
  );
}
