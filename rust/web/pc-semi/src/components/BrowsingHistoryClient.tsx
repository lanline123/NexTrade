'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
interface HistoryProduct {
  productId: number;
  productName?: string;
  picThumb?: string;
  productPrice?: string | number;
  price?: string | number;
}

export default function BrowsingHistoryClient() {
    const { t } = useTranslation();
  const [rows, setRows] = useState<HistoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  // 旧版 List.vue：足迹支持分页浏览
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const size = 30;

  const load = (nextPage = page) => {
    setLoading(true);
    apiGet<{ records?: HistoryProduct[]; total?: number } | HistoryProduct[]>('user/user/historyProduct', { page: nextPage, size })
      .then((result) => {
        if (Array.isArray(result)) {
          setRows(result);
          setTotal(result.length);
        } else {
          setRows(result?.records || []);
          setTotal(Number(result?.total || 0));
        }
        setPage(nextPage);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : '';
        setNeedLogin(message.includes('登录') || message.includes('401'));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = async (productId: number) => {
    try {
      await apiPost('user/user/delHistoryProduct', { ids: [productId] });
      Toast.success({ content: '已删除足迹' });
      load();
    } catch {
      Toast.error({ content: '删除失败' });
    }
  };

  const pages = Math.max(1, Math.ceil(total / size));

  if (needLogin) {
    return (
      <Card className="cart-state">
        <h2>{t('登录后查看浏览历史')}</h2>
        <Link href="/login?redirect=/member/browsingHistory"><button className="pc-login-native__submit">{t('去登录')}</button></Link>
      </Card>
    );
  }

  return (
    <div className="member-history">
      {loading ? (
        <Card className="member-card">{t('浏览历史加载中...')}</Card>
      ) : rows.length ? (
        <div className="member-history__grid">
          {rows.map((item) => (
            <Card key={item.productId} className="member-history__card">
              <Link href={`/product/${item.productId}`}>
                <img src={item.picThumb || ''} alt={item.productName || ''} />
                <div className="member-history__name">{item.productName}</div>
              </Link>
              <div className="member-history__foot">
                <b>¥ {Number(item.price || item.productPrice || 0).toFixed(2)}</b>
                <button type="button" onClick={() => void remove(item.productId)}>{t('删除')}</button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="member-card">{t('您还没有留下任何足迹')}</Card>
      )}
      {pages > 1 ? (
        <div className="member-history__pager">
          <button type="button" disabled={page <= 1} onClick={() => load(page - 1)}>{t('上一页')}</button>
          {Array.from({ length: pages }, (_, index) => index + 1).map((item) => (
            <button key={item} type="button" className={item === page ? 'is-active' : ''} onClick={() => load(item)}>
              {item}
            </button>
          ))}
          <button type="button" disabled={page >= pages} onClick={() => load(page + 1)}>{t('下一页')}</button>
        </div>
      ) : null}
    </div>
  );
}
