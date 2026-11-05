'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Toast } from '@douyinfe/semi-ui';
import { apiGet } from '@/lib/client-api';

type TabKey = 'pending' | 'commented';
interface OrderRow {
  orderId?: number;
  orderSn?: string;
  addTime?: string;
  totalAmount?: number | string;
  items?: Array<{ productId?: number; productName?: string; picThumb?: string; quantity?: number }>;
  [key: string]: unknown;
}

export default function CommentCenterClient() {
  const [tab, setTab] = useState<TabKey>('pending');
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const size = 10;

  useEffect(() => {
    setLoading(true);
    const path = tab === 'pending' ? 'order/order/list' : 'user/comment/list';
    const params = tab === 'pending' ? { page, size, commentStatus: 0 } : { page, size };
    apiGet<{ records?: OrderRow[]; total?: number }>(path, params)
      .then((result) => {
        setRows(Array.isArray(result?.records) ? result.records : []);
        setTotal(Number(result?.total || 0));
      })
      .catch((error) => {
        setRows([]);
        Toast.error({ content: error instanceof Error ? error.message : '评价列表加载失败' });
      })
      .finally(() => setLoading(false));
  }, [tab, page]);

  const pages = Math.max(1, Math.ceil(total / size));

  return (
    <Card className="member-card comment-center" loading={loading}>
      <div className="comment-tabs">
        <button type="button" className={tab === 'pending' ? 'is-active' : ''} onClick={() => { setTab('pending'); setPage(1); }}>待评价</button>
        <button type="button" className={tab === 'commented' ? 'is-active' : ''} onClick={() => { setTab('commented'); setPage(1); }}>已评价</button>
      </div>
      {rows.length ? (
        <div className="comment-orders">
          {rows.map((item, index) => (
            <article className="comment-order" key={item.orderId || index}>
              <header>
                <span>订单号：{item.orderSn || '-'}</span>
                <span>{item.addTime || ''}</span>
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
                <div className="comment-order__action">
                  {tab === 'pending' ? (
                    <Link href={`/member/comment/info?orderId=${item.orderId || ''}`} className="is-primary">去评价</Link>
                  ) : (
                    <Link href={`/member/comment/info?orderId=${item.orderId || ''}`}>查看评价</Link>
                  )}
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
        <div className="comment-empty">{tab === 'pending' ? '暂无待评价订单' : '暂无已评价记录'}</div>
      )}
    </Card>
  );
}
