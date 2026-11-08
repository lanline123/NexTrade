'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Checkbox, InputNumber, Modal, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';
import { formatDateTime } from '@/lib/datetime';
import PresaleSteps from '@/components/PresaleSteps';

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

  // 旧版 check.vue 没有空态/未登录页，外层壳照旧版走，文案放 .form_item > .top_row > .tit 里，
  // 这样间距、字体、白卡背景都还是 check.less 的既有规则，不自造新外壳。
  if (loading) {
    return (
      <div className="order-check-page mp-check">
        <div className="flex_csb container">
          <div className="orderConfirmCon">
            <div className="orderConfirmConTop">
              <div className="form_item">
                <div className="top_row">
                  <div className="tit">{t('结算数据加载中...')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (needLogin) {
    return (
      <div className="order-check-page mp-check">
        <div className="flex_csb container">
          <div className="orderConfirmCon">
            <div className="orderConfirmConTop">
              <div className="form_item">
                <div className="top_row">
                  <div className="tit">{t('登录后结算')}</div>
                </div>
                <div className="from">
                  <p>{t('请先登录账号，再确认收货地址和支付方式。')}</p>
                </div>
              </div>
            </div>
            <div className="money_info">
              <div className="submit">
                <Link href="/login?redirect=/cart">
                  <button type="button" className="btn buy-btn">{t('去登录')}</button>
                </Link>
              </div>
            </div>
          </div>
        </div>
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
    <div className="order-check-page mp-check">
      <div className="flex_csb container">
        <div className="orderConfirmCon">
          {/* 收货地址：旧版 pages/order/src/Address.vue —— .form_item > .top_row(.tit + .add_btn) + .addressManage */}
          <div className="orderConfirmConTop">
            <div className="form_item mp-check-address">
              <div className="top_row flex justify-between" style={{ paddingBottom: 0 }}>
                <div className="tit">{t('收货地址')}</div>
                <div className="add_btn" onClick={() => setAddressOpen(true)}>
                  <span className="flex_cc">{t('更改')}</span>
                </div>
              </div>
              {selectedAddress ? (
                <div className="addressManage">
                  <div className="addressManage_name">
                    <span>{selectedAddress.consignee || '-'}</span>
                    {Number(selectedAddress.isInvalid) ? (
                      <span className="invalid-tag">{t('无效地址')}</span>
                    ) : null}
                  </div>
                  <div className="info">
                    <span>{selectedAddress.regionName}</span>
                    <span>&nbsp;{selectedAddress.address}</span>
                    {selectedAddress.mobile ? (
                      <span>
                        &nbsp;
                        {selectedAddress.mobileAreaCode ? `+${selectedAddress.mobileAreaCode} ` : ''}
                        {selectedAddress.mobile}
                      </span>
                    ) : null}
                  </div>
                  {showDeliveryOption ? (
                    <div className="info">
                      <span>
                        {fieldValue(deliveryOption, ['deliveryTypeName']) || (selfPickup ? t('门店自提') : '配送')}
                        {fieldValue(deliveryOption, ['storeName', 'pickupName'])
                          ? `：${fieldValue(deliveryOption, ['storeName', 'pickupName'])}`
                          : ''}
                        {fieldValue(deliveryOption, ['storeAddress', 'pickupAddress', 'address'])
                          ? ` · ${fieldValue(deliveryOption, ['storeAddress', 'pickupAddress', 'address'])}`
                          : ''}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="no-result">
                  <span>{t('暂无收货地址')}</span>
                </div>
              )}
            </div>
          </div>

          {/* 支付方式：旧版 pages/order/src/PayType.vue —— .form_item > .top_row + .pay_type > .el-radio-group */}
          <div className="orderConfirmConTop">
            <div className="form_item mp-check-paytype">
              <div className="top_row">
                <div className="tit">{t('确认支付方式')}</div>
              </div>
              <div className="pay_type">
                {payments.length ? (
                  <div className="el-radio-group" style={{ display: 'grid' }}>
                    {payments.map((payment) => {
                      const active = payTypeId === payment.typeId;
                      return (
                        <label
                          key={payment.typeId}
                          className={`el-radio${active ? ' is-checked' : ''}`}
                          onClick={() => setPayTypeId(payment.typeId)}
                        >
                          <span className={`el-radio__input${active ? ' is-checked' : ''}`}>
                            <span className="el-radio__inner" />
                          </span>
                          <span className="el-radio__label">
                            {payment.icon ? <img src={payment.icon} alt="" style={{ width: 24, height: 24, marginRight: 6 }} /> : null}
                            {payment.typeName || payment.name || t('支付方式 {id}', { id: payment.typeId })}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : null}
                {payTypeId === 0 ? (
                  <span className="errInfo red" style={{ display: 'inline', margin: 0, lineHeight: '15px' }}>
                    {t('请选择支付方式')}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* 商品：旧版 check.vue 每个店铺一个 .orderConfirmConTop > .form_item > .product_detail */}
          {(data?.cartList || []).map((group) => {
            const groupOptions =
              shippingData[String(group.shopId)] ||
              ((data?.item?.storeShippingType as Record<string, ShippingTypeOption[]>) || {})[String(group.shopId)] ||
              [];
            const selected = (shippingType as Record<string, { typeId?: number }>)[String(group.shopId)];
            return (
              <div className="orderConfirmConTop" key={`shop-${group.shopId}`}>
                <div className="form_item">
                  <div className="product_detail">
                    <div className="shop_name">
                      {Number(group.shopId) === 0 ? t('自营') : group.shopTitle || ''}
                    </div>

                    {Number(group.noShipping) === 1 ? (
                      <div className="delivery">
                        <div className="tit">{t('配送')}</div>
                        <div className="no_delivery">
                          <span className="errInfo red">{t('无需配送')}</span>
                        </div>
                      </div>
                    ) : groupOptions.length ? (
                      <div className="delivery">
                        <div className="tit">{t('配送')}</div>
                        <div className="delivery_tags flex_cc">
                          {groupOptions.map((option, index) => {
                            const typeId = Number(option.shippingTypeId || option.typeId || 0);
                            const active = Number(selected?.typeId || 0) === typeId;
                            return (
                              <div
                                className={`pay_tab flex align-center${active ? ' active' : ''}`}
                                key={`${typeId}-${index}`}
                                onClick={() => onChangeShipping(group.shopId, option)}
                              >
                                <span>{option.shippingTypeName || option.typeName || t('配送 {id}', { id: typeId })}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="delivery">
                        <div className="tit">{t('配送')}</div>
                        <div className="no_delivery">
                          <span className="errInfo red">{t('该收货地址不支持配送')}</span>
                        </div>
                      </div>
                    )}

                    <div className="detail">
                      {(group.carts || []).map((product) => {
                        const percent = discountPercent(product.price, product.productPrice);
                        const skuText = (product.skuData || []).map((sku) => sku.value).filter(Boolean).join(' / ');
                        return (
                          <div className="list flex align-start" key={product.cartId}>
                            <div className="flex align-start">
                              <div className="pic">
                                <Link href={`/product/${product.productId}`}>
                                  <img src={product.picThumb || ''} alt={product.productName || ''} />
                                </Link>
                              </div>
                              <div className="describe flex flex-column">
                                <div className="name ellipsis">
                                  <Link href={`/product/${product.productId}`}>
                                    {percent > 0 ? (
                                      <span className="seckill-item-discount">
                                        <span className="discount-txt">{t('优惠 {percent}%', { percent })}</span>
                                      </span>
                                    ) : null}
                                    {product.productName}
                                  </Link>
                                </div>
                                {skuText ? (
                                  <div className="mt10 sku-name-box">
                                    <div className="sku-name-item">
                                      <span className="sku-name">{skuText}</span>
                                    </div>
                                  </div>
                                ) : null}
                                {(product.extraSkuData || []).length ? (
                                  <div className="extraskudata">
                                    {(product.extraSkuData || []).map((attr, index) => (
                                      <div className="extraskudata-item" key={`${attr.attrName}-${index}`}>
                                        <div className="title">{attr.attrName}</div>
                                        <div className="line-box">
                                          <div className="line" />
                                        </div>
                                        <div className="content">
                                          <span className="content-text">{attr.attrValue}</span>
                                          {Number(attr.attrPrice || 0) !== 0 ? <>¥ {money(attr.attrPrice)}</> : null}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                                {activityList(product.activityInfo).length ? (
                                  <div className="activity-box">
                                    <div className="promotion">
                                      <div className="ticket-content">
                                        {activityList(product.activityInfo).map((activity, index) => (
                                          <span className="discount-txt" key={`${activity.promotionId}-${index}`}>
                                            {Number(activity.type) === 1 ? t('秒杀价') : '限时折扣'}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            <div className="money">¥ {money(product.price)}</div>
                            <div className="quantity">x{product.quantity || 1}</div>
                          </div>
                        );
                      })}
                    </div>

                    {(group.gift || []).length ? (
                      <div className="gift-box">
                        <div className="gift-title">{t('赠品')}</div>
                        <div className="gift-content">
                          {(group.gift || []).map((gift, index) => (
                            <div className="gift-content-item" key={`${gift.giftId}-${index}`}>
                              <div className="gift-item-left">
                                <div className="gift-img">
                                  <img src={gift.picThumb || gift.image || ''} alt={gift.productName || ''} />
                                </div>
                              </div>
                              <div className="gift-item-right">
                                <div className="gift-item-name">{gift.productName}</div>
                                {(gift.skuData || []).length ? (
                                  <div className="sku-card">
                                    {(gift.skuData || []).map((sku: any, skuIndex: number) => (
                                      <div className="sku-item" key={`${sku.name}-${skuIndex}`}>
                                        {sku.name}：{sku.value}
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                                <div className="gift-item-num">x{gift.num || 1}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}

          {/* 预售步骤条：旧版 .orderConfirmConTop.presale-steps */}
          {presale ? (
            <div className="orderConfirmConTop presale-steps">
              <PresaleSteps productPresale={presale} presaleStatus={0} total={total} />
            </div>
          ) : null}

          {/* 订单备注：旧版 .form_item > .add_remark > .a_rmk_tit + el-input */}
          <div className="orderConfirmConTop">
            <div className="form_item">
              <div className="add_remark">
                <div className="a_rmk_tit">{t('订单备注')}</div>
                <div className="el-textarea">
                  <textarea
                    className="el-textarea__inner"
                    rows={2}
                    maxLength={50}
                    value={buyerNote}
                    placeholder={t('提示：请勿填写有关支付、收货、发票方面的信息')}
                    onChange={(event) => changeNote(event.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 优惠券：旧版 pages/order/src/CouponInfo.vue —— .check-box(.tit + .radio-group) + .from_list > .coupon-box > .coupon_list */}
          {!giftCardMode && data?.couponList ? (
            <div className="orderConfirmConTop mp-check-coupon">
              <div className="check-box">
                <div className="tit">{t('优惠券')}</div>
                <div>
                  <div className="radio-group">
                    <div className={`item${couponTab === 0 ? ' active' : ''}`} onClick={() => setCouponTab(0)}>
                      {t('可用')}
                    </div>
                    <div className={`item${couponTab === 1 ? ' active' : ''}`} onClick={() => setCouponTab(1)}>
                      {t('不可用')}
                    </div>
                  </div>
                </div>
              </div>
              <div className="from_list">
                <div className="arrow" />
                <div className="coupon-box">
                  <div className="coupon_list">
                    {couponTab === 0 ? (
                      coupons.length ? (
                        coupons.map((coupon) => {
                          const userCouponId = Number(coupon.userCouponId || 0);
                          const active = userCouponIds.includes(userCouponId);
                          return (
                            <div
                              className="coupon-container"
                              key={userCouponId}
                              onClick={() => toggleCoupon(coupon)}
                            >
                              <Checkbox checked={active} onChange={() => toggleCoupon(coupon)} />
                              <div>
                                <div className={`coupon-info${coupon.couponDesc ? ' border' : ''}`}>
                                  <div className="coupon-off-text">
                                    <div className="top">
                                      {Number(coupon.couponType) === 1 || Number(coupon.couponMoney || 0) > 0 ? (
                                        <div className="price">¥ {money(coupon.couponMoney)}</div>
                                      ) : (
                                        <div className="discount">{coupon.couponDiscount || '-'}</div>
                                      )}
                                      <div className="desc">
                                        <div className="name">{coupon.couponName}</div>
                                      </div>
                                    </div>
                                    {formatDateTime(coupon.startDate) ? (
                                      <div className="time-wrap">
                                        {formatDateTime(coupon.startDate)} {t('至')} {formatDateTime(coupon.endDate)}
                                      </div>
                                    ) : (
                                      <div className="time-wrap">
                                        {formatDateTime(coupon.endDate)} {t('前有效')}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {coupon.couponDesc ? <div className="coupon-desc">{coupon.couponDesc}</div> : null}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="couponShop">
                          <span>{t('没有可用的优惠券')}</span>
                        </div>
                      )
                    ) : disableCoupons.length ? (
                      disableCoupons.map((coupon, index) => (
                        <div className="coupon-containerOne" key={`${coupon.userCouponId}-${index}`}>
                          <Checkbox checked={false} disabled />
                          <div>
                            <div className={`coupon-info${coupon.couponDesc ? ' border' : ''}`}>
                              <div className="coupon-off-text">
                                <div className="top">
                                  {Number(coupon.couponType) === 1 || Number(coupon.couponMoney || 0) > 0 ? (
                                    <div className="price">¥ {money(coupon.couponMoney)}</div>
                                  ) : (
                                    <div className="discount">{coupon.couponDiscount || '-'}</div>
                                  )}
                                  <div className="desc">
                                    <div className="name">{coupon.couponName}</div>
                                  </div>
                                </div>
                                {formatDateTime(coupon.startDate) ? (
                                  <div className="time-wrap">
                                    {formatDateTime(coupon.startDate)} {t('至')} {formatDateTime(coupon.endDate)}
                                  </div>
                                ) : (
                                  <div className="time-wrap">
                                    {formatDateTime(coupon.endDate)} {t('前有效')}
                                  </div>
                                )}
                              </div>
                            </div>
                            {coupon.couponDesc ? <div className="coupon-desc">{coupon.couponDesc}</div> : null}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="couponShop">
                        <span>{t('没有可用的优惠券')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* 积分：旧版 .from > .check-boxPoint + .from_list > .integral > .inp_box */}
          {!giftCardMode && flowType === 1 ? (
            <div className="orderConfirmConTop mp-check-integral">
              <div className="from">
                <div className="check-boxPoint flex">
                  <span className="tit">{t('使用积分')}</span>
                  <div>
                    <span className="font-color">
                      {t('当前账户共')}
                      {accountPoints}
                      {t('积分')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="from_list">
                <div className="integral flex">
                  <div className="tit" />
                  <div className="inp_box">
                    <div className="inp">
                      <InputNumber
                        min={0}
                        max={availablePoints}
                        value={usePoint}
                        disabled={availablePoints <= 0}
                        onChange={(value) =>
                          setUsePoint(Math.max(0, Math.min(availablePoints, Math.floor(Number(value) || 0))))
                        }
                        onBlur={() => void updateCheck({ usePoint })}
                      />
                    </div>
                    {Number(total.pointsAmount || 0) > 0 ? (
                      <div className="tips">
                        {t('共抵扣')}
                        <span className="red">¥ {money(total.pointsAmount)}</span>
                      </div>
                    ) : null}
                    <div className="tips">
                      {t('该订单最多可用 {a} 积分', { a: availablePoints })}
                      <Link href="/article/issue?articleId=7" target="_blank">
                        <span className="font-color">{t('【如何获得积分?】')}</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* 余额：旧版 .form_item > .top_row(.tit) + .from > .check-box.flex.align-center */}
          {!giftCardMode && titleText ? (
            <div className="orderConfirmConTop">
              <div className="form_item">
                <div className="top_row">
                  <div className="tit">{t('余额')}</div>
                </div>
                <div className="from">
                  <div className="check-box flex align-center">
                    <Checkbox
                      checked={useBalance > 0}
                      disabled={availableBalance <= 0}
                      onChange={(event) => toggleBalance(Boolean(event.target.checked))}
                    >
                      <span className="tit">{t('使用余额')}</span>
                    </Checkbox>
                    <div>
                      <span className="font-color">
                        {t('当前账户余额')} ¥ {money(availableBalance)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* 发票：旧版 .form_item > .top_row.flex.align-end(.tit + .tips) + .from > .invoice-box */}
          {!giftCardMode ? (
            <div className="orderConfirmConTop mp-check-invoice">
              <div className="form_item">
                <div className="top_row flex align-end">
                  <div className="tit">{t('发票信息')}</div>
                  <div className="tips">{t('开企业抬头发票须填写纳税人识别号，以免影响报销')}</div>
                </div>
                <div className="from">
                  <div className="flex align-center invoice-box">
                    <div className="title flex align-center">
                      <span>{invoiceSummary}</span>
                      {Number(invoiceData.invoiceType) === 1 && Number(invoiceData.titleType) === 1 ? (
                        <span>{t('个人')}</span>
                      ) : null}
                      {Number(invoiceData.invoiceType) === 1 && Number(invoiceData.titleType) === 2 ? (
                        <span>{t('企业')}</span>
                      ) : null}
                    </div>
                    <div className="type">
                      <span>{invoiceData.companyName || ''}</span>
                    </div>
                    <div className="btn hand-pointer" onClick={() => void openInvoice()}>
                      {t('修改')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* 账期：旧版 .form_item > .top_row(.tit) + .from > .check-box(.credit-disabled) */}
          {canUseCredit ? (
            <div className="orderConfirmConTop">
              <div className="form_item">
                <div className="top_row">
                  <div className="tit">{t('账期')}</div>
                </div>
                <div className="from">
                  <div className={`check-box flex align-center${creditDisabled ? ' credit-disabled' : ''}`}>
                    <Checkbox
                      checked={useCredit === 1}
                      disabled={creditDisabled}
                      onChange={(event) => changeCredit(Boolean(event.target.checked))}
                    >
                      <span className="tit">{t('账期支付')}</span>
                    </Checkbox>
                    <div>
                      <span className="font-color">
                        {creditInfo?.disableReason
                          ? creditInfo.disableReason
                          : `${t('当前可用额度')} ¥ ${money(creditInfo?.availableAmount)}`}
                      </span>
                    </div>
                    {Number(creditInfo?.settlementDays || 0) > 0 ? (
                      <div>
                        <span className="font-color">
                          {t('账期')} {creditInfo?.settlementDays} {t('天')}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* 右栏：订单详情（源码 pages/order/check.vue 361–572） */}
        <div className="money_info">
          <div className="money_title">{t('订单详情')}</div>
          <div className="total_list">
            <div className="discount">
              <div className="flex justify-between">
                <div className="total_text">{t('商品总价：')}</div>
                <div>¥ {money(total.productAmount)}</div>
              </div>
              {Number(total.serviceFee || 0) > 0 ? (
                <div className="flex justify-between">
                  <div className="total_text">{t('附加费用：')}</div>
                  <div>¥ {money(total.serviceFee)}</div>
                </div>
              ) : null}
              {Number(total.balance || 0) > 0 && useBalance > 0 ? (
                <div className="flex justify-between">
                  <div className="total_text">{t('使用余额：')}</div>
                  <div>- ¥ {money(total.balance)}</div>
                </div>
              ) : null}
              {Number(total.giftCardAmount || 0) > 0 ? (
                <div className="flex justify-between">
                  <div className="total_text">{t('使用礼品卡：')}</div>
                  <div>- ¥ {money(total.giftCardAmount)}</div>
                </div>
              ) : null}
              {Number(total.pointsAmount || 0) > 0 && flowType !== 3 ? (
                <div className="flex justify-between">
                  <div className="total_text">{t('积分减免：')}</div>
                  <div>- ¥ {money(total.pointsAmount)}</div>
                </div>
              ) : null}
              <div className="discount-content">
                {Number(total.discounts || 0) > 0 ? (
                  <div className="flex justify-between discount-item-box">
                    <div className="item-label">{t('共优惠')}</div>
                    <div className="item-value discounts-value">- ¥ {money(total.discounts)}</div>
                  </div>
                ) : null}
                <div className="flex justify-between discount-item-box">
                  <div className="item-label">{t('商品总额')}</div>
                  <div className="item-value">¥ {money(total.productAmount)}</div>
                </div>
                {Number(total.discountCouponAmount || 0) > 0 ? (
                  <div className="flex justify-between discount-item-box">
                    <div className="item-label">{t('优惠券')}</div>
                    <div className="item-value discounts-value">- ¥ {money(total.discountCouponAmount)}</div>
                  </div>
                ) : null}
                {Number(total.discountDiscountAmount || 0) > 0 ? (
                  <div className="flex justify-between discount-item-box">
                    <div className="item-label">{t('其他优惠')}</div>
                    <div className="item-value discounts-value">- ¥ {money(total.discountDiscountAmount)}</div>
                  </div>
                ) : null}
                {needShipping ? (
                  <div className={`discount-item-box${needShipping ? ' border-bottom' : ''}`}>
                    <div className="flex">
                      <div className="item-label">{t('快递：')}</div>
                      <div className="tip-item">
                        <span className="freight-icon" />
                        <div className="ui-tips">
                          <span className="ui-tips-arrow" />
                          <div className="ui-tips-main">
                            <div className="tit">{t('各店铺运费明细')}</div>
                            <div className="goods_list">
                              {Object.entries((total.storeShippingFee as Record<string, unknown>) || {}).map(
                                ([shopId, fee]) => (
                                  <div className="goods_col" key={`freight-${shopId}`}>
                                    <div className="shop_name">
                                      {Number(shopId) === 0 ? t('自营') : t('店铺 {id}', { id: shopId })}
                                    </div>
                                    <div className="list">
                                      <div className="txt">
                                        ¥ {money(fee)}
                                        <span className="free-text">{Number(fee) > 0 ? '' : t('（包邮）')}</span>
                                      </div>
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      {Number(total.shippingFee || 0) > 0 ? (
                        <div className="item-value">¥ {money(total.shippingFee)}</div>
                      ) : (
                        <div className="item-value">{updating ? '-' : '包邮'}</div>
                      )}
                    </div>
                  </div>
                ) : null}
                {showTaxAmount ? (
                  <div className="discount-item-box">
                    <div className="item-label tax-item-label">
                      <span>{t('税费：')}</span>
                    </div>
                    <div className="item-value">¥ {money(total.taxRateAmount)}</div>
                  </div>
                ) : null}
                {Number(total.discountAfter || 0) > 0 ? (
                  <div className="discount-item-box">
                    <div className="item-label">{t('合计')}</div>
                    <div className="item-value">¥ {money(total.discountAfter)}</div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {needShipping && Number(total.shippingFee || 0) <= 0 && total.storeShippingFee ? (
            <div className="complete">
              {`运费明细：`}
              {Object.entries(total.storeShippingFee as Record<string, unknown>).map(([shopId, fee]) => (
                <span key={shopId}>
                  {Number(shopId) === 0 ? t('自营') : t('店铺 {id}', { id: shopId })} ¥{money(fee)}
                </span>
              ))}
            </div>
          ) : null}

          {orderSendPoint > 0 ? (
            <div className="complete">
              {`*该订单完成后，您将预计获得 ${orderSendPoint} 积分`}
            </div>
          ) : null}

          <div className="total_fee flex justify-between">
            <div className="flex total_fee-box">
              <div className="unpaidamount-label">{t('仍需支付')}：</div>
              {flowType === 3 ? (
                <div className="points-box">
                  <div className="points-value">
                    {total.exchangePoints}
                    <div className="points-text">{t('积分')}</div>
                  </div>
                  <div className="symbol">+</div>
                </div>
              ) : null}
            </div>
            <div className="price">
              <div className="util">¥</div>
              <div className="num">{money(payAmount)}</div>
            </div>
          </div>

          <div className="submit">
            <button
              type="button"
              className="btn buy-btn"
              disabled={submitDisabled || submitting}
              onClick={submit}
            >
              {submitting ? t('提交中…') : isDepositPresale ? t('支付定金') : t('立即下单')}
            </button>
          </div>
        </div>
      </div>

      {/* 地址选择弹窗（旧版 pages/order/src/Address.vue 的 el-dialog：.address-info > .tips + .card-list > ul.card） */}
      <Modal
        title={t('收货地址')}
        visible={addressOpen}
        onCancel={() => setAddressOpen(false)}
        footer={null}
        width={880}
      >
        <div className="address-info">
          <div className="tips">{t('不同地区的配送选项和配送速度可能会有所不同')}</div>
          <div className="card-list">
            {addresses.length ? (
              addresses.map((item) => (
                <ul
                  className={`card${Number(item.addressId) === addressId ? ' selected' : ''}`}
                  key={item.addressId}
                  onClick={() => onChangeAddress(item.addressId)}
                >
                  <li className="first">
                    <div className="top-info">
                      <div className="name">
                        <span>{item.consignee || '-'}</span>
                      </div>
                      <div className="mobile">
                        <span style={{ marginRight: 8 }}>
                          {item.mobileAreaCode ? `+${item.mobileAreaCode} ` : ''}
                          {item.mobile || '-'}
                        </span>
                        {Number(item.isInvalid) ? <span className="invalid-tag">{t('无效地址')}</span> : null}
                      </div>
                    </div>
                    <div className="address">
                      {item.formattedAddress ||
                        item.fullAddress ||
                        [item.regionName, item.address].filter(Boolean).join(' ')}
                    </div>
                    <div className="other">
                      <div>{item.email || '-'}</div>
                      <div>{item.telephone || '-'}</div>
                    </div>
                    <div className="bottom-operation">
                      <div className="is-default">
                        <span className="el-checkbox">
                          <span className={`el-checkbox__input${Number(item.isSelected) === 1 ? ' is-checked' : ''}`}>
                            <span className="el-checkbox__inner" />
                          </span>
                          <span className="el-checkbox__label">{t('默认地址')}</span>
                        </span>
                      </div>
                      <div className="operation">
                        <Link href="/member/address">{t('编辑')}</Link>
                      </div>
                    </div>
                  </li>
                </ul>
              ))
            ) : (
              <div className="no-result">
                <span>{t('暂无收货地址')}</span>
              </div>
            )}
          </div>
          <div className="title-or-tabs">
            <Link href="/member/address">
              <button type="button" className="el-button el-button--default btn">
                <span>{t(' + 添加新地址')}</span>
              </button>
            </Link>
            <button type="button" className="el-button el-button--default btn" onClick={() => void loadAddresses()}>
              <span>{t('刷新地址')}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* 发票弹窗（旧版 el-form.form-body） */}
      <Modal
        title={t('发票信息')}
        visible={invoiceOpen}
        onCancel={() => setInvoiceOpen(false)}
        onOk={confirmInvoice}
        okText="保存"
        cancelText="取消"
        width={560}
      >
        <form className="el-form form-body">
          <div className="el-form-item">
            <label className="el-form-item__label">{t('发票类型')}</label>
            <div className="el-form-item__content">
              <select
                className="el-select"
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
          </div>
          {Number(invoiceForm.invoiceType) !== 0 ? (
            <>
              <div className="el-form-item">
                <label className="el-form-item__label">{t('抬头类型')}</label>
                <div className="el-form-item__content">
                  <select
                    className="el-select"
                    value={invoiceForm.titleType}
                    onChange={(event) => setInvoiceForm((prev) => ({ ...prev, titleType: Number(event.target.value) }))}
                  >
                    <option value={1}>{t('个人')}</option>
                    <option value={2}>{t('企业')}</option>
                  </select>
                </div>
              </div>
              <div className="el-form-item">
                <label className="el-form-item__label">
                  {Number(invoiceForm.titleType) === 1 ? t('个人名称') : '企业名称'}
                </label>
                <div className="el-form-item__content">
                  <input
                    className="el-input__inner"
                    value={String(invoiceForm.companyName || '')}
                    onChange={(event) => setInvoiceForm((prev) => ({ ...prev, companyName: event.target.value }))}
                  />
                </div>
              </div>
              {Number(invoiceForm.titleType) === 2 || Number(invoiceForm.invoiceType) === 2 ? (
                <div className="el-form-item">
                  <label className="el-form-item__label">{t('纳税人识别号')}</label>
                  <div className="el-form-item__content">
                    <input
                      className="el-input__inner"
                      value={String(invoiceForm.companyCode || '')}
                      onChange={(event) => setInvoiceForm((prev) => ({ ...prev, companyCode: event.target.value }))}
                    />
                  </div>
                </div>
              ) : null}
              {Number(invoiceForm.invoiceType) === 2 ? (
                <>
                  <div className="el-form-item">
                    <label className="el-form-item__label">{t('单位地址')}</label>
                    <div className="el-form-item__content">
                      <input
                        className="el-input__inner"
                        value={String(invoiceForm.companyAddress || '')}
                        onChange={(event) => setInvoiceForm((prev) => ({ ...prev, companyAddress: event.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="el-form-item">
                    <label className="el-form-item__label">{t('单位电话')}</label>
                    <div className="el-form-item__content">
                      <input
                        className="el-input__inner"
                        value={String(invoiceForm.companyPhone || '')}
                        onChange={(event) => setInvoiceForm((prev) => ({ ...prev, companyPhone: event.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="el-form-item">
                    <label className="el-form-item__label">{t('开户银行')}</label>
                    <div className="el-form-item__content">
                      <input
                        className="el-input__inner"
                        value={String(invoiceForm.companyBank || '')}
                        onChange={(event) => setInvoiceForm((prev) => ({ ...prev, companyBank: event.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="el-form-item">
                    <label className="el-form-item__label">{t('银行账户')}</label>
                    <div className="el-form-item__content">
                      <input
                        className="el-input__inner"
                        value={String(invoiceForm.companyAccount || '')}
                        onChange={(event) => setInvoiceForm((prev) => ({ ...prev, companyAccount: event.target.value }))}
                      />
                    </div>
                  </div>
                </>
              ) : null}
              <div className="el-form-item">
                <label className="el-form-item__label">{t('收票人邮箱')}</label>
                <div className="el-form-item__content">
                  <input
                    className="el-input__inner"
                    value={String(invoiceForm.email || '')}
                    placeholder={t('选填，用于接收电子发票')}
                    onChange={(event) => setInvoiceForm((prev) => ({ ...prev, email: event.target.value }))}
                  />
                </div>
              </div>
              <div className="el-form-item">
                <label className="el-form-item__label">{t('发票内容')}</label>
                <div className="el-form-item__content">
                  <input
                    className="el-input__inner"
                    value={String(invoiceForm.invoiceContent || '')}
                    onChange={(event) => setInvoiceForm((prev) => ({ ...prev, invoiceContent: event.target.value }))}
                  />
                </div>
              </div>
            </>
          ) : null}
          {!invoiceQualified ? (
            <div className="el-form-item">
              <div className="el-form-item__content">{t('增值税专用发票需先在会员中心完成增票资质审核。')}</div>
            </div>
          ) : null}
        </form>
      </Modal>
    </div>
  );
}
