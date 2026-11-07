'use client';

/**
 * 优惠券详情（已领取券）
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/coupon/index.vue
 * 接口：GET /api/user/coupon/detail?id=  （旧版 getMyCouponInfo）
 * 展示：券名/描述、满减金额或折扣、有效期、已领取状态
 */
import { useEffect, useState } from 'react';
import { Button, Card, Toast } from '@douyinfe/semi-ui';
import Link from 'next/link';

import { useTranslation } from 'react-i18next';
interface CouponDetail {
  couponName?: string;
  couponDesc?: string;
  couponType?: number;
  couponMoney?: number | string;
  couponDiscount?: number | string;
  useStartDate?: string;
  useEndDate?: string;
  useCondition?: string;
  shopName?: string;
  [key: string]: unknown;
}

export default function CouponDetailClient({ couponId }: { couponId: string }) {
    const { t } = useTranslation();
  const [data, setData] = useState<CouponDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');

  useEffect(() => {
    if (!couponId) {
      setLoading(false);
      setFailed('缺少优惠券 ID');
      return;
    }
    const token = localStorage.getItem('accessToken');
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    fetch(`/api/user/coupon/detail?id=${encodeURIComponent(couponId)}`, { headers, credentials: 'include' })
      .then((response) => response.json())
      .then((json) => {
        if (json?.code !== undefined && json.code !== 0) {
          setFailed(String(json?.msg || json?.message || t('优惠券加载失败')));
          return;
        }
        setData(json?.data || null);
      })
      .catch((error) => setFailed(String(error?.message || t('网络异常'))))
      .finally(() => setLoading(false));
  }, [couponId]);

  if (loading) return <Card className="pc-coupon-detail">{t('加载中...')}</Card>;

  if (failed) {
    return (
      <Card className="pc-coupon-detail">
        <p style={{ color: '#d4380d' }}>{failed}</p>
        <Link href="/coupon"><Button>{t('返回集券中心')}</Button></Link>
      </Card>
    );
  }

  if (!data) return <div className="comment-empty">{t('优惠券不存在')}</div>;

  const isDiscount = Number(data.couponType) !== 1;

  return (
    <Card className="pc-coupon-detail">
      <div className="pc-coupon-detail__head">
        <div className="pc-coupon-detail__name">
          <h3>{data.couponName || t('优惠券')}</h3>
          {data.couponDesc ? <p>{data.couponDesc}</p> : null}
          {data.shopName ? <p className="pc-coupon-detail__shop">{data.shopName}</p> : null}
        </div>
        <div className="pc-coupon-detail__money">
          {isDiscount ? (
            <span className="pc-coupon-detail__discount">{data.couponDiscount}{t('折')}</span>
          ) : (
            <span className="pc-coupon-detail__amount">¥{Number(data.couponMoney || 0).toFixed(2)}</span>
          )}
        </div>
      </div>
      <div className="pc-coupon-detail__time">
        {data.useStartDate || ''} 至 {data.useEndDate || ''}
      </div>
      {data.useCondition ? <div className="pc-coupon-detail__cond">{String(data.useCondition)}</div> : null}
      <div className="pc-coupon-detail__result">
        <Button theme="solid" type="primary" disabled>{t('已领取')}</Button>
        <Button onClick={() => Toast.info(t('可在「我的优惠券」中查看使用'))}>{t('使用说明')}</Button>
      </div>
    </Card>
  );
}
