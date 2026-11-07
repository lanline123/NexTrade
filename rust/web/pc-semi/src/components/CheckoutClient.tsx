'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Checkbox, InputNumber, Modal, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
/**
 * 确认订单（1:1 对照 java-b2b2c-overseas-v5.8.61/view/pc/pages/order/check.vue）
 *
 * 结构对齐：
 * - 左栏 orderConfirmCon：收货地址 → 支付方式 → 商品（按店铺分组 + 每店配送 + 赠品）
 *   → 预售 → 订单备注 → 优惠券 → 积分 → 余额 → 发票 → 账期
 * - 右栏 money_info（368px sticky）：订单详情、商品总价/附加费用/余额/礼品卡/积分减免/
 *   共优惠/商品总额/优惠券/其他优惠/快递(运费明细)/税费/合计、预计获得积分、仍需支付、下单按钮
 *
 * 逻辑对齐：
 * - POST order/check/index 初始化；order/check/update 在地址/配送/积分/余额/账期变化后重算
 * - order/check/updateCoupon 选券/自动选券；order/check/submit 提交 formState
 * - 余额为勾选（全额抵扣），积分/账期与余额互斥；flowType=3 积分兑换、12 礼品卡
 */

interface Address {
  addressId: number;
  consignee?: string;
  mobile?: string;
  mobileAreaCode?: string;
  email?: string;
  telephone?: string;
  regionName?: string;
  address?: string;
  fullAddress?: string;
  formattedAddress?: string;
  isSelected?: number;
  isInvalid?: number;
}

interface ExtraSku {
  attrName?: string;
  attrValue?: string;
  attrPrice?: string | number;
}

interface ActivityItem {
  type?: number;
  promotionId?: number;
}

interface CheckoutItem {
  cartId: number;
  productId?: number;
  productName?: string;
  picThumb?: string;
  price?: string | number;
  productPrice?: string | number;
  quantity?: number;
  skuData?: Array<{ name?: string; value?: string }>;
  extraSkuData?: ExtraSku[] | null;
  activityInfo?: ActivityItem[] | null;
  shopId?: number;
  shopTitle?: string;
  seckillPrice?: number | string;
}

interface CheckoutGroup {
  shopId?: number;
  shopTitle?: string;
  carts?: CheckoutItem[];
  noShipping?: number;
  gift?: any[] | null;
}

