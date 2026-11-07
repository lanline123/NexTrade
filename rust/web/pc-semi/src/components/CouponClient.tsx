'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Input, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
interface Coupon {
  id: number;
  couponName?: string;
  couponMoney?: number | string;
  couponDiscount?: number | string;
  couponDesc?: string;
  couponType?: number;
  statusName?: string;
  status?: number;
  startDate?: string;
  endDate?: string;
  minOrderAmount?: number | string;
}

export default function CouponClient() {
    const { t } = useTranslation();
  const [rows, setRows] = useState<Coupon[]>([]);
  const [couponSn, setCouponSn] = useState('');
  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);

  const load = () => {
    setLoading(true);
    apiGet<{ records?: Coupon[] }>('user/coupon/list', { page: 1, size: 20 })
      .then((result) => setRows(result.records || []))
      .catch((error) => {
        const message = error instanceof Error ? error.message : '';
        setNeedLogin(message.includes('登录') || message.includes('401'));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const claim = async () => {
    if (!couponSn.trim()) {
      Toast.warning({ content: '请输入优惠券码' });
      return;
    }
    try {
      await apiPost('user/coupon/claim', { couponSn: couponSn.trim() });
      Toast.success({ content: '领取成功' });
      setCouponSn('');
      load();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '领取失败' });
    }
  };

  const couponState = (coupon: Coupon): string => {
    const name = coupon.statusName || '';
    if (name.includes('过期')) return 'expired';
    if (name.includes('已使用') || name.includes('使用')) return 'used';
    if (name.includes('未')) return 'unused';
    if (coupon.status === 2) return 'used';
    if (coupon.status === 3) return 'expired';
    return 'unused';
  };

  const visibleRows = rows.filter((coupon) => tab === 'all' || couponState(coupon) === tab);

  const remove = async (id: number) => {
    try {
      await apiPost('user/coupon/del', { id });
      Toast.success({ content: '删除成功' });
      load();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '删除失败' });
    }
  };

  if (needLogin) {
    return (
      <Card className="cart-state">
        <h2>{t('登录后查看优惠券')}</h2>
        <Link href="/login?redirect=/member/coupon">
          <Button theme="solid" type="primary" size="large">{t('去登录')}</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="member-coupon">
      <div className="member-coupon__toolbar">
        <div className="member-coupon__claim">
          <Input value={couponSn} onChange={setCouponSn} placeholder={t('输入优惠券码')} />
          <Button theme="solid" type="primary" onClick={claim}>{t('兑换')}</Button>
        </div>
        <Link href="/coupon/list">{t('领取更多优惠券 →')}</Link>
      </div>

      <div className="member-coupon__tabs">
        {[
          { key: 'all', label: '全部' },
          { key: 'unused', label: '未使用' },
          { key: 'used', label: '已使用' },
          { key: 'expired', label: '已过期' },
        ].map((item) => (
          <button key={item.key} type="button" className={tab === item.key ? 'is-active' : ''} onClick={() => setTab(item.key)}>
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="member-card">{t('优惠券加载中...')}</Card>
      ) : visibleRows.length ? (
        <div className="member-coupon__list">
          {visibleRows.map((coupon) => (
            <Card key={coupon.id} className={`member-coupon__card ${coupon.status === 3 ? 'is-invalid' : ''}`}>
              <div className="member-coupon__value">
                {coupon.couponType === 2 ? (
                  <b>{Number(coupon.couponDiscount || 0)}<small>{t('折')}</small></b>
                ) : (
                  <b><small>¥</small>{Number(coupon.couponMoney || 0).toFixed(0)}</b>
                )}
                <span>满 {Number(coupon.minOrderAmount || 0).toFixed(0)} 可用</span>
              </div>
              <div className="member-coupon__info">
                <b>{coupon.couponName || t('优惠券')}</b>
                <span>{coupon.couponDesc || t('全场通用')}</span>
                <span>{coupon.startDate} ~ {coupon.endDate}</span>
              </div>
              <div className="member-coupon__status">
                <span>{coupon.statusName || t('未使用')}</span>
                <Button theme="borderless" type="danger" size="small" onClick={() => void remove(coupon.id)}>{t('删除')}</Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="member-card">{t('您还没有优惠券')}</Card>
      )}
    </div>
  );
}
