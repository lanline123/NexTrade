'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Radio, RadioGroup, Toast } from '@douyinfe/semi-ui';
import { IconHome } from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '@/lib/client-api';

interface Address {
  addressId: number;
  consignee?: string;
  mobile?: string;
  regionName?: string;
  address?: string;
  fullAddress?: string;
  isSelected?: number;
}

interface CheckoutItem {
  cartId: number;
  productName?: string;
  picThumb?: string;
  price?: string | number;
  quantity?: number;
  shopTitle?: string;
}

interface PaymentType {
  typeId: number;
  typeName?: string;
  name?: string;
}

interface CheckoutData {
  item?: Record<string, any>;
  cartList?: Array<{ shopId?: number; shopTitle?: string; carts?: CheckoutItem[] }>;
  total?: Record<string, any>;
  flowType?: number;
}

function money(value: unknown): string {
  return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CheckoutClient({ cartIds }: { cartIds: number[] }) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState(0);
  const [data, setData] = useState<CheckoutData | null>(null);
  const [payments, setPayments] = useState<PaymentType[]>([]);
  const [payTypeId, setPayTypeId] = useState(0);
  const [shippingType, setShippingType] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (typeof window !== 'undefined' && !localStorage.getItem('accessToken')) {
      setLoading(false);
      window.location.replace(`/login?redirect=${encodeURIComponent('/order/check')}`);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const [addressResult, checkResult, paymentResult] = await Promise.all([
          apiGet<{ records?: Address[] }>('user/address/list', { page: 1, size: 99 }),
          apiPost<CheckoutData>('order/check/index', { flowType: 1 }),
          apiGet<PaymentType[]>('order/check/getAvailablePaymentType').catch(() => []),
        ]);
        if (cancelled) return;
        const addressList = addressResult.records || [];
        setAddresses(addressList);
        setAddressId(Number(checkResult.item?.addressId || addressList.find((item) => item.isSelected)?.addressId || addressList[0]?.addressId || 0));
        setData(checkResult);
        setShippingType((checkResult.item?.shippingType as Record<string, unknown>) || {});
        const paymentList = Array.isArray(paymentResult) ? paymentResult : [];
        setPayments(paymentList);
        setPayTypeId(Number(checkResult.item?.payTypeId || paymentList[0]?.typeId || 0));
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        setNeedLogin(message.includes('登录') || message.includes('401'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(
    () => (data?.cartList || []).flatMap((group) => group.carts || []).filter((item) => !cartIds.length || cartIds.includes(item.cartId)),
    [data, cartIds],
  );
  const amount = Number(data?.total?.unpaidAmount ?? data?.total?.actualPayAmount ?? data?.total?.productAmount ?? 0);
  const selectedAddress = addresses.find((item) => item.addressId === addressId);

  const submit = async () => {
    if (!addressId) {
      Toast.warning({ content: '请先选择收货地址' });
      return;
    }
    setSubmitting(true);
    try {
      const result = await apiPost<{ orderId?: number; returnType?: number }>('order/check/submit', {
        addressId,
        shippingType,
        payTypeId,
        usePoint: 0,
        useBalance: 0,
        useCredit: 0,
        useCouponIds: [],
        selectUserCouponIds: [],
        buyerNote: '',
        invoiceData: {},
      });
      Toast.success({ content: '订单提交成功' });
      if (result?.orderId && Number(result.returnType) !== 2) {
        window.location.replace(`/order/pay?id=${result.orderId}`);
      } else {
        window.location.replace('/member/order/list');
      }
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '订单提交失败' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Card className="cart-state">结算数据加载中...</Card>;

  if (needLogin) {
    return (
      <Card className="cart-state">
        <h2>登录后结算</h2>
        <p>请先登录账号，再确认收货地址和支付方式。</p>
        <Link href="/login?redirect=/cart">
          <Button theme="solid" type="primary" size="large">
            去登录
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="pc-checkout">
      <Card className="pc-checkout__card" title="收货信息">
        <div className="pc-checkout__address">
          <div className="pc-checkout__address-main">
            <IconHome />
            {selectedAddress ? (
              <div>
                <b>
                  {selectedAddress.consignee} {selectedAddress.mobile}
                </b>
                <p>{selectedAddress.fullAddress || `${selectedAddress.regionName || ''} ${selectedAddress.address || ''}`}</p>
              </div>
            ) : (
              <div>
                <b>请选择收货地址</b>
                <p>暂无收货地址，请先在会员中心添加。</p>
              </div>
            )}
          </div>
          {addresses.length > 1 ? (
            <select
              className="pc-checkout__address-select"
              value={addressId}
              onChange={(event) => setAddressId(Number(event.target.value))}
            >
              {addresses.map((address) => (
                <option key={address.addressId} value={address.addressId}>
                  {address.consignee} {address.mobile} {address.regionName || ''}
                  {address.address || ''}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </Card>

      <Card className="pc-checkout__card" title="商品清单">
        <div className="pc-checkout__items">
          {items.map((item) => (
            <div key={item.cartId} className="pc-checkout__item">
              <img src={item.picThumb || ''} alt={item.productName || ''} />
              <span>{item.productName}</span>
              <span>× {item.quantity}</span>
              <b>¥ {money(item.price)}</b>
            </div>
          ))}
          {!items.length ? <p>没有可结算商品，请返回购物车重新选择。</p> : null}
        </div>
      </Card>

      <Card className="pc-checkout__card" title="支付方式">
        {payments.length ? (
          <RadioGroup value={payTypeId} onChange={(value) => setPayTypeId(Number(value))}>
            {payments.map((payment) => (
              <Radio key={payment.typeId} value={payment.typeId}>
                {payment.typeName || payment.name || `支付方式 ${payment.typeId}`}
              </Radio>
            ))}
          </RadioGroup>
        ) : (
          <p>暂无可用支付方式</p>
        )}
      </Card>

      <div className="pc-checkout__footer">
        <Link href="/cart">返回购物车</Link>
        <div>
          <span>
            应付金额：<b>¥ {money(amount)}</b>
          </span>
          <Button theme="solid" type="primary" size="large" loading={submitting} disabled={!items.length || !addressId || !payTypeId} onClick={submit}>
            提交订单
          </Button>
        </div>
      </div>
    </div>
  );
}