interface PaymentType {
  typeId: number;
  typeName?: string;
  name?: string;
  disabled?: boolean;
  isShow?: boolean;
  icon?: string;
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
  startDate?: string;
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
  cartList?: CheckoutGroup[];
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

/** 旧版 calcDiscountPercent：折扣角标，原价与现价一致时不显示 */
function discountPercent(price: unknown, origin: unknown): number {
  const now = Number(price || 0);
  const old = Number(origin || 0);
  if (!now || !old || now >= old) return 0;
  return Math.round(((old - now) / old) * 100);
}

/** 旧版 activityList：type 1=秒杀价，6=限时折扣 */
function activityList(data: ActivityItem[] | null | undefined): ActivityItem[] {
  if (!Array.isArray(data)) return [];
  return data.filter((item) => Number(item?.type) === 1 || Number(item?.type) === 6);
}

export default function CheckoutClient({ cartIds, flowType = 1 }: { cartIds: number[]; flowType?: number }) {
    const { t } = useTranslation();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState(0);
  const [data, setData] = useState<CheckoutData | null>(null);
  const [payments, setPayments] = useState<PaymentType[]>([]);
  const [payTypeId, setPayTypeId] = useState(0);
  const [shippingType, setShippingType] = useState<Record<string, any>>({});
  const [shippingData, setShippingData] = useState<Record<string, ShippingTypeOption[]>>({});
  const [couponIds, setCouponIds] = useState<number[]>([]);
  const [userCouponIds, setUserCouponIds] = useState<number[]>([]);
  const [usePoint, setUsePoint] = useState(0);
  const [useBalance, setUseBalance] = useState(0);
  const [useCredit, setUseCredit] = useState(0);
  const [buyerNote, setBuyerNote] = useState('');
  const [couponTab, setCouponTab] = useState(0);
  const [invoiceData, setInvoiceData] = useState<InvoiceData>(EMPTY_INVOICE);
  const [invoiceQualified, setInvoiceQualified] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState<InvoiceData>(EMPTY_INVOICE);
  const [addressOpen, setAddressOpen] = useState(false);
  const [couponBusy, setCouponBusy] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);
  /** 账户维度余额/积分（user/user/memberCenter），旧版取 userStore.userInfo.balance/points */
  const [memberCenter, setMemberCenter] = useState<{ balance?: number; points?: number }>({});

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
        const [addressResult, checkResult, paymentResult, shippingResult, invoiceStatus, memberCenter] = await Promise.all([
          apiGet<{ records?: Address[] }>('user/address/list', { page: 1, size: 99 }),
          apiPost<CheckoutData>('order/check/index', { flowType }),
          apiGet<PaymentType[]>('order/check/getAvailablePaymentType', { flowType }).catch(() => []),
          apiGet<Record<string, ShippingTypeOption[]>>('order/check/getStoreShippingType', { flowType }).catch(() => ({})),
          apiGet<{ item?: boolean }>('user/invoice/getStatus').catch(() => ({ item: false })),
          // 账户维度余额/积分（旧版 pages/order/check.vue:226,266 取 userStore.userInfo.balance/points）
          // 注意：total.balance 是「本单余额抵扣额」，不是账户余额，两者不能混用
          apiGet<{ balance?: number; points?: number }>('user/user/memberCenter').catch(() => ({ balance: 0, points: 0 })),
        ]);
        if (cancelled) return;
        const addressList = addressResult.records || [];
        setAddresses(addressList);
        setAddressId(Number(checkResult.item?.addressId || addressList.find((item) => item.isSelected)?.addressId || addressList[0]?.addressId || 0));
        setData(checkResult);
        setMemberCenter({
          balance: Number(memberCenter?.balance ?? 0),
          points: Number(memberCenter?.points ?? 0),
        });
        setShippingType((checkResult.item?.shippingType as Record<string, unknown>) || {});
        setShippingData((shippingResult || {}) as Record<string, ShippingTypeOption[]>);
        setCouponIds(Array.isArray(checkResult.useCouponIds) ? checkResult.useCouponIds.map(Number) : []);
        setUserCouponIds(Array.isArray(checkResult.selectUserCouponIds) ? checkResult.selectUserCouponIds.map(Number) : []);
        setInvoiceQualified(Boolean(((invoiceStatus as any)?.item ?? invoiceStatus) === true || Number((invoiceStatus as any)?.item ?? invoiceStatus) === 1));
        const paymentList = (Array.isArray(paymentResult) ? paymentResult : []).filter((item) => item?.isShow !== false && !item?.disabled);
        setPayments(paymentList);
        setPayTypeId(Number(checkResult.item?.payTypeId || paymentList[0]?.typeId || 0));
        setUsePoint(Number(checkResult.item?.usePoint || 0));
        setUseBalance(Number(checkResult.item?.useBalance || 0));
        setUseCredit(Number(checkResult.item?.useCredit || 0));
        setBuyerNote(String(checkResult.item?.buyerNote || ''));
        if (checkResult.item?.invoiceData && typeof checkResult.item.invoiceData === 'object') {
          setInvoiceData({ ...EMPTY_INVOICE, ...(checkResult.item.invoiceData as InvoiceData) });
        }
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
  const disableCoupons = data?.couponList?.disableCoupons || [];
  // 本单最多可用积分（输入框上限 / 提示文案），语义同旧版 availablePoints
  const availablePoints = Number(data?.availablePoints || total.exchangePoints || 0);
  // 账户维度余额（可抵扣上限）取 user/user/memberCenter 的 balance；
  // total.balance 是「本单余额抵扣额」，二者语义不同，不能互相替代。
  const availableBalance = Number(memberCenter.balance ?? 0);
  // 账户总积分（旧版 pages/order/check.vue:226 显示 userStore.userInfo.points）
  const accountPoints = Number(memberCenter.points ?? 0);
  const creditInfo = data?.creditPaymentInfo || null;
  const canUseCredit = Boolean(creditInfo?.canUseCredit) && flowType === 1;
  const giftCardMode = flowType === 12;
  const presale = data?.productPresale || null;
  const deliveryOption = data?.deliveryOption || null;
  const selfPickup = Number(deliveryOption?.deliveryType || 0) === 2;
  const showDeliveryOption = Boolean(deliveryOption) && (selfPickup || flowType === 9 || Number(deliveryOption?.deliveryType || 0) === 4);
  const needAddress = !selfPickup;
  const isDepositPresale = Number(presale?.saleMode || 0) === 2;
  const payAmount = isDepositPresale ? Number(total.actualPayDepositAmount ?? total.unpaidAmount ?? 0) : Number(total.unpaidAmount ?? 0);
  const orderSendPoint = Number(total.orderSendPoint || 0);
  const needShipping = (data?.cartList || []).some((group) => Number(group.noShipping) === 0);
  const showTaxAmount = Number(total.taxRate || 0) > 0;
  // 旧版 titleText：优惠券/积分/余额任一开启才显示余额区块
  const titleText = !giftCardMode;
  const creditDisabled = Number(creditInfo?.availableAmount || 0) <= 0 && useCredit === 0;

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

  const mergeResult = (result: CheckoutData | null | undefined) => {
    if (!result) return;
    setData(result);
    setCouponIds(Array.isArray(result.useCouponIds) ? result.useCouponIds.map(Number) : []);
    setUserCouponIds(Array.isArray(result.selectUserCouponIds) ? result.selectUserCouponIds.map(Number) : []);
  };

