'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card } from '@douyinfe/semi-ui';
import { apiGet } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
interface Item {
  productName?: string;
  picThumb?: string;
  productSn?: string;
  quantity?: number;
}

interface Record {
  aftersaleId: number;
  aftersalesSn?: string;
  aftersalesTypeName?: string;
  statusName?: string;
  status?: number;
  addTime?: string;
  refundAmount?: string;
  orderSn?: string;
  orderId?: number;
  items?: Item[];
  aftersalesItems?: Item[];
}

export default function AfterSalesListClient() {
    const { t } = useTranslation();
  const [rows, setRows] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);

  useEffect(() => {
    apiGet<{ records?: Record[] }>('user/aftersales/getRecord', { page: 1, size: 20 })
      .then((result) => setRows(result.records || []))
      .catch((error) => {
        const message = error instanceof Error ? error.message : '';
        setNeedLogin(message.includes('登录') || message.includes('401'));
      })
      .finally(() => setLoading(false));
  }, []);

  if (needLogin) {
    return (
      <Card className="cart-state">
        <h2>{t('登录后查看售后')}</h2>
        <Link href="/login?redirect=/member/aftersales"><Button theme="solid" type="primary" size="large">{t('去登录')}</Button></Link>
      </Card>
    );
  }

  return (
    <div className="member-aftersales">
      {loading ? (
        <Card className="member-card">{t('售后记录加载中...')}</Card>
      ) : rows.length ? (
        <div className="member-aftersales__list">
          {rows.map((record) => (
            <Card key={record.aftersaleId} className="member-aftersales__card">
              <div className="member-aftersales__head">
                <b>{record.aftersalesTypeName || t('售后申请')}</b>
                <span>{record.statusName || t('处理中')}</span>
                <span>{record.addTime}</span>
              </div>
              <div className="member-aftersales__meta">
                <span>售后单号：{record.aftersalesSn || '-'}</span>
                <span>订单号：{record.orderSn || '-'}</span>
                <span>退款金额：¥ {Number(record.refundAmount || 0).toFixed(2)}</span>
              </div>
              <div className="member-aftersales__items">
                {(record.aftersalesItems || record.items || []).map((item, index) => (
                  <div key={index} className="member-aftersales__item">
                    <img src={item.picThumb || ''} alt={item.productName || ''} />
                    <span>{item.productName}</span>
                    <span>× {item.quantity}</span>
                  </div>
                ))}
              </div>
              <div className="member-aftersales__actions">
                <Link href={`/member/aftersales/detail?id=${record.aftersaleId}`}>
                  <Button size="small" theme="borderless" type="primary">{t('查看详情')}</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="member-card">{t('暂无已申请退换货订单')}</Card>
      )}
    </div>
  );
}
