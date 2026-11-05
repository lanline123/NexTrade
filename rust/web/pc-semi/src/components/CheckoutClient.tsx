'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Checkbox, InputNumber, Modal, Radio, RadioGroup, Toast } from '@douyinfe/semi-ui';
import { IconHome } from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '@/lib/client-api';

/**
 * 确认订单（源码对照 java-b2b2c-overseas-v5.8.61/view/pc/pages/order/check.vue
 * + components/invoice/InvoiceDialog.vue）
 *
 * 对齐点：
 * - 结算数据：POST order/check/index（flowType + formState）；
 *   支付方式 order/check/getAvailablePaymentType；配送方式 order/check/getStoreShippingType
 * - 提交参数：addressId / shippingType / payTypeId / usePoint / useBalance / useCredit /
 *   useCouponIds / selectUserCouponIds / buyerNote / invoiceData（旧版 formState）
 * - 发票：user/invoice/getStatus 资格查询 + InvoiceDialog 表单（个人/企业/专票）
 * - 优惠券：勾选 + 自动选券（POST order/check/updateCoupon，useDefaultCouponIds）
 * - 账期支付（creditPaymentInfo.canUseCredit，与余额互斥）
 * - 礼品卡 flowType=12、预售（productPresale/定金）、O2O 配送/自提信息
 * - 地址入口：管理地址 + 刷新地址
 */

interface Address {
  addressId: number;
  consignee?: string;
  mobile?: string;
  email?: string;
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

interface CreditPaymentInfo {
  creditPaymentStatus?: number;
  canUseCredit?: boolean;
  disableReason?: string | null;
  creditLimit?: number;
  usedAmount?: number;
  availableAmount?: number;
  settlementType?: number;
  settlementTypeText?: string;
  settlementDays?: number;
  remainingDays?: number;
}

interface ShippingTypeOption {
  shippingTypeId?: number;
  typeId?: number;
  shippingTypeName?: string;
  typeName?: string;
}

interface InvoiceData {
  invoiceType?: number;
  titleType?: number;
  invoiceContent?: string;
  companyName?: string;
  companyCode?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyBank?: string;
  companyAccount?: string;
  email?: string;
  mobile?: string;
}

interface DeliveryOption {
  deliveryType?: number;
  deliveryTypeName?: string;
  storeName?: string;
  storeAddress?: string;
  [key: string]: unknown;
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
  creditPaymentInfo?: CreditPaymentInfo | null;
  productPresale?: Record<string, any> | null;
  deliveryOption?: DeliveryOption | null;
}

const EMPTY_INVOICE: InvoiceData = {
  invoiceType: 0,
  titleType: 1,
  invoiceContent: '商品明细',
  companyName: '',
  companyCode: '',
  companyAddress: '',
  companyPhone: '',
  companyBank: '',
  companyAccount: '',
};

function money(value: unknown): string {
  return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fieldValue(row: Record<string, any> | null | undefined, keys: string[]): string {
  if (!row) return '';
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== '') return String(value);
  }
  return '';
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
  const [useCredit, setUseCredit] = useState(0);
  const [buyerNote, setBuyerNote] = useState('');
  const [autoCoupon, setAutoCoupon] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData>(EMPTY_INVOICE);
  const [invoiceQualified, setInvoiceQualified] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState<InvoiceData>(EMPTY_INVOICE);
  const [couponBusy, setCouponBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);

