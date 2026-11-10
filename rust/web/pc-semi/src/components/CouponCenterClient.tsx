'use client';

/**
 * 集券中心（对照旧版 `view/pc/pages/coupon/List.vue` 迁移）。
 *
 * - 取数：`user/coupon/getList`，固定 `isShow=1`，支持路由 `?shopId=` 指定店铺（默认 -1 全部）；
 * - 券类型：1 满减券（couponMoney）、其它为折扣券（couponDiscount 折）；
 * - 有效期文案：
 *   - `sendType === 1`：`useStartDate 至 useEndDate`；
 *   - `sendType === 0 && delayDay > 0`：领券 delayDay 天后生效，有效期 useDay 天；
 *   - `sendType === 0 && delayDay === 0`：领券当日起 useDay 天内可用；
 * - 领取状态（旧版 couponStatus）：`limitNum===0` 时 isReceive===1→已领取、receiveNum>0→再次领取、否则马上领；
 *   `limitNum>0` 时 isReceive===0→马上领、receiveNum>=limitNum→已领取、否则再次领取；
 * - 点击整卡领取，已领取时提示「您已超出领取上限」。
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button, Card, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { currencySymbol, formatAmount } from '@/lib/currency';
interface Coupon {
  couponId: number;
  couponName?: string;
  couponMoney?: number | string;
  couponDiscount?: number | string;
  couponType?: number;
  couponDesc?: string;
  sendType?: number;
  useStartDate?: string;
  useEndDate?: string;
  delayDay?: number;
  useDay?: number;
  limitNum?: number;
  receiveNum?: number;
  isReceive?: number;
  shopId?: number;
}


function couponStatus(coupon: Coupon): '已领取' | '马上领' | '再次领取' {
  const isReceive = Number(coupon.isReceive || 0);
  const limitNum = Number(coupon.limitNum || 0);
  const receiveNum = Number(coupon.receiveNum || 0);
  if (limitNum === 0) {
    if (isReceive === 1) return '已领取';
    if (receiveNum > 0) return '再次领取';
    return '马上领';
  }
  if (isReceive === 0) return '马上领';
  if (receiveNum >= limitNum) return '已领取';
  return '再次领取';
}

function validityText(coupon: Coupon): string {
  if (Number(coupon.sendType) === 1) {
    return i18n.t('{a} 至 {b}', { a: coupon.useStartDate || '', b: coupon.useEndDate || '' }) as string;
  }
  const delayDay = Number(coupon.delayDay || 0);
  const useDay = Number(coupon.useDay || 0);
  if (delayDay > 0) return i18n.t('领券{d}天后生效，有效期{u}天', { d: delayDay, u: useDay }) as string;
  return i18n.t('领券当日起{u}天内可用', { u: useDay }) as string;
}

export default function CouponCenterClient() {
    const { t } = useTranslation();
  const searchParams = useSearchParams();
  const shopIdFromQuery = Number(searchParams?.get('shopId') || 0);
  const [rows, setRows] = useState<Coupon[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState(0);
  const [needLogin, setNeedLogin] = useState(false);

  const load = () => {
    setLoading(true);
    apiGet<{ records?: Coupon[]; total?: number }>('user/coupon/getList', {
      page: 1,
      // 旧版一次拉全量（List.vue filterParams 仅 page:1），放大 size 保证券全部可领
      size: 100,
      isShow: 1,
      shopId: shopIdFromQuery > 0 ? shopIdFromQuery : -1,
    })
      .then((result) => {
        setRows(result?.records || []);
        setTotal(Number(result?.total || 0));
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : '';
        if (message.includes('登录') || message.includes('401')) setNeedLogin(true);
        else Toast.error({ content: message || t('优惠券加载失败') });
        setRows([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopIdFromQuery]);

  const claim = async (coupon: Coupon) => {
    if (couponStatus(coupon) === '已领取') {
      Toast.warning({ content: '您已超出领取上限' });
      return;
    }
    setClaimingId(coupon.couponId);
    try {
      await apiPost('user/coupon/claim', { couponId: coupon.couponId });
      Toast.success({ content: '领取成功' });
      load();
    } catch (error) {
      const message = error instanceof Error ? error.message : '领取失败';
      if (message.includes('登录') || message.includes('401')) setNeedLogin(true);
      else Toast.error({ content: message });
    } finally {
      setClaimingId(0);
    }
  };

  if (needLogin) {
    return (
      <Card className="cart-state">
        <h2>{t('登录后领取优惠券')}</h2>
        <p>{t('登录后可查看并领取集券中心优惠券。')}</p>
        <Link href={`/login?redirect=${encodeURIComponent('/coupon/list')}`}>
          <Button theme="solid" type="primary" size="large">{t('去登录')}</Button>
        </Link>
      </Card>
    );
  }

  if (loading) {
    return <Card className="member-card">{t('优惠券加载中...')}</Card>;
  }

  if (!rows.length) {
    return <Card className="member-card">{t('暂无可领取的优惠券～')}</Card>;
  }

  return (
    <div className="coupon-center">
      <div className="coupon-center__grid">
        {rows.map((coupon) => {
          const status = couponStatus(coupon);
          return (
            <div
              key={coupon.couponId}
              style={{ cursor: status === '已领取' ? 'not-allowed' : 'pointer', opacity: status === '已领取' ? 0.72 : 1 }}
              onClick={() => void claim(coupon)}
            >
              <Card className="coupon-center__card">
              <div className="coupon-center__value">
                {Number(coupon.couponType) === 1 ? (
                  <b>
                    <small>{currencySymbol()}</small>
                    {formatAmount(coupon.couponMoney)}
                  </b>
                ) : (
                  <b>
                    {Number(coupon.couponDiscount || 0)}
                    <small>{t('折')}</small>
                  </b>
                )}
              </div>
              <b>{coupon.couponName ? `【${coupon.couponName}】` : '优惠券'}</b>
              <span>{validityText(coupon)}</span>
              {coupon.couponDesc ? (
                <span style={{ marginTop: -8, display: 'block' }}>{coupon.couponDesc}</span>
              ) : null}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                <span style={{ color: '#98a2b3', fontSize: 12 }}>共 {total} 张可领</span>
                <Button
                  theme={status === '已领取' ? 'borderless' : 'solid'}
                  type="primary"
                  size="small"
                  loading={claimingId === coupon.couponId}
                  disabled={status === '已领取'}
                >
                  {status}
                </Button>
              </div>
              {coupon.shopId ? (
                <span style={{ display: 'block', marginTop: 8, color: '#98a2b3', fontSize: 12 }}>{t('店铺券')}</span>
              ) : null}
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
