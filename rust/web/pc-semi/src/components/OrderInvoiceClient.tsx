'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

interface InvoiceOrder {
  orderId?: number;
  orderSn?: string;
  addTime?: string;
  totalAmount?: number | string;
  shippingFee?: number | string;
  items?: Array<{ productId?: number; productName?: string; picThumb?: string; quantity?: number }>;
  invoiceData?: { id?: number; status?: number; statusName?: string; applyReply?: string };
}

export default function OrderInvoiceClient() {
  const [rows, setRows] = useState<InvoiceOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const size = 10;

  const load = () => {
    setLoading(true);
    apiGet<{ records?: InvoiceOrder[]; total?: number }>('order/order/list', { page, size, orderStatus: 5 })
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

  const removeInvoice = async (invoiceId?: number) => {
    if (!invoiceId || !window.confirm('确认删除这张发票申请吗？')) return;
    try {
      await apiPost('user/orderInvoice/del', { id: invoiceId });
      Toast.success({ content: '已删除' });
      load();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '删除失败' });
    }
  };

  const pages = Math.max(1, Math.ceil(total / size));

  return (
    <Card className="member-card" loading={loading}>
      {rows.length ? (
        <div className="invoice-order-list">
          {rows.map((order) => {
            const invoice = order.invoiceData;
            const status = Number(invoice?.status);
            return (
              <article className="invoice-order" key={order.orderId}>
                <header>
                  <span>订单号：{order.orderSn || '-'}</span>
                  <span>下单时间：{order.addTime || '-'}</span>
                  <span>状态：{invoice ? invoice.statusName || '已申请' : '可申请'}</span>
                </header>
                <div className="invoice-order__body">
                  <div className="invoice-order__products">
                    {(order.items || []).slice(0, 4).map((product, index) => (
                      <div className="invoice-product" key={index}>
                        <img src={product.picThumb || ''} alt={product.productName || ''} />
                        <span>{product.productName || '商品'}</span>
                        <small>x{product.quantity || 1}</small>
                      </div>
                    ))}
                  </div>
                  <div className="invoice-order__meta">
                    <b>总金额 ¥ {Number(order.totalAmount || 0).toFixed(2)}</b>
                    {Number(order.shippingFee || 0) > 0 ? <small>运费 ¥ {Number(order.shippingFee).toFixed(2)}</small> : null}
                    {invoice ? (
                      <span className={status === 1 ? 'is-success' : status === 2 ? 'is-error' : 'is-pending'}>
                        {invoice.statusName || (status === 0 ? '待审核' : status === 1 ? '通过' : '失败/作废')}
                      </span>
                    ) : <span className="is-none">未申请</span>}
                  </div>
                  <div className="invoice-order__actions">
                    <Link href={`/member/order/detail?id=${order.orderId || ''}`}>查看</Link>
                    {invoice ? (
                      status === 2 ? (
                        <Link href={`/member/orderInvoice/info?orderId=${order.orderId || ''}`} className="is-primary">重新申请</Link>
                      ) : (
                        <button type="button" onClick={() => void removeInvoice(invoice.id)}>删除发票</button>
                      )
                    ) : (
                      <Link href={`/member/orderInvoice/info?orderId=${order.orderId || ''}`} className="is-primary">申请发票</Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
          {pages > 1 ? (
            <div className="comment-pagination">
              <button type="button" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>上一页</button>
              <span>{page} / {pages}</span>
              <button type="button" disabled={page >= pages} onClick={() => setPage((n) => n + 1)}>下一页</button>
            </div>
          ) : null}
        </div>
      ) : <div className="comment-empty">还没有可申请订单</div>}
    </Card>
  );
}
