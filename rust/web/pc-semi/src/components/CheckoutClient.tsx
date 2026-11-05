'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Checkbox, InputNumber, Radio, RadioGroup, Toast } from '@douyinfe/semi-ui';
import { IconHome } from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '@/lib/client-api';

/**
 * 确认订单（源码对照 java-b2b2c-overseas-v5.8.61/view/pc/pages/order/check.vue）
 *
 * 对齐点：
 * - 结算数据：POST order/check/index（flowType + formState）；支付方式 order/check/getAvailablePaymentType
 * - 提交参数与 Java formState 一致：addressId / shippingType / payTypeId / usePoint / useBalance /
 *   useCredit / useCouponIds / selectUserCouponIds / buyerNote / invoiceData
 * - 合计行：商品金额、运费、优惠、优惠券、积分、余额、税费、应付金额
 * - 优惠券选择（enableCoupons）、买家留言、积分/余额抵扣
 * - returnType=2 直接跳订单列表，否则跳支付页（旧版 onSubmit）
 */

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
  productPrice?: string | number;
  quantity?: number;
  skuData?: Array<{ name?: string; value?: string }>;
  shopTitle?: string;
}

interface PaymentType {
  typeId: number;
  typeName?: string;
  name?: string;
  disabled?: boolean;
  isShow?: boolean;
}

interface CouponItem {
  couponId?: number;
  userCouponId?: number;
  couponName?: string;
  couponType?: number;
  couponDesc?: string;
  couponMoney?: string;
  couponDiscount?: string;
  minOrderAmount?: string;
  shopId?: number;
  endDate?: string;
}

interface CheckoutData {
  item?: Record<string, any>;
  cartList?: Array<{ shopId?: number; shopTitle?: string; carts?: CheckoutItem[]; noShipping?: number }>;
  total?: Record<string, any>;
  couponList?: { enableCoupons?: CouponItem[]; disableCoupons?: CouponItem[] };
  flowType?: number;
  availablePoints?: number;
  useCouponIds?: number[] | null;
  selectUserCouponIds?: number[] | null;
}

interface ShippingTypeOption {
  shippingTypeId?: number;
  typeId?: number;
  shippingTypeName?: string;
  typeName?: string;
}