  const loadAddresses = async (preferredId?: number) => {
    const result = await apiGet<{ records?: Address[] }>('user/address/list', { page: 1, size: 99 }).catch(() => ({ records: [] }));
    const list = result.records || [];
    setAddresses(list);
    setAddressId(preferredId || addressId || Number(list.find((item) => item.isSelected)?.addressId || list[0]?.addressId || 0));
  };

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
        const [addressResult, checkResult, paymentResult, shippingResult, invoiceStatus] = await Promise.all([
          apiGet<{ records?: Address[] }>('user/address/list', { page: 1, size: 99 }),
          apiPost<CheckoutData>('order/check/index', { flowType }),
          apiGet<PaymentType[]>('order/check/getAvailablePaymentType', { flowType }).catch(() => []),
          apiGet<Record<string, ShippingTypeOption[]>>('order/check/getStoreShippingType', { flowType }).catch(() => ({})),
          // 旧版 commonStore.canInvoice + InvoiceDialog getInvoiceStatus（增值税专票资质）
          apiGet<{ item?: boolean }>('user/invoice/getStatus').catch(() => ({ item: false })),
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
        // 后端 getStatus 返回 data: 0/1（旧版接口类型写成 { item: boolean }）
        setInvoiceQualified(Boolean(((invoiceStatus as any)?.item ?? (invoiceStatus as any)) === true || Number((invoiceStatus as any)?.item ?? (invoiceStatus as any)) === 1));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const creditInfo = data?.creditPaymentInfo || null;
  const canUseCredit = Boolean(creditInfo?.canUseCredit) && flowType === 1;
  const giftCardMode = flowType === 12;
  const presale = data?.productPresale || null;
  const deliveryOption = data?.deliveryOption || null;
  const selfPickup = Number(deliveryOption?.deliveryType || 0) === 2;
  // O2O：deliveryType=2 门店自提 / flowType=9 预约到店；普通快递（1/3）不显示该卡片
  const showDeliveryOption = Boolean(deliveryOption) && (selfPickup || flowType === 9 || Number(deliveryOption?.deliveryType || 0) === 4);
  const needAddress = !selfPickup;

  const buildFormState = (overrides: Record<string, unknown> = {}) => ({
    addressId,
    shippingType,
    payTypeId,
    usePoint,
    useBalance,
    useCredit,
    useCouponIds: couponIds,
    selectUserCouponIds: userCouponIds,
    buyerNote,
    invoiceData: giftCardMode ? {} : invoiceData,
    ...overrides,
  });

  /** 旧版 updateCouponData：重新计算优惠券（自动选券 useDefaultCouponIds=1）。 */
  const recalcCoupon = async (useDefault: boolean) => {
    if (couponBusy) return;
    setCouponBusy(true);
    try {
      const result = await apiPost<CheckoutData>('order/check/updateCoupon', buildFormState({ useDefaultCouponIds: useDefault ? 1 : 0 }));
      if (!result) return;
      setData(result);
      setCouponIds(Array.isArray(result.useCouponIds) ? result.useCouponIds.map(Number) : []);
      setUserCouponIds(Array.isArray(result.selectUserCouponIds) ? result.selectUserCouponIds.map(Number) : []);
      setAutoCoupon(useDefault);
      if (useDefault) Toast.success({ content: '已自动选择最优优惠券' });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '优惠券计算失败' });
    } finally {
      setCouponBusy(false);
    }
  };

  const toggleCoupon = (item: CouponItem) => {
    const couponId = Number(item.couponId || 0);
    const userCouponId = Number(item.userCouponId || 0);
    if (!couponId || !userCouponId) return;
    const checked = userCouponIds.includes(userCouponId);
    setCouponIds((prev) => (checked ? prev.filter((id) => id !== couponId) : [...prev, couponId]));
    setUserCouponIds((prev) => (checked ? prev.filter((id) => id !== userCouponId) : [...prev, userCouponId]));
    setAutoCoupon(false);
  };

  /** 账期支付与余额抵扣互斥（旧版 onUseBalance / 账期勾选）。 */
  const changeCredit = (checked: boolean) => {
    setUseCredit(checked ? 1 : 0);
    if (checked) setUseBalance(0);
  };

  const changeBalance = (value: number) => {
    const next = Math.max(0, Math.min(availableBalance, Number(value) || 0));
    setUseBalance(next);
    if (next > 0) setUseCredit(0);
  };

