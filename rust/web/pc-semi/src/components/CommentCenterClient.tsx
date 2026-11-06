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
 * 注意：Rust 端 `GET /api/user/order/list` 当前仅支持 orderStatus（MyOrderQuery），
 * commentStatus 参数会被忽略 —— 属后端缺口，前端保留旧版入参，报告中登记。
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Spin, Toast } from '@douyinfe/semi-ui';
import { apiGet } from '@/lib/client-api';

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

/** 评分星标：1-5 星，缺省不展示 */
function Stars({ rank }: { rank?: number }) {
  const value = Math.min(5, Math.max(0, Number(rank ?? 0)));
  if (!value) return null;
  return (
    <span className="comment-list__stars" aria-label={`评分 ${value} 星`}>
      {'★'.repeat(value)}
      {'☆'.repeat(5 - value)}
    </span>
  );
}

export default function CommentCenterClient({ initialTab }: { initialTab?: TabKey }) {
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
              <p>评价功能已关闭</p>
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
                          {tab === 'pending' ? '待评价' : '待晒单'}
                        </span>
                        <span className="member-order__sn">{item.orderSn || '-'}</span>
                        <span className="comment-center__consignee">收货人：{item.consignee || '-'}</span>
                        <span className="member-order__time">{item.addTime || ''}</span>
                        <Link className="member-order__detail" href={`/member/order/info?id=${item.orderId || ''}`} target="_blank">
                          订单详情<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M4 2.5L7.5 6L4 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
                              <div className="member-order__shop-name">{product.productName || '商品'}</div>
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
                          <span className="member-order__total-label">合计</span>
                          <b>¥ {money(item.totalAmount)}</b>
                        </div>
                        <div className="member-order__bot-actions">
                          <Link href={`/member/comment/info?orderId=${item.orderId || ''}`}>
                            <Button size="small" theme="solid" type="primary">{tab === 'pending' ? '去评价' : '去晒单'}</Button>
                          </Link>
                        </div>
                      </footer>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="member-orders__empty">
                <p className="member-orders__empty-title">{tab === 'pending' ? '当前筛选下还没有任何订单哦!' : '暂无待晒单订单'}</p>
                <p className="member-orders__empty-sub">
                  现在就去：<Link href="/">选购商品</Link>
                </p>
              </div>
            )
          ) : comments.length ? (
            <div className="member-orders__list">
              {comments.map((item, index) => {
                const author = item.isAnonymous === 1 ? '匿名用户' : item.username || '会员';
                return (
                  <article className="member-order comment-card" key={item.commentId || index}>
                    <header className="member-order__head">
                      <span className={`member-order__status ${item.isShowed === 1 ? 'is-s2' : 'is-s3'}`}>
                        {item.isShowed === 1 ? '已晒单' : item.statusText || '已评价'}
                      </span>
                      <span className="comment-card__author">
                        {item.avatar ? (
                          <img src={item.avatar} alt="" className="comment-card__avatar" />
                        ) : (
                          <span className="comment-card__avatar comment-card__avatar--fallback" aria-hidden="true">{author.slice(0, 1)}</span>
                        )}
                        {author}
                      </span>
                      <span className="member-order__time">{item.addTime || ''}</span>
                      <Link className="member-order__detail" href={item.productId ? `/product/${item.productId}` : '/search'} target="_blank">
                        商品详情<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M4 2.5L7.5 6L4 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </Link>
                    </header>
                    <div className="member-order__shop comment-card__product">
                      <Link href={item.productId ? `/product/${item.productId}` : '/search'} target="_blank" className="member-order__shop-main">
                        <img src={item.picThumb || ''} alt={item.productName || ''} />
                        <div className="member-order__shop-text">
                          <div className="member-order__shop-name">{item.productName || '商品'}</div>
                          {item.productSn ? <div className="member-order__shop-sku">货号：{item.productSn}</div> : null}
                        </div>
                      </Link>
                      <div className="comment-card__rank">
                        <Stars rank={item.commentRank} />
                        {Number(item.commentRank || 0) > 0 ? <span>{Number(item.commentRank)} 分</span> : null}
                      </div>
                    </div>
                    <div className="comment-card__body">
                      {(item.commentTag || []).length ? (
                        <div className="comment-list__tags">
                          {(item.commentTag || []).map((tag) => <span key={tag}>{tag}</span>)}
                        </div>
                      ) : null}
                      {item.skuData?.length ? (
                        <div className="comment-list__sku">
                          {item.skuData.map((sku, skuIndex) => <span key={skuIndex}>{sku.name}：{sku.value}</span>)}
                        </div>
                      ) : null}
                      {item.content ? <div className="comment-list__content">{item.content}</div> : null}
                      {(item.showPics || []).length ? (
                        <div className="comment-list__pics">
                          {(item.showPics || []).map((pic, picIndex) => (
                            <img key={picIndex} src={pic.picUrl || pic.picThumb || ''} alt="" />
                          ))}
                        </div>
                      ) : null}
                      {(item.replies || []).length ? (
                        <div className="comment-list__replies">
                          {(item.replies || []).map((reply, replyIndex) => (
                            <div key={reply.commentId || replyIndex} className="comment-list__reply">
                              <b>{reply.kefuName || item.kefuName || '商家'}回复：</b>
                              <span>{reply.content}</span>
                              {reply.addTime ? <small>{reply.addTime}</small> : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="member-orders__empty">
              <p className="member-orders__empty-title">暂无已评价记录</p>
              <p className="member-orders__empty-sub">
                现在就去：<Link href="/">选购商品</Link>
              </p>
            </div>
          )}
        </div>

        {commentEnabled !== 0 && !loading ? renderPagination() : null}
      </div>
    </div>
  );
}