  /** 旧版 updateOrderCheckData：地址/配送/积分/余额/账期变化后重算 */
  const updateCheck = async (overrides: Record<string, unknown> = {}) => {
    if (updating) return;
    setUpdating(true);
    try {
      const result = await apiPost<CheckoutData>('order/check/update', { flowType, ...buildFormState(overrides) });
      mergeResult(result);
      if (result?.item) {
        if (result.item.addressId !== undefined) setAddressId(Number(result.item.addressId));
        if (result.item.shippingType) setShippingType(result.item.shippingType as Record<string, any>);
        if (result.item.usePoint !== undefined) setUsePoint(Number(result.item.usePoint));
        if (result.item.useBalance !== undefined) setUseBalance(Number(result.item.useBalance));
        if (result.item.useCredit !== undefined) setUseCredit(Number(result.item.useCredit));
      }
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '订单金额计算失败' });
    } finally {
      setUpdating(false);
    }
  };

  const onChangeAddress = (id: number) => {
    setAddressId(id);
    setAddressOpen(false);
    void updateCheck({ addressId: id });
  };

  const onChangeShipping = (shopId: number | undefined, option: ShippingTypeOption) => {
    const typeId = Number(option.shippingTypeId || option.typeId || 0);
    const next = {
      ...shippingType,
      [String(shopId)]: { typeId, shopId, typeName: option.shippingTypeName || option.typeName || '' },
    };
    setShippingType(next);
    void updateCheck({ shippingType: next });
  };

  const recalcCoupon = async (useDefault: boolean) => {
    if (couponBusy) return;
    setCouponBusy(true);
    try {
      const result = await apiPost<CheckoutData>('order/check/updateCoupon', buildFormState({ useDefaultCouponIds: useDefault ? 1 : 0 }));
      mergeResult(result);
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
    const nextCouponIds = checked ? couponIds.filter((id) => id !== couponId) : [...couponIds, couponId];
    const nextUserIds = checked ? userCouponIds.filter((id) => id !== userCouponId) : [...userCouponIds, userCouponId];
    setCouponIds(nextCouponIds);
    setUserCouponIds(nextUserIds);
    void recalcCoupon(false);
  };

  /** 旧版 handleCredit：与余额互斥 */
  const changeCredit = (checked: boolean) => {
    if (checked && creditDisabled) return;
    const next = checked ? 1 : 0;
    setUseCredit(next);
    const nextBalance = next === 1 ? 0 : useBalance;
    setUseBalance(nextBalance);
    void updateCheck({ useCredit: next, useBalance: nextBalance });
  };

  /** 旧版 onUseBalance：勾选即用全部余额，与账期互斥 */
  const toggleBalance = (checked: boolean) => {
    const next = checked ? availableBalance : 0;
    setUseBalance(next);
    const nextCredit = next > 0 ? 0 : useCredit;
    setUseCredit(nextCredit);
    void updateCheck({ useBalance: next, useCredit: nextCredit });
  };

  const changePoint = (value: number | string) => {
    let next = Math.floor(Number(value) || 0);
    if (next > availablePoints) next = availablePoints;
    if (next < 0) next = 0;
    setUsePoint(next);
    void updateCheck({ usePoint: next });
  };

  const changeNote = (value: string) => {
    setBuyerNote(value.slice(0, 50));
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
      Toast.warning({ content: Number(next.titleType) === 1 ? t('请输入个人名称') : '请输入企业名称' });
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
    if (!payTypeId) {
      Toast.warning({ content: '请选择支付方式' });
      return;
    }
    if (!shippingType) {
      Toast.warning({ content: '请选择配送方式' });
      return;
    }
    setSubmitting(true);
    try {
      const result = await apiPost<{ orderId?: number; returnType?: number; grouponPromotionRecordId?: number }>(
        'order/check/submit',
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

  if (loading) return <div className="pc-co-state">{t('结算数据加载中...')}</div>;

  if (needLogin) {
    return (
      <div className="pc-co-state">
        <h2>{t('登录后结算')}</h2>
        <p>{t('请先登录账号，再确认收货地址和支付方式。')}</p>
        <Link href="/login?redirect=/cart">
          <Button theme="solid" type="primary" size="large">{t('去登录')}</Button>
        </Link>
      </div>
    );
  }

  const invoiceSummary =
    Number(invoiceData.invoiceType) === 1
      ? t('电子普通发票')
      : Number(invoiceData.invoiceType) === 2
        ? t('增值税专用发票')
        : '不开发票';

  const submitDisabled = !items.length || (needAddress && !addressId) || !payTypeId || !shippingType;

  return (
    <div className="pc-co">
      <div className="pc-co__main">
        {/* 收货地址 */}
        <section className="pc-co-card">
          <div className="pc-co-card__head">
            <h2>{t('收货地址')}</h2>
            <button type="button" className="pc-co-link" onClick={() => setAddressOpen(true)}>{t('更改')}<span className="pc-co-caret">›</span>
            </button>
          </div>
          {selectedAddress ? (
            <div className="pc-co-address">
              <div className="pc-co-address__line">
                <b>{selectedAddress.consignee || '-'}</b>
                <span>
                  {selectedAddress.mobileAreaCode ? `+${selectedAddress.mobileAreaCode} ` : ''}
                  {selectedAddress.mobile || '-'}
                </span>
                {Number(selectedAddress.isInvalid) ? <em className="pc-co-invalid">{t('无效地址')}</em> : null}
              </div>
              <p>{selectedAddress.formattedAddress || selectedAddress.fullAddress || [selectedAddress.regionName, selectedAddress.address].filter(Boolean).join(' ')}</p>
              {selectedAddress.email || selectedAddress.telephone ? (
                <small>
                  {selectedAddress.email || '-'} {selectedAddress.telephone ? ` / ${selectedAddress.telephone}` : ''}
                </small>
              ) : null}
            </div>
          ) : (
            <div className="pc-co-address pc-co-address--empty">{t('暂无收货地址，')}<Link href="/member/address">{t('去添加地址')}</Link>
            </div>
          )}
          {showDeliveryOption ? (
            <p className="pc-co-hint">
              {fieldValue(deliveryOption, ['deliveryTypeName']) || (selfPickup ? t('门店自提') : '配送')}
              {fieldValue(deliveryOption, ['storeName', 'pickupName']) ? `：${fieldValue(deliveryOption, ['storeName', 'pickupName'])}` : ''}
              {fieldValue(deliveryOption, ['storeAddress', 'pickupAddress', 'address']) ? ` · ${fieldValue(deliveryOption, ['storeAddress', 'pickupAddress', 'address'])}` : ''}
            </p>
          ) : null}
        </section>

        {/* 支付方式 */}
        <section className="pc-co-card">
          <div className="pc-co-card__head">
            <h2>{t('支付方式')}</h2>
          </div>
          {payments.length ? (
            <div className="pc-co-pay">
              {payments.map((payment) => (
                <button
                  key={payment.typeId}
                  type="button"
                  className={`pc-co-pay__item${payTypeId === payment.typeId ? ' is-active' : ''}`}
                  onClick={() => setPayTypeId(payment.typeId)}
                >
                  {payment.icon ? <img src={payment.icon} alt="" /> : null}
                  <span>{payment.typeName || payment.name || t('支付方式 {id}', { id: payment.typeId })}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="pc-co-hint">{t('暂无可用支付方式')}</p>
          )}
        </section>

        {/* 商品：按店铺分组 */}
        {(data?.cartList || []).map((group) => {
          const groupOptions =
            shippingData[String(group.shopId)] ||
            ((data?.item?.storeShippingType as Record<string, ShippingTypeOption[]>) || {})[String(group.shopId)] ||
            [];
          const selected = (shippingType as Record<string, { typeId?: number }>)[String(group.shopId)];
          return (
            <section className="pc-co-card" key={`shop-${group.shopId}`}>
              <div className="pc-co-shop">
                <span>{Number(group.shopId) === 0 ? t('自营') : t('商家：{name}', { name: group.shopTitle || '' })}</span>
              </div>

              {Number(group.noShipping) === 1 ? (
                <div className="pc-co-ship">
                  <span className="pc-co-ship__label">{t('配送')}</span>
                  <em className="pc-co-ship__tab is-active">{t('无需配送')}</em>
                </div>
              ) : groupOptions.length ? (
                <div className="pc-co-ship">
                  <span className="pc-co-ship__label">{t('配送')}</span>
                  {groupOptions.map((option, index) => {
                    const typeId = Number(option.shippingTypeId || option.typeId || 0);
                    const active = Number(selected?.typeId || 0) === typeId;
                    return (
                      <button
                        key={`${typeId}-${index}`}
                        type="button"
                        className={`pc-co-ship__tab${active ? ' is-active' : ''}`}
                        onClick={() => onChangeShipping(group.shopId, option)}
                      >
                        {option.shippingTypeName || option.typeName || t('配送 {id}', { id: typeId })}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="pc-co-ship">
                  <span className="pc-co-ship__label">{t('配送')}</span>
                  <em className="pc-co-ship__error">{t('该收货地址不支持配送')}</em>
                </div>
              )}

              <div className="pc-co-goods">
                {(group.carts || []).map((product) => {
                  const percent = discountPercent(product.price, product.productPrice);
                  return (
                    <div className="pc-co-goods__row" key={product.cartId}>
                      <div className="pc-co-goods__main">
                        <img src={product.picThumb || ''} alt={product.productName || ''} />
                        <div className="pc-co-goods__info">
                          <div className="pc-co-goods__name">
                            {percent > 0 ? <em className="pc-co-badge">优惠{percent}%</em> : null}
                            {product.productName}
                          </div>
                          {(product.skuData || []).length ? (
                            <div className="pc-co-goods__sku">
                              {(product.skuData || []).map((sku, index) => (
                                <div key={`${sku.name}-${index}`}>
                                  <span>{sku.name}：</span>
                                  {sku.value}
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {(product.extraSkuData || []).length ? (
                            <div className="pc-co-goods__extra">
                              {(product.extraSkuData || []).map((attr, index) => (
                                <div key={`${attr.attrName}-${index}`}>
                                  <span>{attr.attrName}</span>
                                  <i />
                                  <b>{attr.attrValue}</b>
                                  {Number(attr.attrPrice || 0) !== 0 ? <em>¥{money(attr.attrPrice)}</em> : null}
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {activityList(product.activityInfo).length ? (
                            <div className="pc-co-goods__promo">
                              {activityList(product.activityInfo).map((activity, index) => (
                                <span key={`${activity.promotionId}-${index}`}>
                                  {Number(activity.type) === 1 ? t('秒杀价') : '限时折扣'}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="pc-co-goods__price">¥ {money(product.price)}</div>
                      <div className="pc-co-goods__qty">x{product.quantity || 1}</div>
                    </div>
                  );
                })}
              </div>

              {(group.gift || []).length ? (
                <div className="pc-co-gift">
                  <div className="pc-co-gift__title">{t('赠品')}</div>
                  <div className="pc-co-gift__list">
                    {(group.gift || []).map((gift, index) => (
                      <div className="pc-co-gift__item" key={`${gift.giftId}-${index}`}>
                        <img src={gift.picThumb || gift.image || ''} alt={gift.productName || ''} />
                        <div>
                          <p>{gift.productName}</p>
                          {(gift.skuData || []).length ? <small>{(gift.skuData || []).map((sku: any) => sku.value).join(' / ')}</small> : null}
                          <em>x{gift.num || 1}</em>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}

        {/* 预售 */}
        {presale ? (
          <section className="pc-co-card">
            <div className="pc-co-card__head">
              <h2>{t('预售信息')}</h2>
            </div>
            <div className="pc-co-presale">
              {Number(total.actualPayDepositAmount || 0) > 0 ? (
                <div>
                  <span>{t('应付定金')}</span>
                  <b>¥ {money(total.actualPayDepositAmount)}</b>
                </div>
              ) : null}
              {fieldValue(presale, ['depositAmount', 'presaleDepositAmount']) ? (
                <div>
                  <span>{t('定金')}</span>
                  <b>¥ {money(fieldValue(presale, ['depositAmount', 'presaleDepositAmount']))}</b>
                </div>
              ) : null}
              {fieldValue(presale, ['presalePrice', 'presalePriceAmount']) ? (
                <div>
                  <span>{t('预售价')}</span>
                  <b>¥ {money(fieldValue(presale, ['presalePrice', 'presalePriceAmount']))}</b>
                </div>
              ) : null}
              {fieldValue(presale, ['tailAmount', 'balanceAmount']) ? (
                <div>
                  <span>{t('尾款')}</span>
                  <b>¥ {money(fieldValue(presale, ['tailAmount', 'balanceAmount']))}</b>
                </div>
              ) : null}
            </div>
            <p className="pc-co-hint">预售订单按定金/尾款规则支付，具体时间以商品页说明为准。</p>
          </section>
        ) : null}

        {/* 订单备注 */}
        <section className="pc-co-card">
          <div className="pc-co-card__head">
            <h2>{t('订单备注')}</h2>
          </div>
          <div className="pc-co-note">
            <textarea
              rows={2}
              maxLength={50}
              value={buyerNote}
              placeholder={t('提示：请勿填写有关支付、收货、发票方面的信息')}
              onChange={(event) => changeNote(event.target.value)}
            />
            <span>{buyerNote.length}/50</span>
          </div>
        </section>

        {/* 优惠券（旧版 CouponInfo.vue：可用/不可用切换） */}
        {!giftCardMode && data?.couponList ? (
          <section className="pc-co-card">
            <div className="pc-co-card__head">
              <h2>{t('优惠券')}</h2>
              <div className="pc-co-tabs">
                <button type="button" className={couponTab === 0 ? 'is-active' : ''} onClick={() => setCouponTab(0)}>{t('可用')}<em>{coupons.length}</em>
                </button>
                <button type="button" className={couponTab === 1 ? 'is-active' : ''} onClick={() => setCouponTab(1)}>{t('不可用')}<em>{disableCoupons.length}</em>
                </button>
              </div>
            </div>

            {couponTab === 0 ? (
              coupons.length ? (
                <div className="pc-co-coupon-grid">
                  {coupons.map((coupon) => {
                    const userCouponId = Number(coupon.userCouponId || 0);
                    const active = userCouponIds.includes(userCouponId);
                    return (
                      <label className={`pc-co-coupon${active ? ' is-active' : ''}`} key={userCouponId}>
                        <Checkbox checked={active} onChange={() => toggleCoupon(coupon)} />
                        <div className="pc-co-coupon__amount">
                          {Number(coupon.couponType) === 1 || Number(coupon.couponMoney || 0) > 0 ? (
                            <>
                              <small>¥</small>
                              <b>{money(coupon.couponMoney)}</b>
                            </>
                          ) : (
                            <>
                              <b>{coupon.couponDiscount || '-'}</b>
                              <small>{t('折')}</small>
                            </>
                          )}
                        </div>
                        <div className="pc-co-coupon__main">
                          <b>{coupon.couponName || t('优惠券')}</b>
                          <small className="pc-co-coupon__time">
                            {coupon.startDate ? t('{a} 至 {b}', { a: coupon.startDate, b: coupon.endDate || '' }) : t('{b} 前有效', { b: coupon.endDate || '' })}
                          </small>
                          {coupon.couponDesc ? <em>{coupon.couponDesc}</em> : null}
                        </div>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="pc-co-coupons__empty">{t('没有可用的优惠券')}</div>
              )
            ) : disableCoupons.length ? (
              <div className="pc-co-coupon-grid">
                {disableCoupons.map((coupon, index) => (
                  <div className="pc-co-coupon is-disabled" key={`${coupon.userCouponId}-${index}`}>
                    <Checkbox checked={false} disabled />
                    <div className="pc-co-coupon__amount">
                      {Number(coupon.couponType) === 1 || Number(coupon.couponMoney || 0) > 0 ? (
                        <>
                          <small>¥</small>
                          <b>{money(coupon.couponMoney)}</b>
                        </>
                      ) : (
                        <>
                          <b>{coupon.couponDiscount || '-'}</b>
                          <small>{t('折')}</small>
                        </>
                      )}
                    </div>
                    <div className="pc-co-coupon__main">
                      <b>{coupon.couponName || t('优惠券')}</b>
                      <small className="pc-co-coupon__time">
                        {coupon.startDate ? t('{a} 至 {b}', { a: coupon.startDate, b: coupon.endDate || '' }) : t('{b} 前有效', { b: coupon.endDate || '' })}
                      </small>
                      {coupon.couponDesc ? <em>{coupon.couponDesc}</em> : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="pc-co-coupons__empty">{t('没有不可用的优惠券')}</div>
            )}
          </section>
        ) : null}

        {/* 积分 */}
        {!giftCardMode && flowType === 1 ? (
          <section className="pc-co-card">
            <div className="pc-co-card__head">
              <h2>{t('使用积分')}</h2>
              <span className="pc-co-card__sub">{t('当前账户共')}<b>{accountPoints}</b>{t('积分')}</span>
            </div>
            <div className="pc-co-points">
              <InputNumber
                min={0}
                max={availablePoints}
                value={usePoint}
                disabled={availablePoints <= 0}
                onChange={(value) => setUsePoint(Math.max(0, Math.min(availablePoints, Math.floor(Number(value) || 0))))}
                onBlur={() => void updateCheck({ usePoint })}
              />
              <div className="pc-co-points__tips">
                {Number(total.pointsAmount || 0) > 0 ? <span>共抵扣 ¥ {money(total.pointsAmount)}</span> : null}
                <span>该订单最多可用 {availablePoints} 积分</span>
                <Link href="/article/issue?articleId=7" target="_blank" className="pc-co-link">{t('【如何获得积分?】')}</Link>
              </div>
            </div>
          </section>
        ) : null}

        {/* 余额 */}
        {!giftCardMode && titleText ? (
          <section className="pc-co-card">
            <div className="pc-co-card__head">
              <h2>{t('余额')}</h2>
            </div>
            <div className="pc-co-check">
              <Checkbox checked={useBalance > 0} disabled={availableBalance <= 0} onChange={(event) => toggleBalance(Boolean(event.target.checked))}>{t('使用余额')}</Checkbox>
              <span className="pc-co-card__sub">{t('当前账户余额')}<b>{money(availableBalance)}</b>
              </span>
            </div>
          </section>
        ) : null}

        {/* 发票 */}
        {!giftCardMode ? (
          <section className="pc-co-card">
            <div className="pc-co-card__head">
              <h2>{t('发票信息')}</h2>
              <span className="pc-co-card__sub">{t('开企业抬头发票须填写纳税人识别号，以免影响报销')}</span>
            </div>
            <div className="pc-co-invoice">
              <span>{invoiceSummary}</span>
              {Number(invoiceData.invoiceType) === 1 && Number(invoiceData.titleType) === 1 ? <em>{t('个人')}</em> : null}
              {Number(invoiceData.invoiceType) === 1 && Number(invoiceData.titleType) === 2 ? <em>{t('企业')}</em> : null}
              {invoiceData.companyName ? <span>{invoiceData.companyName}</span> : null}
              <button type="button" className="pc-co-link" onClick={() => void openInvoice()}>{t('修改')}</button>
            </div>
          </section>
        ) : null}

        {/* 账期 */}
        {canUseCredit ? (
          <section className="pc-co-card">
            <div className="pc-co-card__head">
              <h2>{t('账期')}</h2>
            </div>
            <div className="pc-co-check">
              <Checkbox checked={useCredit === 1} disabled={creditDisabled} onChange={(event) => changeCredit(Boolean(event.target.checked))}>{t('账期支付')}</Checkbox>
              <span className="pc-co-card__sub">
                {creditInfo?.disableReason ? creditInfo.disableReason : <>{t('当前可用额度')}<b>{money(creditInfo?.availableAmount)}</b></>}
              </span>
              {Number(creditInfo?.settlementDays || 0) > 0 ? <span className="pc-co-card__sub">账期 {creditInfo?.settlementDays} 天</span> : null}
            </div>
          </section>
        ) : null}
      </div>

      {/* 右栏：订单详情 */}
      <aside className="pc-co__summary">
        <h2 className="pc-co-summary__title">{t('订单详情')}</h2>
        <div className="pc-co-summary__list">
          <div className="pc-co-line pc-co-line--label">
            <span>{t('商品总价：')}</span>
            <b>¥ {money(total.productAmount)}</b>
          </div>
          {Number(total.serviceFee || 0) > 0 ? (
            <div className="pc-co-line">
              <span>{t('附加费用：')}</span>
              <b>¥ {money(total.serviceFee)}</b>
            </div>
          ) : null}
          {Number(total.balance || 0) > 0 && useBalance > 0 ? (
            <div className="pc-co-line">
              <span>{t('使用余额：')}</span>
              <b className="is-deduct">- ¥ {money(total.balance)}</b>
            </div>
          ) : null}
          {Number(total.giftCardAmount || 0) > 0 ? (
            <div className="pc-co-line">
              <span>{t('使用礼品卡：')}</span>
              <b className="is-deduct">- ¥ {money(total.giftCardAmount)}</b>
            </div>
          ) : null}
          {Number(total.pointsAmount || 0) > 0 && flowType !== 3 ? (
            <div className="pc-co-line">
              <span>{t('积分减免：')}</span>
              <b className="is-deduct">- ¥ {money(total.pointsAmount)}</b>
            </div>
          ) : null}
          <div className="pc-co-line--group">
            {Number(total.discounts || 0) > 0 ? (
              <div className="pc-co-line">
                <span>{t('共优惠')}</span>
                <b className="is-deduct">- ¥ {money(total.discounts)}</b>
              </div>
            ) : null}
            <div className="pc-co-line">
              <span>{t('商品总额')}</span>
              <b>¥ {money(total.productAmount)}</b>
            </div>
            {Number(total.discountCouponAmount || 0) > 0 ? (
              <div className="pc-co-line">
                <span>{t('优惠券')}</span>
                <b className="is-deduct">- ¥ {money(total.discountCouponAmount)}</b>
              </div>
            ) : null}
            {Number(total.discountDiscountAmount || 0) > 0 ? (
              <div className="pc-co-line">
                <span>{t('其他优惠')}</span>
                <b className="is-deduct">- ¥ {money(total.discountDiscountAmount)}</b>
              </div>
            ) : null}
            {needShipping ? (
              <div className="pc-co-line">
                <span>{t('快递：')}</span>
                {Number(total.shippingFee || 0) > 0 ? (
                  <b>¥ {money(total.shippingFee)}</b>
                ) : (
                  <b className="is-free">{updating ? '-' : '包邮'}</b>
                )}
              </div>
            ) : null}
            {showTaxAmount ? (
              <div className="pc-co-line">
                <span>{t('税费：')}</span>
                <b>¥ {money(total.taxRateAmount)}</b>
              </div>
            ) : null}
            {Number(total.discountAfter || 0) > 0 ? (
              <div className="pc-co-line">
                <span>{t('合计')}</span>
                <b>¥ {money(total.discountAfter)}</b>
              </div>
            ) : null}
          </div>
        </div>

        {needShipping && Number(total.shippingFee || 0) <= 0 && total.storeShippingFee ? (
          <p className="pc-co-summary__hint">
            运费明细：
            {Object.entries(total.storeShippingFee as Record<string, unknown>).map(([shopId, fee]) => (
              <span key={shopId}>
                {Number(shopId) === 0 ? t('自营') : t('店铺 {id}', { id: shopId })} ¥{money(fee)}
              </span>
            ))}
          </p>
        ) : null}

        {orderSendPoint > 0 ? (
          <p className="pc-co-summary__point">*该订单完成后，您将预计获得 {orderSendPoint} 积分</p>
        ) : null}

        <div className="pc-co-summary__total">
          <span>{t('仍需支付：')}</span>
          {flowType === 3 ? (
            <span className="pc-co-summary__exchange">
              {total.exchangePoints} <small>{t('积分')}</small> +
            </span>
          ) : null}
          <b>¥ {money(payAmount)}</b>
        </div>

        <Button
          className="pc-co-submit"
          theme="solid"
          type="primary"
          size="large"
          block
          loading={submitting}
          disabled={submitDisabled}
          onClick={submit}
        >
          {isDepositPresale ? t('支付定金') : '立即下单'}
        </Button>
      </aside>

      {/* 地址选择弹窗（旧版 Address.vue） */}
      <Modal title={t('收货地址')} visible={addressOpen} onCancel={() => setAddressOpen(false)} footer={null} width={880}>
        <p className="pc-co-hint">{t('不同地区的配送选项和配送速度可能会有所不同')}</p>
        <div className="pc-co-address-list">
          {addresses.map((item) => (
            <button
              type="button"
              key={item.addressId}
              className={`pc-co-address-card${item.addressId === addressId ? ' is-active' : ''}`}
              onClick={() => onChangeAddress(item.addressId)}
            >
              <div className="pc-co-address__line">
                <b>{item.consignee || '-'}</b>
                <span>
                  {item.mobileAreaCode ? `+${item.mobileAreaCode} ` : ''}
                  {item.mobile || '-'}
                </span>
                {Number(item.isInvalid) ? <em className="pc-co-invalid">{t('无效地址')}</em> : null}
              </div>
              <p>{item.formattedAddress || item.fullAddress || [item.regionName, item.address].filter(Boolean).join(' ')}</p>
              <small>
                {item.email || '-'} / {item.telephone || '-'}
              </small>
              {Number(item.isSelected) === 1 ? <em className="pc-co-default">{t('默认地址')}</em> : null}
            </button>
          ))}
          {!addresses.length ? <p className="pc-co-hint">{t('暂无收货地址')}</p> : null}
        </div>
        <div className="pc-co-address-actions">
          <Link href="/member/address">
            <Button theme="light">{t('管理地址')}</Button>
          </Link>
          <Button theme="borderless" onClick={() => void loadAddresses()}>{t('刷新地址')}</Button>
        </div>
      </Modal>

      {/* 发票弹窗 */}
      <Modal title={t('发票信息')} visible={invoiceOpen} onCancel={() => setInvoiceOpen(false)} onOk={confirmInvoice} okText="保存" cancelText="取消" width={560}>
        <div className="pc-invoice-form">
          <div className="pc-invoice-form__row">
            <span>{t('发票类型')}</span>
            <select
              value={invoiceForm.invoiceType}
              onChange={(event) => setInvoiceForm((prev) => ({ ...prev, invoiceType: Number(event.target.value) }))}
            >
              <option value={0}>{t('不开发票')}</option>
              <option value={1}>{t('电子普通发票')}</option>
              <option value={2} disabled={!invoiceQualified}>
                增值税专用发票{invoiceQualified ? '' : '（需资质审核）'}
              </option>
            </select>
          </div>
          {Number(invoiceForm.invoiceType) !== 0 ? (
            <>
              <div className="pc-invoice-form__row">
                <span>{t('抬头类型')}</span>
                <select
                  value={invoiceForm.titleType}
                  onChange={(event) => setInvoiceForm((prev) => ({ ...prev, titleType: Number(event.target.value) }))}
                >
                  <option value={1}>{t('个人')}</option>
                  <option value={2}>{t('企业')}</option>
                </select>
              </div>
              <div className="pc-invoice-form__row">
                <span>{Number(invoiceForm.titleType) === 1 ? t('个人名称') : '企业名称'}</span>
                <input
                  value={String(invoiceForm.companyName || '')}
                  onChange={(event) => setInvoiceForm((prev) => ({ ...prev, companyName: event.target.value }))}
                />
              </div>
              {Number(invoiceForm.titleType) === 2 || Number(invoiceForm.invoiceType) === 2 ? (
                <div className="pc-invoice-form__row">
                  <span>{t('纳税人识别号')}</span>
                  <input
                    value={String(invoiceForm.companyCode || '')}
                    onChange={(event) => setInvoiceForm((prev) => ({ ...prev, companyCode: event.target.value }))}
                  />
                </div>
              ) : null}
              {Number(invoiceForm.invoiceType) === 2 ? (
                <>
                  <div className="pc-invoice-form__row">
                    <span>{t('单位地址')}</span>
                    <input
                      value={String(invoiceForm.companyAddress || '')}
                      onChange={(event) => setInvoiceForm((prev) => ({ ...prev, companyAddress: event.target.value }))}
                    />
                  </div>
                  <div className="pc-invoice-form__row">
                    <span>{t('单位电话')}</span>
                    <input
                      value={String(invoiceForm.companyPhone || '')}
                      onChange={(event) => setInvoiceForm((prev) => ({ ...prev, companyPhone: event.target.value }))}
                    />
                  </div>
                  <div className="pc-invoice-form__row">
                    <span>{t('开户银行')}</span>
                    <input
                      value={String(invoiceForm.companyBank || '')}
                      onChange={(event) => setInvoiceForm((prev) => ({ ...prev, companyBank: event.target.value }))}
                    />
                  </div>
                  <div className="pc-invoice-form__row">
                    <span>{t('银行账户')}</span>
                    <input
                      value={String(invoiceForm.companyAccount || '')}
                      onChange={(event) => setInvoiceForm((prev) => ({ ...prev, companyAccount: event.target.value }))}
                    />
                  </div>
                </>
              ) : null}
              <div className="pc-invoice-form__row">
                <span>{t('收票人邮箱')}</span>
                <input
                  value={String(invoiceForm.email || '')}
                  placeholder={t('选填，用于接收电子发票')}
                  onChange={(event) => setInvoiceForm((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>
              <div className="pc-invoice-form__row">
                <span>{t('发票内容')}</span>
                <input
                  value={String(invoiceForm.invoiceContent || '')}
                  onChange={(event) => setInvoiceForm((prev) => ({ ...prev, invoiceContent: event.target.value }))}
                />
              </div>
            </>
          ) : null}
          {!invoiceQualified ? <p className="pc-co-hint">{t('增值税专用发票需先在会员中心完成增票资质审核。')}</p> : null}
        </div>
      </Modal>
    </div>
  );
}