  const openInvoice = async () => {
    if (giftCardMode) return;
    const base: InvoiceData = { ...EMPTY_INVOICE, ...invoiceData };
    if (!base.email && selectedAddress?.email) base.email = selectedAddress.email;
    if (!base.mobile && selectedAddress?.mobile) base.mobile = selectedAddress.mobile;
    if (Number(base.titleType) === 1 && !base.companyName && selectedAddress?.consignee) {
      base.companyName = selectedAddress.consignee;
    }
    setInvoiceForm(base);
    setInvoiceOpen(true);
    // 旧版 fetcCheckInvoice：回填最近一次普通发票抬头（接口无数据时忽略）
    try {
      const last = await apiGet<Record<string, any> | null>('order/check/getInvoice', {
        invoiceType: Number(base.invoiceType) || 1,
        titleType: Number(base.titleType) || 1,
      });
      const row = last && typeof last === 'object' ? ((last as any).item ?? last) : null;
      if (row && typeof row === 'object') {
        setInvoiceForm((prev) => ({
          ...prev,
          companyName: String(row.companyName || prev.companyName || ''),
          companyCode: String(row.companyCode || prev.companyCode || ''),
          companyAddress: String(row.companyAddress || prev.companyAddress || ''),
          companyPhone: String(row.companyPhone || prev.companyPhone || ''),
          companyBank: String(row.companyBank || prev.companyBank || ''),
          companyAccount: String(row.companyAccount || prev.companyAccount || ''),
          email: String(row.email || prev.email || ''),
          invoiceContent: String(row.invoiceContent || prev.invoiceContent || ''),
        }));
      }
    } catch {
      /* 预填失败不阻断开票 */
    }
  };

  const confirmInvoice = () => {
    const next = { ...invoiceForm };
    if (Number(next.invoiceType) === 0) {
      setInvoiceData({ ...EMPTY_INVOICE, invoiceType: 0 });
      setInvoiceOpen(false);
      return;
    }
    if (Number(next.invoiceType) === 2 && !invoiceQualified) {
      Toast.error({ content: '增值税专用发票需先通过增票资质审核' });
      return;
    }
    if (!String(next.companyName || '').trim()) {
      Toast.warning({ content: Number(next.titleType) === 1 ? '请输入个人名称' : '请输入企业名称' });
      return;
    }
    if (Number(next.titleType) === 2 && !String(next.companyCode || '').trim()) {
      Toast.warning({ content: '请输入纳税人识别号' });
      return;
    }
    if (Number(next.invoiceType) === 2) {
      const required: Array<[keyof InvoiceData, string]> = [
        ['companyAddress', '请输入单位地址'],
        ['companyPhone', '请输入单位电话'],
        ['companyBank', '请输入开户银行'],
        ['companyAccount', '请输入银行账户'],
      ];
      for (const [key, message] of required) {
        if (!String(next[key] || '').trim()) {
          Toast.warning({ content: message });
          return;
        }
      }
    }
    setInvoiceData(next);
    setInvoiceOpen(false);
    Toast.success({ content: '发票信息已保存' });
  };

