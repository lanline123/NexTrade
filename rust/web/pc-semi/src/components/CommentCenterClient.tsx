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
 * 注意：Rust 端 `GET /api/user/order/list` 当前仅支持 orderStatus（MyOrderQuery），
 * commentStatus 参数会被忽略 —— 属后端缺口，前端保留旧版入参，报告中登记。
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Toast } from '@douyinfe/semi-ui';
import { apiGet } from '@/lib/client-api';

type TabKey = 'pending' | 'showed' | 'commented';

interface OrderItem {
  productId?: number;
  productName?: string;
  picThumb?: string;
  quantity?: number;
}

interface OrderRow {
  orderId?: number;
  orderSn?: string;
  addTime?: string;
  consignee?: string;
  totalAmount?: number | string;
  items?: OrderItem[];
}

interface CommentRow {
  commentId?: number;
  productId?: number;
  productName?: string;
  picThumb?: string;
  commentRank?: number;
  content?: string;
  addTime?: string;
  status?: number;
  statusText?: string;
}

interface SubNum {
  awaitComment?: number;
  showPics?: number;
  commented?: number;
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'pending', label: '待评价' },
  { key: 'showed', label: '待晒单' },
  { key: 'commented', label: '已评价' },
];

function money(value: unknown): string {
  return Number(value || 0).toFixed(2);
}

export default function CommentCenterClient() {
  const [tab, setTab] = useState<TabKey>('pending');
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [subNum, setSubNum] = useState<SubNum>({});
  const size = 10;

  const loadSubNum = () => {
    apiGet<SubNum>('user/comment/subNum')
      .then((result) => setSubNum(result || {}))
      .catch(() => setSubNum({}));
  };

  useEffect(() => {
    loadSubNum();
  }, []);

  useEffect(() => {
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
  }, [tab, page]);

  const pages = Math.max(1, Math.ceil(total / size));

  return (
    <Card className="member-card comment-center" loading={loading}>
      <div className="comment-tabs">
        {TABS.map((item) => {
          const count = item.key === 'pending' ? subNum.awaitComment : item.key === 'showed' ? subNum.showPics : subNum.commented;
          return (
            <button
              key={item.key}
              type="button"
              className={tab === item.key ? 'is-active' : ''}
              onClick={() => {
                setTab(item.key);
                setPage(1);
              }}
            >
              {item.label}
              {Number(count || 0) > 0 ? <span className="comment-tabs__count">{count}</span> : null}
            </button>
          );
        })}
      </div>

      {tab !== 'commented' ? (
        orders.length ? (
          <div className="comment-orders">
            {orders.map((item, index) => (
              <article className="comment-order" key={item.orderId || index}>
                <header>
                  <span>订单号：{item.orderSn || '-'}</span>
                  <span>下单时间：{item.addTime || '-'}</span>
                </header>
                <div className="comment-order__body">
                  <div className="comment-order__products">
                    {(item.items || []).slice(0, 4).map((product, productIndex) => (
                      <div className="comment-product" key={productIndex}>
                        <img src={product.picThumb || ''} alt={product.productName || ''} />
                        <div>
                          <p>{product.productName || '商品'}</p>
                          <small>x{product.quantity || 1}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="comment-order__meta">
                    <span>收货人：{item.consignee || '-'}</span>
                    <span>订单总额：¥{money(item.totalAmount)}</span>
                  </div>
                  <div className="comment-order__action">
                    <Link href={`/member/comment/info?orderId=${item.orderId || ''}`} className="is-primary">
                      {tab === 'pending' ? '去评价' : '待晒单'}
                    </Link>
                    <Link href={`/member/order/detail?id=${item.orderId || ''}`}>订单详情</Link>
                  </div>
                </div>
              </article>
            ))}
            {pages > 1 ? (
              <div className="comment-pagination">
                <button type="button" disabled={page <= 1} onClick={() => setPage((n) => Math.max(1, n - 1))}>上一页</button>
                <span>{page} / {pages}</span>
                <button type="button" disabled={page >= pages} onClick={() => setPage((n) => Math.min(pages, n + 1))}>下一页</button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="comment-empty">{tab === 'pending' ? '暂无待评价订单' : '暂无待晒单订单'}</div>
        )
      ) : (
        comments.length ? (
          <div className="comment-list">
            {comments.map((item, index) => (
              <article className="comment-list__item" key={item.commentId || index}>
                <div className="comment-list__product">
                  <img src={item.picThumb || ''} alt={item.productName || ''} />
                  <Link href={item.productId ? `/product/${item.productId}` : '/search'}>{item.productName || '商品'}</Link>
                </div>
                <div className="comment-list__rank">评分：{item.commentRank ?? '-'}</div>
                <div className="comment-list__content">{item.content || ''}</div>
                <div className="comment-list__foot">
                  <span>{item.addTime || ''}</span>
                  {item.statusText ? <span>{item.statusText}</span> : null}
                </div>
              </article>
            ))}
            {pages > 1 ? (
              <div className="comment-pagination">
                <button type="button" disabled={page <= 1} onClick={() => setPage((n) => Math.max(1, n - 1))}>上一页</button>
                <span>{page} / {pages}</span>
                <button type="button" disabled={page >= pages} onClick={() => setPage((n) => Math.min(pages, n + 1))}>下一页</button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="comment-empty">暂无已评价记录</div>
        )
      )}
    </Card>
  );
}