function money(value: unknown): string {
  return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CheckoutClient({ cartIds, flowType = 1 }: { cartIds: number[]; flowType?: number }) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState(0);
  const [data, setData] = useState<CheckoutData | null>(null);
  const [payments, setPayments] = useState<PaymentType[]>([]);
  const [payTypeId, setPayTypeId] = useState(0);
  const [shippingType, setShippingType] = useState<Record<string, unknown>>({});
  const [shippingData, setShippingData] = useState<Record<string, ShippingTypeOption[]>>({});
  const [couponIds, setCouponIds] = useState<number[]>([]);
  const [userCouponIds, setUserCouponIds] = useState<number[]>([]);
  const [usePoint, setUsePoint] = useState(0);
  const [useBalance, setUseBalance] = useState(0);
  const [buyerNote, setBuyerNote] = useState('');
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
        const [addressResult, checkResult, paymentResult, shippingResult] = await Promise.all([
          apiGet<{ records?: Address[] }>('user/address/list', { page: 1, size: 99 }),
          apiPost<CheckoutData>('order/check/index', { flowType }),
          apiGet<PaymentType[]>('order/check/getAvailablePaymentType', { flowType }).catch(() => []),
          // 旧版 getShippingType：GET order/check/getStoreShippingType?flowType= 返回 { shopId: 选项[] }
          apiGet<Record<string, ShippingTypeOption[]>>('order/check/getStoreShippingType', { flowType }).catch(() => ({})),
        ]);
        if (cancelled) return;
        const addressList = addressResult.records || [];
        setAddresses(addressList);
        setAddressId(Number(checkResult.item?.addressId || addressList.find((item) => item.isSelected)?.addressId || addressList[0]?.addressId || 0));
        setData(checkResult);
        setShippingType((checkResult.item?.shippingType as Record<string, unknown>) || {});
        setShippingData((shippingResult || {}) as Record<string, ShippingTypeOption[]>);
        setCouponIds(Array.isArray(checkResult.useCouponIds) ? checkResult.useCouponIds.map(Number) : []);
        setUserCouponIds(Array.isArray(checkResult.selectUserCouponIds) ? checkResult.selectUserCouponIds.map(Number) : []);
        const paymentList = (Array.isArray(paymentResult) ? paymentResult : []).filter((item) => item?.isShow !== false && !item?.disabled);
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
  }, [flowType]);

  const items = useMemo(
    () => (data?.cartList || []).flatMap((group) => group.carts || []).filter((item) => !cartIds.length || cartIds.includes(item.cartId)),
    [data, cartIds],
  );
  const total = data?.total || {};
  const amount = Number(total.unpaidAmount ?? total.paidAmount ?? total.discountAfter ?? total.productAmount ?? 0);
  const selectedAddress = addresses.find((item) => item.addressId === addressId);
  const coupons = data?.couponList?.enableCoupons || [];
  const availablePoints = Number(data?.availablePoints || total.exchangePoints || 0);
  const availableBalance = Number(total.balance || 0);

  const toggleCoupon = (item: CouponItem) => {
    const couponId = Number(item.couponId || 0);
    const userCouponId = Number(item.userCouponId || 0);
    if (!couponId || !userCouponId) return;
    const checked = userCouponIds.includes(userCouponId);
    setCouponIds((prev) => (checked ? prev.filter((id) => id !== couponId) : [...prev, couponId]));
    setUserCouponIds((prev) => (checked ? prev.filter((id) => id !== userCouponId) : [...prev, userCouponId]));
  };

  const submit = async () => {
    if (!addressId) {
      Toast.warning({ content: '请先选择收货地址' });
      return;
    }
    setSubmitting(true);
    try {
      // 旧版 onSubmit 提交的 body 就是 formState（不含 flowType/cartIds，服务端结算态由 check/index 建立）
      const result = await apiPost<{ orderId?: number; returnType?: number; grouponPromotionRecordId?: number }>('order/check/submit', {
        addressId,
        shippingType,
        payTypeId,
        usePoint,
        useBalance,
        useCredit: 0,
        useCouponIds: couponIds,
        selectUserCouponIds: userCouponIds,
        buyerNote,
        invoiceData: {},
      });
      if (Number(result?.returnType) === 2) {
        Toast.success({ content: '订单提交成功' });
        window.location.replace('/member/order/list');
        return;
      }
      if (result?.orderId) {
        Toast.success({ content: '订单提交成功' });
        window.location.replace(`/order/pay?id=${result.orderId}`);
      } else {
        Toast.success({ content: '订单提交成功' });
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
                <p>暂无收货地址，<Link href="/member/address">去添加地址</Link>。</p>
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
              <div className="pc-checkout__item-main">
                <span>{item.productName}</span>
                {item.skuData?.length ? (
                  <small>{item.skuData.map((sku) => `${sku.name || ''}：${sku.value || ''}`).join(' / ')}</small>
                ) : null}
              </div>
              <span>× {item.quantity}</span>
              <b>¥ {money(item.price ?? item.productPrice)}</b>
            </div>
          ))}
          {!items.length ? <p>没有可结算商品，请返回购物车重新选择。</p> : null}
        </div>

        {(data?.cartList || []).map((group) => {
          const options =
            shippingData[String(group.shopId)] ||
            ((data?.item?.storeShippingType as Record<string, ShippingTypeOption[]>) || {})[String(group.shopId)] ||
            [];
          if (!options.length) return null;
          const selected = (shippingType as Record<string, { typeId?: number }>)[String(group.shopId)];
          return (
            <div key={`shipping-${group.shopId}`} className="pc-checkout__shipping">
              <span>{group.shopTitle || '配送方式'}：</span>
              {options.map((option) => {
                const typeId = Number(option.shippingTypeId || option.typeId || 0);
                const active = Number(selected?.typeId || 0) === typeId;
                return (
                  <Button
                    key={typeId}
                    size="small"
                    theme={active ? 'solid' : 'light'}
                    type={active ? 'primary' : 'tertiary'}
                    onClick={() =>
                      setShippingType((prev) => ({
                        ...prev,
                        [String(group.shopId)]: { typeId, shopId: group.shopId, typeName: option.shippingTypeName || option.typeName || '' },
                      }))
                    }
                  >
                    {option.shippingTypeName || option.typeName || `配送 ${typeId}`}
                  </Button>
                );
              })}
            </div>
          );
        })}
      </Card>

      {coupons.length ? (
        <Card className="pc-checkout__card" title="优惠券">
          <div className="pc-checkout__coupons">
            {coupons.map((coupon) => {
              const userCouponId = Number(coupon.userCouponId || 0);
              return (
                <Checkbox
                  key={userCouponId}
                  checked={userCouponIds.includes(userCouponId)}
                  onChange={() => toggleCoupon(coupon)}
                >
                  {coupon.couponName || '优惠券'}
                  {coupon.couponDesc ? `（${coupon.couponDesc}）` : ''}
                  {Number(coupon.couponMoney || 0) > 0 ? ` -¥${money(coupon.couponMoney)}` : ''}
                </Checkbox>
              );
            })}
          </div>
        </Card>
      ) : null}

      <Card className="pc-checkout__card" title="抵扣">
        {availablePoints > 0 ? (
          <div className="pc-checkout__deduct">
            <span>积分（可用 {availablePoints}）</span>
            <InputNumber
              min={0}
              max={availablePoints}
              value={usePoint}
              onChange={(value) => setUsePoint(Math.max(0, Math.min(availablePoints, Number(value) || 0)))}
            />
          </div>
        ) : null}
        {availableBalance > 0 ? (
          <div className="pc-checkout__deduct">
            <span>余额（可用 ¥{money(availableBalance)}）</span>
            <InputNumber
              min={0}
              max={availableBalance}
              value={useBalance}
              onChange={(value) => setUseBalance(Math.max(0, Math.min(availableBalance, Number(value) || 0)))}
            />
          </div>
        ) : null}
        {availablePoints <= 0 && availableBalance <= 0 ? <p>暂无可用积分或余额抵扣</p> : null}
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

      <Card className="pc-checkout__card" title="订单备注">
        <textarea
          className="pc-checkout__note"
          rows={3}
          value={buyerNote}
          placeholder="选填：给商家留言"
          onChange={(event) => setBuyerNote(event.target.value)}
        />
      </Card>

      <Card className="pc-checkout__card" title="费用明细">
        <div className="pc-checkout__fees">
          <div><span>商品金额</span><b>¥ {money(total.productAmount)}</b></div>
          {Number(total.shippingFee || 0) > 0 ? <div><span>运费</span><b>¥ {money(total.shippingFee)}</b></div> : null}
          {Number(total.serviceFee || 0) > 0 ? <div><span>服务费</span><b>¥ {money(total.serviceFee)}</b></div> : null}
          {Number(total.discounts || 0) > 0 ? <div><span>优惠</span><b>-¥ {money(total.discounts)}</b></div> : null}
          {Number(total.couponAmount || 0) > 0 ? <div><span>优惠券</span><b>-¥ {money(total.couponAmount)}</b></div> : null}
          {Number(total.pointsAmount || 0) > 0 ? <div><span>积分抵扣</span><b>-¥ {money(total.pointsAmount)}</b></div> : null}
          {Number(total.taxRate || 0) > 0 ? <div><span>税费</span><b>¥ {money(total.taxRateAmount)}</b></div> : null}
          <div className="pc-checkout__fees-total"><span>应付金额</span><b>¥ {money(amount)}</b></div>
        </div>
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