  const submit = async () => {
    if (needAddress && !addressId) {
      Toast.warning({ content: '请先选择收货地址' });
      return;
    }
    setSubmitting(true);
    try {
      const result = await apiPost<{ orderId?: number; returnType?: number; grouponPromotionRecordId?: number }>(
        'order/check/submit',
        // 旧版 onSubmit 提交的 body 就是 formState（不含 flowType/cartIds）
        {
          addressId,
          shippingType,
          payTypeId,
          usePoint,
          useBalance,
          useCredit,
          useCouponIds: couponIds,
          selectUserCouponIds: userCouponIds,
          buyerNote,
          invoiceData: giftCardMode ? {} : invoiceData,
        },
      );
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

  const invoiceSummary =
    Number(invoiceData.invoiceType) === 1
      ? '电子普通发票'
      : Number(invoiceData.invoiceType) === 2
        ? '增值税专用发票'
        : '不开发票';

  return (
    <div className="pc-checkout">
      {giftCardMode ? (
        <Card className="pc-checkout__card" title="礼品卡兑换">
          <p>当前为礼品卡兑换下单流程（flowType=12），将优先使用礼品卡抵扣。</p>
          {Number(total.giftCardAmount || 0) > 0 ? <p>礼品卡抵扣：¥ {money(total.giftCardAmount)}</p> : null}
        </Card>
      ) : null}

      {presale ? (
        <Card className="pc-checkout__card" title="预售信息">
          <div className="pc-checkout__fees">
            {Number(total.actualPayDepositAmount || 0) > 0 ? (
              <div><span>应付定金</span><b>¥ {money(total.actualPayDepositAmount)}</b></div>
            ) : null}
            {fieldValue(presale, ['depositAmount', 'presaleDepositAmount']) ? (
              <div><span>定金</span><b>¥ {money(fieldValue(presale, ['depositAmount', 'presaleDepositAmount']))}</b></div>
            ) : null}
            {fieldValue(presale, ['presalePrice', 'presalePriceAmount']) ? (
              <div><span>预售价</span><b>¥ {money(fieldValue(presale, ['presalePrice', 'presalePriceAmount']))}</b></div>
            ) : null}
            {fieldValue(presale, ['tailAmount', 'balanceAmount']) ? (
              <div><span>尾款</span><b>¥ {money(fieldValue(presale, ['tailAmount', 'balanceAmount']))}</b></div>
            ) : null}
            <p className="pc-checkout__tips">预售订单按定金/尾款规则支付，具体时间以商品页说明为准。</p>
          </div>
        </Card>
      ) : null}

      {showDeliveryOption ? (
        <Card className="pc-checkout__card" title="配送方式">
          <p>
            {fieldValue(deliveryOption, ['deliveryTypeName']) || (selfPickup ? '门店自提' : '配送')}
            {fieldValue(deliveryOption, ['storeName', 'pickupName']) ? `：${fieldValue(deliveryOption, ['storeName', 'pickupName'])}` : ''}
          </p>
          {fieldValue(deliveryOption, ['storeAddress', 'pickupAddress', 'address']) ? (
            <p>{fieldValue(deliveryOption, ['storeAddress', 'pickupAddress', 'address'])}</p>
          ) : null}
        </Card>
      ) : null}

      {needAddress ? (
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
            <div className="pc-checkout__address-actions">
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
              {/* 旧版 ModalRegion 地址新增/编辑入口 */}
              <Link href="/member/address">管理地址</Link>
              <Button size="small" theme="borderless" onClick={() => void loadAddresses()}>
                刷新地址
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

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

      {!giftCardMode && coupons.length ? (
        <Card className="pc-checkout__card" title="优惠券">
          <div className="pc-checkout__coupons">
            {coupons.map((coupon) => {
              const userCouponId = Number(coupon.userCouponId || 0);
              return (
                <Checkbox key={userCouponId} checked={userCouponIds.includes(userCouponId)} onChange={() => toggleCoupon(coupon)}>
                  {coupon.couponName || '优惠券'}
                  {coupon.couponDesc ? `（${coupon.couponDesc}）` : ''}
                  {Number(coupon.couponMoney || 0) > 0 ? ` -¥${money(coupon.couponMoney)}` : ''}
                </Checkbox>
              );
            })}
            <Checkbox checked={autoCoupon} onChange={() => void recalcCoupon(!autoCoupon)}>
              自动选择最优优惠券
            </Checkbox>
            <Button size="small" loading={couponBusy} onClick={() => void recalcCoupon(autoCoupon)}>
              重新计算
            </Button>
          </div>
        </Card>
      ) : null}

      {!giftCardMode ? (
        <Card className="pc-checkout__card" title="抵扣">
          {flowType === 1 && availablePoints > 0 ? (
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
              <InputNumber min={0} max={availableBalance} value={useBalance} onChange={(value) => changeBalance(Number(value) || 0)} />
            </div>
          ) : null}
          {availablePoints <= 0 && availableBalance <= 0 ? <p>暂无可用积分或余额抵扣</p> : null}
        </Card>
      ) : null}

      {canUseCredit ? (
        <Card className="pc-checkout__card" title="账期支付">
          <Checkbox checked={useCredit === 1} onChange={(event) => changeCredit(Boolean(event.target.checked))}>
            使用账期支付
          </Checkbox>
          <div className="pc-checkout__credit">
            {creditInfo?.settlementTypeText ? <span>结算方式：{creditInfo.settlementTypeText}</span> : null}
            {Number(creditInfo?.availableAmount || 0) > 0 ? <span>可用额度：¥ {money(creditInfo?.availableAmount)}</span> : null}
            {Number(creditInfo?.settlementDays || 0) > 0 ? <span>账期：{creditInfo?.settlementDays} 天</span> : null}
          </div>
          {useCredit === 1 ? <p className="pc-checkout__tips">账期支付与余额抵扣互斥，本单将使用账期结算。</p> : null}
        </Card>
      ) : null}

      {!giftCardMode ? (
        <Card className="pc-checkout__card" title="发票信息">
          <div className="pc-checkout__invoice">
            <span>{invoiceSummary}</span>
            {invoiceData.companyName ? <span>{invoiceData.companyName}</span> : null}
            <Button size="small" onClick={openInvoice}>
              修改
            </Button>
          </div>
          <p className="pc-checkout__tips">开企业抬头发票须填写纳税人识别号，以免影响报销。</p>
        </Card>
      ) : null}

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
          <div><span>商品总价</span><b>¥ {money(total.productAmount)}</b></div>
          {Number(total.shippingFee || 0) > 0 ? (
            <div className="pc-checkout__fee-row">
              <span>运费</span>
              <b>{Number(total.shippingFee) > 0 ? `¥ ${money(total.shippingFee)}` : '包邮'}</b>
            </div>
          ) : null}
          {Number(total.serviceFee || 0) > 0 ? <div><span>附加费用</span><b>+ ¥ {money(total.serviceFee)}</b></div> : null}
          {Number(total.taxRate || 0) > 0 ? <div><span>税费</span><b>¥ {money(total.taxRateAmount)}</b></div> : null}

          {Number(total.discounts || 0) > 0 ? <div className="pc-checkout__fee-discount"><span>共优惠</span><b>- ¥ {money(total.discounts)}</b></div> : null}
          {Number(total.discountCouponAmount || 0) > 0 ? <div className="pc-checkout__fee-sub"><span>优惠券</span><b>- ¥ {money(total.discountCouponAmount)}</b></div> : null}
          {Number(total.pointsAmount || 0) > 0 ? <div className="pc-checkout__fee-sub"><span>积分减免</span><b>- ¥ {money(total.pointsAmount)}</b></div> : null}
          {Number(total.balanceAmount || 0) > 0 ? <div className="pc-checkout__fee-sub"><span>余额抵扣</span><b>- ¥ {money(total.balanceAmount)}</b></div> : null}
          {Number(total.giftCardAmount || 0) > 0 ? <div className="pc-checkout__fee-sub"><span>礼品卡抵扣</span><b>- ¥ {money(total.giftCardAmount)}</b></div> : null}
          {Number(total.discounts || 0) > 0 || Number(total.pointsAmount || 0) > 0 || Number(total.balanceAmount || 0) > 0 ? (
            <div className="pc-checkout__fee-row pc-checkout__fee-row--total"><span>共抵扣</span><b>- ¥ {money(Number(total.discounts || 0) + Number(total.pointsAmount || 0) + Number(total.balanceAmount || 0))}</b></div>
          ) : null}

          {Number(total.actualPayDepositAmount || 0) > 0 ? <div><span>应付定金</span><b>¥ {money(total.actualPayDepositAmount)}</b></div> : null}
          <div className="pc-checkout__fees-total"><span>{Number(total.actualPayDepositAmount || 0) > 0 ? '仍需支付' : '应付金额'}</span><b>¥ {money(amount)}</b></div>
          <p className="pc-checkout__tips">该订单最多可用 {availablePoints} 积分、余额 ¥ {money(availableBalance)} 抵扣，实际以提交时计算为准。</p>
        </div>
      </Card>

      <div className="pc-checkout__footer">
        <Link href="/cart">返回购物车</Link>
        <div>
          <span>
            应付金额：<b>¥ {money(amount)}</b>
          </span>
          <Button
            theme="solid"
            type="primary"
            size="large"
            loading={submitting}
            disabled={!items.length || (needAddress && !addressId) || !payTypeId}
            onClick={submit}
          >
            提交订单
          </Button>
        </div>
      </div>

      <Modal
        title="发票信息"
        visible={invoiceOpen}
        onCancel={() => setInvoiceOpen(false)}
        onOk={confirmInvoice}
        okText="保存"
        cancelText="取消"
        width={560}
      >
        <div className="pc-invoice-form">
          <div className="pc-invoice-form__row">
            <span>发票类型</span>
            <select
              value={invoiceForm.invoiceType}
              onChange={(event) => setInvoiceForm((prev) => ({ ...prev, invoiceType: Number(event.target.value) }))}
            >
              <option value={0}>不开发票</option>
              <option value={1}>电子普通发票</option>
              <option value={2} disabled={!invoiceQualified}>
                增值税专用发票{invoiceQualified ? '' : '（需资质审核）'}
              </option>
            </select>
          </div>
          {Number(invoiceForm.invoiceType) !== 0 ? (
            <>
              <div className="pc-invoice-form__row">
                <span>抬头类型</span>
                <select
                  value={invoiceForm.titleType}
                  onChange={(event) => setInvoiceForm((prev) => ({ ...prev, titleType: Number(event.target.value) }))}
                >
                  <option value={1}>个人</option>
                  <option value={2}>企业</option>
                </select>
              </div>
              <div className="pc-invoice-form__row">
                <span>{Number(invoiceForm.titleType) === 1 ? '个人名称' : '企业名称'}</span>
                <input
                  value={String(invoiceForm.companyName || '')}
                  onChange={(event) => setInvoiceForm((prev) => ({ ...prev, companyName: event.target.value }))}
                />
              </div>
              {Number(invoiceForm.titleType) === 2 || Number(invoiceForm.invoiceType) === 2 ? (
                <div className="pc-invoice-form__row">
                  <span>纳税人识别号</span>
                  <input
                    value={String(invoiceForm.companyCode || '')}
                    onChange={(event) => setInvoiceForm((prev) => ({ ...prev, companyCode: event.target.value }))}
                  />
                </div>
              ) : null}
              {Number(invoiceForm.invoiceType) === 2 ? (
                <>
                  <div className="pc-invoice-form__row">
                    <span>单位地址</span>
                    <input value={String(invoiceForm.companyAddress || '')} onChange={(event) => setInvoiceForm((prev) => ({ ...prev, companyAddress: event.target.value }))} />
                  </div>
                  <div className="pc-invoice-form__row">
                    <span>单位电话</span>
                    <input value={String(invoiceForm.companyPhone || '')} onChange={(event) => setInvoiceForm((prev) => ({ ...prev, companyPhone: event.target.value }))} />
                  </div>
                  <div className="pc-invoice-form__row">
                    <span>开户银行</span>
                    <input value={String(invoiceForm.companyBank || '')} onChange={(event) => setInvoiceForm((prev) => ({ ...prev, companyBank: event.target.value }))} />
                  </div>
                  <div className="pc-invoice-form__row">
                    <span>银行账户</span>
                    <input value={String(invoiceForm.companyAccount || '')} onChange={(event) => setInvoiceForm((prev) => ({ ...prev, companyAccount: event.target.value }))} />
                  </div>
                </>
              ) : null}
              <div className="pc-invoice-form__row">
                <span>收票人邮箱</span>
                <input
                  value={String(invoiceForm.email || '')}
                  placeholder="选填，用于接收电子发票"
                  onChange={(event) => setInvoiceForm((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>
              <div className="pc-invoice-form__row">
                <span>发票内容</span>
                <input value={String(invoiceForm.invoiceContent || '')} onChange={(event) => setInvoiceForm((prev) => ({ ...prev, invoiceContent: event.target.value }))} />
              </div>
            </>
          ) : null}
          {!invoiceQualified ? <p className="pc-checkout__tips">增值税专用发票需先在会员中心完成增票资质审核。</p> : null}
        </div>
      </Modal>
    </div>
  );
}
