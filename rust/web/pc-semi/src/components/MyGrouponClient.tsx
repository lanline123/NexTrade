'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Toast } from '@douyinfe/semi-ui';
import { apiGet } from '@/lib/client-api';

interface GrouponRecord {
  grouponPromotionRecordId?: number;
  recordId?: number;
  productId?: number;
  productName?: string;
  picThumb?: string;
  grouponPrice?: string | number;
  minGroupNum?: number;
  joinNumCount?: number;
  grouponStatusText?: string;
  statusText?: string;
  [key: string]: unknown;
}

export default function MyGrouponClient() {
  const [rows, setRows] = useState<GrouponRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const size = 10;

  useEffect(() => {
    setLoading(true);
    apiGet<{ records?: GrouponRecord[]; total?: number }>('promotion/groupon/record/list', { page, size })
      .then((result) => {
        setRows(Array.isArray(result?.records) ? result.records : []);
        setTotal(Number(result?.total || 0));
      })
      .catch((error) => {
        setRows([]);
        Toast.error({ content: error instanceof Error ? error.message : '拼团列表加载失败' });
      })
      .finally(() => setLoading(false));
  }, [page]);

  const pages = Math.max(1, Math.ceil(total / size));

  return (
    <Card className="member-card" loading={loading}>
      {rows.length ? (
        <div className="groupon-list">
          {rows.map((item, index) => {
            const recordId = item.grouponPromotionRecordId || item.recordId || 0;
            const remain = Math.max(0, Number(item.minGroupNum || 0) - Number(item.joinNumCount || 0));
            return (
              <article className="groupon-card" key={`${recordId}-${index}`}>
                <Link href={`/product/${item.productId || ''}`} className="groupon-card__pic">
                  <img src={item.picThumb || ''} alt={item.productName || ''} />
                </Link>
                <div className="groupon-card__body">
                  <Link href={`/product/${item.productId || ''}`} className="groupon-card__name">{item.productName || '拼团商品'}</Link>
                  <div className="groupon-card__price">拼团价：¥ {Number(item.grouponPrice || 0).toFixed(2)}</div>
                  <div className="groupon-card__meta">
                    <span>{item.grouponStatusText || item.statusText || '拼团中'}</span>
                    <span>{remain > 0 ? `还差 ${remain} 人成团` : '已成团'}</span>
                  </div>
                  <div className="groupon-card__actions">
                    <Link href={`/joining/groupByInvited?id=${recordId}`}>邀请好友</Link>
                    <Link href={`/member/group/info?id=${recordId}`}>查看拼团</Link>
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
      ) : <div className="comment-empty">暂无拼团记录</div>}
    </Card>
  );
}
