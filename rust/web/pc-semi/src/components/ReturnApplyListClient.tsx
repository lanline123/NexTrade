'use client';

/**
 * 可申请售后订单列表（源码 java.../view/pc/pages/member/return/List.vue）。
 *
 * 注意：这个页面与 /member/aftersales（已申请售后记录）不是同一件事。
 * 原版字段：订单编号 / 订单商品 / 发货时间，商品行按 aftersaleFlag 判断
 * 「申请」（跳 /member/return/Info?orderId=&itemId=）或「详情」（跳 /member/return/loginfo?id=）。
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
interface AfterSalesItemRow {
  itemId?: number;
  productId?: number;
  productName?: string;
  productPicThumb?: string;
  picThumb?: string;
  aftersaleFlag?: number;
  toAftersalses?: boolean;
  aftersalesItem?: { aftersaleId?: number } | null;
}

interface AfterSalesOrderRow {
  orderId?: number;
  orderSn?: string;
  shippingTime?: string;
  items?: AfterSalesItemRow[];
}

interface ListResult {
  records?: AfterSalesOrderRow[];
  total?: number;
}

export default function ReturnApplyListClient() {
    const { t } = useTranslation();
  const [rows, setRows] = useState<AfterSalesOrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const size = 10;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGet<ListResult>('user/aftersales/list', { page, size });
      setRows(Array.isArray(data?.records) ? data.records : []);
      setTotal(Number(data?.total || 0));
    } catch (reason) {
      setRows([]);
      setTotal(0);
      setError(reason instanceof Error ? reason.message : '售后列表加载失败');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / size));

  return (
    <div className="return-apply">
      <div className="title-or-tabs">
        <div className="tag-and-input">
          <div className="tig-tabs"><h2>{t('售后申请')}</h2></div>
        </div>
      </div>

      {loading ? <div className="comment-empty">{t('加载中…')}</div> : null}
      {error ? <div className="comment-empty">{error}</div> : null}

      {!loading && !error && rows.length ? (
        <>
          <table className="return-apply-table custom-table">
            <thead className="table-header">
              <tr>
                <th className="header-cell header-cell-first" style={{ width: 200 }}>{t('订单编号')}</th>
                <th className="header-cell">{t('订单商品')}</th>
                <th className="header-cell" style={{ width: 140 }}>{t('发货时间')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.orderId || row.orderSn || index}`}>
                  <td>{row.orderSn || '-'}</td>
                  <td>
                    <div className="product-list">
                      {(row.items || []).map((item, itemIndex) => (
                        <div className="return-apply-product" key={`${item.itemId || itemIndex}`}>
                          <img src={item.productPicThumb || item.picThumb || ''} alt={item.productName || ''} />
                          <span>{item.productName || '-'}</span>
                          {Number(item.aftersaleFlag) === 1 && item.toAftersalses ? (
                            <Link className="return-apply-btn is-primary" href={`/member/return/info?orderId=${row.orderId || ''}&itemId=${item.itemId || ''}`}>{t('申请')}</Link>
                          ) : Number(item.aftersaleFlag) !== 1 && item.aftersalesItem?.aftersaleId ? (
                            <Link className="return-apply-btn" href={`/member/return/loginfo?id=${item.aftersalesItem.aftersaleId}`}>{t('详情')}</Link>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td>{row.shippingTime || t('未发货')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <nav className="pc-pagination">
            {page > 1 ? <button type="button" onClick={() => setPage(page - 1)}>{t('上一页')}</button> : <span className="is-disabled">{t('上一页')}</span>}
            <span>{page} / {pages}</span>
            {page < pages ? <button type="button" onClick={() => setPage(page + 1)}>{t('下一页')}</button> : <span className="is-disabled">{t('下一页')}</span>}
          </nav>
        </>
      ) : null}

      {!loading && !rows.length ? (
        <div className="no-result">
          <div className="empty-img" />
          <div className="empty-text">{t('暂无可申请退换货订单')}</div>
          <Link href="/member/aftersales">{t('查看已申请的售后记录')}</Link>
        </div>
      ) : null}
    </div>
  );
}
