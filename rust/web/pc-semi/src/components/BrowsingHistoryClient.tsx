'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

interface HistoryProduct {
  productId: number;
  productName?: string;
  picThumb?: string;
  productPrice?: string | number;
  price?: string | number;
}

export default function BrowsingHistoryClient() {
  const [rows, setRows] = useState<HistoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);

  const load = () => {
    apiGet<HistoryProduct[]>('user/user/historyProduct', { page: 1, size: 30 })
      .then((result) => setRows(Array.isArray(result) ? result : []))
      .catch((error) => {
        const message = error instanceof Error ? error.message : '';
        setNeedLogin(message.includes('登录') || message.includes('401'));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
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

  if (needLogin) {
    return (
      <Card className="cart-state">
        <h2>登录后查看浏览历史</h2>
        <Link href="/login?redirect=/member/browsingHistory"><button className="pc-login-native__submit">去登录</button></Link>
      </Card>
    );
  }

  return (
    <div className="member-history">
      {loading ? (
        <Card className="member-card">浏览历史加载中...</Card>
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
                <button type="button" onClick={() => void remove(item.productId)}>删除</button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="member-card">您还没有留下任何足迹</Card>
      )}
    </div>
  );
}
