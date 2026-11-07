import { useEffect, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Empty,
  Input,
  InputNumber,
  Modal,
  Radio,
  RadioGroup,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  TextArea,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '../api';
import RegionSelect from '../components/RegionSelect';
import { useI18n } from '../i18n';

const { Text, Title } = Typography;

interface ProxyUser {
  userId: number;
  username?: string;
  nickname?: string;
  mobile?: string;
  balance?: number;
  avatar?: string;
}

interface ProxyProduct {
  productId: number;
  productName?: string;
  productSn?: string;
  picUrl?: string;
  picThumb?: string;
  productPrice?: number;
  productStock?: number;
  isTimeDiscount?: number;
}

interface ProxyCartItem {
  cartId: number;
  productId?: number;
  productName?: string;
  productSn?: string;
  picThumb?: string;
  price?: number;
  quantity?: number;
  subtotal?: number;
  skuData?: string;
  skuId?: number;
}

interface SkuRow {
  skuId: number;
  skuValue?: string;
  skuSn?: string;
  skuPrice?: number | string;
  skuStock?: number;
  isEnabled?: number;
}

interface CheckPaymentType {
  payTypeId?: number;
  name?: string;
  [key: string]: any;
}

interface CheckAddress {
  addressId?: number;
  contact?: string;
  mobile?: string;
  address?: string;
  regionNames?: string;
  isSelected?: number;
  [key: string]: any;
}

interface CheckCoupon {
  id?: number;
  couponId?: number;
  couponName?: string;
  couponPrice?: number | string;
  fullPrice?: number | string;
  [key: string]: any;
}

interface PickupRow {
  pickupId?: number;
  pickupName?: string;
  address?: string;
  mobile?: string;
  [key: string]: any;
}

const money = (value: unknown) => `¥${Number(value || 0).toFixed(2)}`;

const flattenCart = (payload: any): ProxyCartItem[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.list)) return payload.list;
  if (Array.isArray(payload?.cartList)) {
    return payload.cartList.flatMap((store: any) =>
      Array.isArray(store?.carts) ? store.carts : Array.isArray(store?.items) ? store.items : [],
    );
  }
  return [];
};

/** 代客下单：对应旧版 order/proxyShopping/Index.vue + CheckPanel.vue。
 * 已实现：会员选择、商品列表、SKU 规格弹窗（多规格商品加购）、购物车（数量/改价）、
 * 结算页（地址管理新增/编辑、配送方式、自提点选择、支付方式、优惠券选择、
 * 积分/余额抵扣、改价、订单备注）。 */
export default function ProxyShopping() {
  const { t } = useI18n();
  const [step, setStep] = useState<'index' | 'check'>('index');
  const [user, setUser] = useState<ProxyUser | null>(null);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [userKeyword, setUserKeyword] = useState('');
  const [userList, setUserList] = useState<ProxyUser[]>([]);
  const [products, setProducts] = useState<ProxyProduct[]>([]);
  const [productTotal, setProductTotal] = useState(0);
  const [productPage, setProductPage] = useState(1);
  const [productKeyword, setProductKeyword] = useState('');
  const [productLoading, setProductLoading] = useState(false);
  const [cartItems, setCartItems] = useState<ProxyCartItem[]>([]);
  const [cartLoading, setCartLoading] = useState(false);
  const [checkData, setCheckData] = useState<any>(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [addressId, setAddressId] = useState<number | undefined>();
  const [deliveryType, setDeliveryType] = useState<number | undefined>();
  const [payTypeId, setPayTypeId] = useState<number | undefined>();
  const [buyerNote, setBuyerNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // SKU 规格弹窗（对应旧版 ProductSpecPop）
  const [specTarget, setSpecTarget] = useState<ProxyProduct | null>(null);
  const [specRows, setSpecRows] = useState<SkuRow[]>([]);
  const [specLoading, setSpecLoading] = useState(false);
  const [specSkuId, setSpecSkuId] = useState<number | undefined>();
  const [specNumber, setSpecNumber] = useState(1);
  // 行改价（对应旧版 AlterPriceDrawer）
  const [priceTarget, setPriceTarget] = useState<ProxyCartItem | null>(null);
  const [priceValue, setPriceValue] = useState<number>(0);
  // 抵扣
  const [usePoint, setUsePoint] = useState(0);
  const [useBalance, setUseBalance] = useState<number>(0);
  // 优惠券
  const [selectedCouponIds, setSelectedCouponIds] = useState<number[]>([]);
  // 自提
  const [pickupRows, setPickupRows] = useState<PickupRow[]>([]);
  const [pickupId, setPickupId] = useState<number | undefined>();
  const [pickupContactName, setPickupContactName] = useState('');
  const [pickupContactMobile, setPickupContactMobile] = useState('');
  // 地址编辑（对应旧版地址新增/编辑表单）
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [addressEditing, setAddressEditing] = useState<CheckAddress | null>(null);
  const [addressForm, setAddressForm] = useState<{ contact: string; mobile: string; address: string; regionId?: number | string }>({
    contact: '',
    mobile: '',
    address: '',
  });
  const [addressSaving, setAddressSaving] = useState(false);

  const loadUserList = (keyword = '') => {
    apiGet<{ records?: ProxyUser[]; list?: ProxyUser[] }>('/proxyShopping/user/list', {
      page: 1,
      size: 20,
      keyword,
    })
      .then((result) => setUserList(result.records || result.list || []))
      .catch((error) => Toast.error({ content: error.message }));
  };

  const openUserDialog = () => {
    setUserKeyword('');
    loadUserList();
    setUserDialogOpen(true);
  };

  const loadProducts = (page = 1, keyword = '') => {
    setProductLoading(true);
    apiPost('/proxyShopping/product/getProduct', { page, size: 10, keyword, userId: user?.userId })
      .then((result: any) => {
        const records = result?.records || result?.list || [];
        setProducts(records);
        setProductTotal(result?.total ?? records.length);
        setProductPage(page);
      })
      .catch((error) => Toast.error({ content: error.message }))
      .finally(() => setProductLoading(false));
  };

  const loadCart = () => {
    if (!user) return;
    setCartLoading(true);
    apiPost('/proxyShopping/cart/list', { userId: user.userId })
      .then((result) => setCartItems(flattenCart(result)))
      .catch((error) => Toast.error({ content: error.message }))
      .finally(() => setCartLoading(false));
  };

  useEffect(() => {
    loadProducts(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) loadCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

  /** 选择商品：多规格先弹规格弹窗（对齐旧版 ProductSpecPop），单规格直接加购。 */
  const chooseProduct = async (product: ProxyProduct) => {
    if (!user) {
      Toast.warning({ content: t('请先选择下单会员') });
      return;
    }
    if (product.isTimeDiscount === 1) return;
    try {
      const result = await apiGet<{ records?: SkuRow[] }>('/product/product/skuList', {
        id: product.productId,
        page: 1,
        size: 100,
      });
      const skus = (result?.records || []).filter((item) => Number(item.skuId || 0) > 0 && Number(item.isEnabled ?? 1) !== 0);
      if (skus.length > 1) {
        setSpecTarget(product);
        setSpecRows(skus);
        setSpecSkuId(undefined);
        setSpecNumber(1);
        return;
      }
      await addToCart(product, skus[0]?.skuId);
    } catch {
      await addToCart(product, undefined);
    }
  };

  const addToCart = async (product: ProxyProduct, skuId?: number, number = 1) => {
    if (!user) {
      Toast.warning({ content: t('请先选择下单会员') });
      return;
    }
    try {
      await apiPost('/proxyShopping/cart/addToCart', {
        userId: user.userId,
        id: product.productId,
        number,
        skuId,
      });
      Toast.success({ content: t('已加入已选商品') });
      setSpecTarget(null);
      loadCart();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加入失败') });
    }
  };

  const updateQty = async (item: ProxyCartItem, quantity: number) => {
    try {
      await apiPost('/proxyShopping/cart/updateItem', {
        cartId: item.cartId,
        data: { quantity },
      });
      loadCart();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('更新失败') });
    }
  };

  const removeCart = async (item: ProxyCartItem) => {
    try {
      await apiPost('/proxyShopping/cart/removeItem', {
        userId: user?.userId,
        cartIds: [item.cartId],
      });
      loadCart();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('移除失败') });
    }
  };

  /** 行改价（对齐旧版 AlterPriceDrawer：一口价改价，走 check/changePrice）。 */
  const submitChangePrice = async () => {
    if (!user || !priceTarget) return;
    try {
      await apiPost('/proxyShopping/order/check/changePrice', {
        userId: user.userId,
        isCartList: true,
        useChangePrice: true,
        cartChangePrices: [
          {
            cartId: priceTarget.cartId,
            skuId: priceTarget.skuId ?? 0,
            productId: priceTarget.productId,
            originalPrice: Number(priceTarget.price || 0) * Number(priceTarget.quantity || 1),
            changePriceValue: Number(priceValue || 0),
          },
        ],
      });
      Toast.success({ content: t('改价成功') });
      setPriceTarget(null);
      loadCart();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('改价失败') });
    }
  };

  const cartCount = cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  /** 结算/更新（对齐旧版 check/update：地址/配送/支付/抵扣/自提 一次性提交并刷新 VO）。 */
  const updateCheck = async (patch: Record<string, any>, silent = false) => {
    if (!user || !checkData) return;
    if (!silent) setCheckLoading(true);
    try {
      const result = await apiPost<any>('/proxyShopping/order/check/update', {
        userId: user.userId,
        flowType: 15,
        selectFrom: 2,
        addressId,
        deliveryType,
        payTypeId,
        usePoint,
        useBalance,
        selectUserCouponIds: selectedCouponIds,
        pickupId: deliveryType === 2 ? pickupId : undefined,
        pickupContactName: deliveryType === 2 ? pickupContactName : undefined,
        pickupContactMobile: deliveryType === 2 ? pickupContactMobile : undefined,
        buyerNote,
        ...patch,
      });
      if (result) setCheckData(result);
    } catch (error) {
      if (!silent) Toast.error({ content: error instanceof Error ? error.message : t('更新失败') });
    } finally {
      if (!silent) setCheckLoading(false);
    }
  };

  /** 更新优惠券（对齐旧版 updateCoupon）。 */
  const applyCoupon = async (ids: number[]) => {
    if (!user) return;
    setCheckLoading(true);
    try {
      const result = await apiPost<any>('/proxyShopping/order/check/updateCoupon', {
        userId: user.userId,
        flowType: 15,
        selectFrom: 3,
        selectUserCouponIds: ids,
        deliveryType,
        addressId,
        payTypeId,
        usePoint,
        useBalance,
        buyerNote,
      });
      if (result) setCheckData(result);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('优惠券更新失败') });
    } finally {
      setCheckLoading(false);
    }
  };

  const loadPickups = async () => {
    try {
      const result = await apiGet<any>('/proxyShopping/order/check/pickupList', { page: 1, size: 50 });
      setPickupRows(result?.records || result?.list || []);
    } catch {
      setPickupRows([]);
    }
  };

  const goCheck = () => {
    if (!user || !cartItems.length) return;
    setStep('check');
    setCheckLoading(true);
    apiPost<any>('/proxyShopping/order/check/index', { userId: user.userId, flowType: 15, selectFrom: 1 })
      .then(async (result) => {
        setCheckData(result);
        const addresses: CheckAddress[] = result?.addressList || result?.addressInfo?.list || [];
        const selected = addresses.find((item) => item.isSelected === 1) || addresses[0];
        if (selected?.addressId) setAddressId(selected.addressId);
        if (result?.deliveryOption?.deliveryType) setDeliveryType(Number(result.deliveryOption.deliveryType));
        let payments: CheckPaymentType[] = result?.paymentTypes || [];
        if (!payments.length) {
          // check/index 未携带支付方式时，按 flowType 显式获取
          try {
            const res = await apiGet<any>(
              '/proxyShopping/order/check/getAvailablePaymentType',
              { flowType: Number(result?.flowType ?? 15) },
            );
            payments = Array.isArray(res) ? res : res?.paymentTypes || [];
          } catch {
            payments = [];
          }
        }
        if (payments.length) setPayTypeId(Number(payments[0].payTypeId ?? payments[0].payType ?? 0));
        const coupons = result?.couponList?.enableCoupons || result?.coupon_list?.enableCoupons || [];
        const defaultIds = result?.selectUserCouponIds || result?.select_user_coupon_ids || [];
        if (defaultIds.length) setSelectedCouponIds(defaultIds.map(Number));
        else if (coupons.length && result?.useDefaultCouponIds === 1) setSelectedCouponIds([Number(coupons[0].id)]);
        if (Number(result?.deliveryOption?.deliveryType) === 2) loadPickups();
      })
      .catch((error) => {
        Toast.error({ content: error.message });
        setStep('index');
      })
      .finally(() => setCheckLoading(false));
  };

  const submitOrder = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const result = await apiPost<{ orderId?: number; orderSn?: string }>(
        '/proxyShopping/order/check/submit',
        {
          userId: user.userId,
          flowType: 15,
          selectFrom: 4,
          addressId,
          deliveryType,
          payTypeId,
          buyerNote,
          usePoint,
          useBalance,
          selectUserCouponIds: selectedCouponIds,
          pickupId: deliveryType === 2 ? pickupId : undefined,
          pickupContactName: deliveryType === 2 ? pickupContactName : undefined,
          pickupContactMobile: deliveryType === 2 ? pickupContactMobile : undefined,
        },
      );
      Toast.success({
        content: result?.orderSn
          ? t('下单成功：{orderSn}', { orderSn: result.orderSn })
          : t('下单成功'),
      });
      setStep('index');
      setCheckData(null);
      setBuyerNote('');
      setSelectedCouponIds([]);
      setUsePoint(0);
      setUseBalance(0);
      loadCart();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('下单失败') });
    } finally {
      setSubmitting(false);
    }
  };

  const saveAddress = async () => {
    if (!user) return;
    if (!addressForm.contact.trim() || !addressForm.mobile.trim() || !addressForm.address.trim()) {
      Toast.warning({ content: t('请完整填写联系人 / 手机号 / 地址') });
      return;
    }
    setAddressSaving(true);
    try {
      const payload = {
        userId: user.userId,
        contact: addressForm.contact.trim(),
        mobile: addressForm.mobile.trim(),
        address: addressForm.address.trim(),
        regionIds: addressForm.regionId ? [Number(addressForm.regionId)] : undefined,
      };
      if (addressEditing?.addressId) {
        await apiPost('/proxyShopping/address/update', { ...payload, addressId: addressEditing.addressId });
      } else {
        await apiPost('/proxyShopping/address/create', payload);
      }
      Toast.success({ content: t('保存成功') });
      setAddressModalOpen(false);
      // 刷新结算页地址列表
      if (checkData) {
        setCheckLoading(true);
        apiPost<any>('/proxyShopping/order/check/update', {
          userId: user.userId,
          flowType: 15,
          selectFrom: 2,
          addressId,
          deliveryType,
          payTypeId,
          usePoint,
          useBalance,
          selectUserCouponIds: selectedCouponIds,
          buyerNote,
        })
          .then((result) => {
            setCheckData(result);
            const addresses: CheckAddress[] = result?.addressList || result?.addressInfo?.list || [];
            if (!addressId && addresses[0]?.addressId) setAddressId(addresses[0].addressId);
          })
          .finally(() => setCheckLoading(false));
      }
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setAddressSaving(false);
    }
  };

  const addresses: CheckAddress[] = checkData?.addressList || checkData?.addressInfo?.list || [];
  const payments: CheckPaymentType[] = checkData?.paymentTypes || [];
  const coupons: CheckCoupon[] = checkData?.couponList?.enableCoupons || checkData?.coupon_list?.enableCoupons || [];
  const totalInfo = checkData?.total || {};
  const availablePoints = Number(checkData?.availablePoints ?? checkData?.available_points ?? 0);
  const balanceUsable = Number(user?.balance ?? 0) > 0;
  const cartChangePrice = checkData?.hasChangePrice === true || checkData?.has_change_price === true;

  return (
    <div className="proxy-shopping" data-widget="proxy-shopping-flow">
      {step === 'index' ? (
        <Card shadows="hover">
          <div className="proxy-notice">
            <Text strong>{t('注意事项：')}</Text>
            <ol>
              <li>{t('1、代客下单存在支付金额与用户自主下单金额不一致的风险，请仔细核对订单金额，确保交易金额准确无误。')}</li>
              <li>{t('2、订单支付金额可在商品列表中进行修改。')}</li>
              <li>{t('3、虚拟商品、卡密商品、付费内容、礼品卡只能单独购买。')}</li>
            </ol>
          </div>

          <div className="proxy-user-row">
            {user ? (
              <div className="proxy-user-card">
                <Avatar size="extra-large" src={user.avatar || undefined}>
                  {(user.nickname || user.username || '?').slice(0, 1)}
                </Avatar>
                <div className="proxy-user-info">
                  <Title heading={6} style={{ margin: 0 }}>
                    {user.nickname || user.username || '-'}
                  </Title>
                  <Text type="tertiary">{t('手机号：')}{user.mobile || '-'}</Text>
                  <Text type="tertiary">{t('可用余额：')}{money(user.balance)}</Text>
                </div>
                <Button onClick={openUserDialog}>{t('重新选择')}</Button>
              </div>
            ) : (
              <Button theme="solid" type="primary" onClick={openUserDialog}>
                {t('选择下单会员')}
              </Button>
            )}
          </div>

          <div className="proxy-two-col">
            <div className="proxy-panel">
              <div className="proxy-panel-head">
                <Text strong>{t('全部商品')}</Text>
                <Space>
                  <Input
                    prefix={<IconSearch />}
                    placeholder={t('商品名称/编码')}
                    value={productKeyword}
                    onChange={setProductKeyword}
                    onEnterPress={() => loadProducts(1, productKeyword)}
                    style={{ width: 220 }}
                  />
                  <Button theme="solid" type="primary" onClick={() => loadProducts(1, productKeyword)}>
                    {t('搜索')}
                  </Button>
                </Space>
              </div>
              <div className="proxy-product-header">
                <span className="proxy-h-idx">{t('序号')}</span>
                <span>{t('商品/编码')}</span>
                <span className="proxy-product-cell">{t('售价(currency)')}</span>
                <span className="proxy-product-cell">{t('库存')}</span>
                <span className="proxy-product-cell">{t('操作')}</span>
              </div>
              <Spin spinning={productLoading}>
                {products.length ? (
                  products.map((product) => (
                    <div className="proxy-product-row" key={product.productId}>
                      {product.picUrl || product.picThumb ? (
                        <img src={product.picUrl || product.picThumb} alt="" />
                      ) : (
                        <div className="proxy-product-placeholder" />
                      )}
                      <div className="proxy-product-info">
                        <div>{product.productName || '-'}</div>
                        <Text type="tertiary" size="small">
                          {t('编码：')}{product.productSn || '-'}
                        </Text>
                      </div>
                      <div className="proxy-product-cell">{product.productPrice ?? '-'}</div>
                      <div className="proxy-product-cell">{product.productStock ?? '-'}</div>
                      <div className="proxy-product-cell">
                        <Button
                          theme="borderless"
                          type="primary"
                          size="small"
                          disabled={!user || product.isTimeDiscount === 1}
                          onClick={() => chooseProduct(product)}
                        >
                          {t('选择')}
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty description={productLoading ? t('加载中...') : t('暂无数据')} />
                )}
              </Spin>
              {productTotal > products.length ? (
                <Space>
                  <Button size="small" disabled={productPage <= 1} onClick={() => loadProducts(productPage - 1, productKeyword)}>
                    {t('上一页')}
                  </Button>
                  <Text type="tertiary">
                    {t('第 {page} 页 / 共 {total} 件', { page: productPage, total: productTotal })}
                  </Text>
                  <Button
                    size="small"
                    disabled={productPage >= Math.ceil(productTotal / 10)}
                    onClick={() => loadProducts(productPage + 1, productKeyword)}
                  >
                    {t('下一页')}
                  </Button>
                </Space>
              ) : null}
            </div>

            <div className="proxy-panel">
              <div className="proxy-panel-head">
                <Text strong>{t('已选商品')}{cartCount > 0 ? `（${cartCount}）` : ''}</Text>
              </div>
              <div className="proxy-product-header">
                <span className="proxy-h-idx">{t('序号')}</span>
                <span>{t('商品/编码')}</span>
                <span className="proxy-product-cell">{t('单价(currency)')}</span>
                <span className="proxy-product-cell">{t('数量')}</span>
                <span className="proxy-product-cell">{t('小计(currency)')}</span>
                <span className="proxy-product-cell">{t('操作')}</span>
              </div>
              <Spin spinning={cartLoading}>
                {cartItems.length ? (
                  cartItems.map((item) => (
                    <div className="proxy-product-row" key={item.cartId}>
                      {item.picThumb ? <img src={item.picThumb} alt="" /> : <div className="proxy-product-placeholder" />}
                      <div className="proxy-product-info">
                        <div>{item.productName || '-'}</div>
                        {item.skuData ? (
                          <Text type="tertiary" size="small">
                            {item.skuData}
                          </Text>
                        ) : null}
                        <Text type="tertiary" size="small">
                          {t('编码：')}{item.productSn || '-'}
                        </Text>
                      </div>
                      <div className="proxy-product-cell">{item.price != null ? money(item.price) : '-'}</div>
                      <div className="proxy-product-cell">
                        <InputNumber
                          size="small"
                          min={1}
                          precision={0}
                          style={{ width: 100 }}
                          value={Number(item.quantity || 1)}
                          onChange={(next) => updateQty(item, Number(next || 1))}
                        />
                      </div>
                      <div className="proxy-product-cell">{item.subtotal != null ? money(item.subtotal) : '-'}</div>
                      <div className="proxy-product-cell">
                        <Space spacing={2}>
                          <Button
                            theme="borderless"
                            size="small"
                            onClick={() => {
                              setPriceTarget(item);
                              setPriceValue(Number(item.price || 0));
                            }}
                          >
                            {t('改价')}
                          </Button>
                          <Button theme="borderless" type="danger" size="small" onClick={() => removeCart(item)}>
                            {t('移除')}
                          </Button>
                        </Space>
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty description={user ? t('暂无已选商品') : t('请先选择下单会员')} />
                )}
              </Spin>
              <div className="proxy-checkout-row">
                <Button theme="solid" type="primary" disabled={!user || !cartItems.length} onClick={goCheck}>
                  {t('结算')}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card
          shadows="hover"
          title={t('确认订单信息')}
          headerExtraContent={
            <Button onClick={() => setStep('index')}>{t('返回修改商品')}</Button>
          }
        >
          <Spin spinning={checkLoading}>
            <div className="proxy-check-grid">
              <div className="proxy-check-section">
                <Text strong>{t('收货地址')}</Text>
                {addresses.length ? (
                  <RadioGroup value={addressId} onChange={(e) => { const next = Number(e.target.value); setAddressId(next); updateCheck({ addressId: next }); }}>
                    {addresses.map((addr) => (
                      <Radio key={addr.addressId} value={Number(addr.addressId)}>
                        {addr.contact} {addr.mobile}（
                        {addr.regionNames || addr.address}
                        {addr.address || ''}）
                      </Radio>
                    ))}
                  </RadioGroup>
                ) : (
                  <Text type="tertiary">{t('该会员暂无收货地址')}</Text>
                )}
                <Space style={{ marginTop: 8 }}>
                  <Button
                    size="small"
                    onClick={() => {
                      setAddressEditing(null);
                      setAddressForm({ contact: user?.nickname || '', mobile: user?.mobile || '', address: '' });
                      setAddressModalOpen(true);
                    }}
                  >
                    {t('新增地址')}
                  </Button>
                  {addresses.map((addr) => (
                    <Button
                      key={`edit-${addr.addressId}`}
                      size="small"
                      theme="borderless"
                      onClick={() => {
                        setAddressEditing(addr);
                        setAddressForm({ contact: addr.contact || '', mobile: addr.mobile || '', address: addr.address || '' });
                        setAddressModalOpen(true);
                      }}
                    >
                      {t('编辑')}（{addr.contact || addr.addressId}）
                    </Button>
                  ))}
                </Space>
              </div>
              <div className="proxy-check-section">
                <Text strong>{t('配送方式')}</Text>
                <RadioGroup
                  value={deliveryType}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setDeliveryType(next);
                    if (next === 2 && pickupRows.length === 0) loadPickups();
                    updateCheck({ deliveryType: next });
                  }}
                >
                  <Radio value={1}>{t('物流快递')}</Radio>
                  <Radio value={2}>{t('到店自提')}</Radio>
                  <Radio value={3}>{t('同城配送')}</Radio>
                </RadioGroup>
                {/* 自提点与自提联系人（对齐旧版 CheckPanel pickupList/pickupContact） */}
                {Number(deliveryType) === 2 && (
                  <div style={{ marginTop: 8 }}>
                    <Select
                      style={{ width: 320 }}
                      placeholder={t('请选择自提点')}
                      value={pickupId}
                      optionList={pickupRows.map((row) => ({
                        label: `${row.pickupName || row.name || ''}（${row.address || ''}）`,
                        value: Number(row.pickupId ?? row.id),
                      }))}
                      onChange={(next: any) => {
                        setPickupId(Number(next));
                        updateCheck({ pickupId: Number(next) });
                      }}
                    />
                    <Space style={{ marginTop: 8 }} wrap>
                      <Input
                        style={{ width: 150 }}
                        placeholder={t('自提联系人')}
                        value={pickupContactName}
                        onChange={setPickupContactName}
                        onBlur={() => updateCheck({ pickupContactName }, true)}
                      />
                      <Input
                        style={{ width: 170 }}
                        placeholder={t('自提联系电话')}
                        value={pickupContactMobile}
                        onChange={setPickupContactMobile}
                        onBlur={() => updateCheck({ pickupContactMobile }, true)}
                      />
                    </Space>
                  </div>
                )}
              </div>
              <div className="proxy-check-section">
                <Text strong>{t('支付方式')}</Text>
                {payments.length ? (
                  <RadioGroup value={payTypeId} onChange={(e) => { const next = Number(e.target.value); setPayTypeId(next); updateCheck({ payTypeId: next }); }}>
                    {payments.map((pay) => (
                      <Radio key={pay.payTypeId ?? pay.name} value={Number(pay.payTypeId ?? 0)}>
                        {pay.name || t('支付方式{n}', { n: pay.payTypeId ?? '' })}
                      </Radio>
                    ))}
                  </RadioGroup>
                ) : (
                  <Text type="tertiary">{t('无可用支付方式')}</Text>
                )}
              </div>
              <div className="proxy-check-section">
                <Text strong>{t('优惠券')}</Text>
                {coupons.length ? (
                  <RadioGroup
                    value={selectedCouponIds[0] ?? 0}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      const ids = id > 0 ? [id] : [];
                      setSelectedCouponIds(ids);
                      applyCoupon(ids);
                    }}
                  >
                    <Radio value={0}>{t('不使用优惠券')}</Radio>
                    {coupons.map((coupon) => (
                      <Radio key={coupon.id ?? coupon.couponId} value={Number(coupon.id ?? coupon.couponId ?? 0)}>
                        {coupon.couponName || t('优惠券')}
                        {coupon.couponPrice != null ? `（- ${money(coupon.couponPrice)}）` : ''}
                      </Radio>
                    ))}
                  </RadioGroup>
                ) : (
                  <Text type="tertiary">{t('暂无可用优惠券')}</Text>
                )}
              </div>
              <div className="proxy-check-section">
                <Text strong>{t('抵扣')}</Text>
                <Space wrap>
                  <span>
                    {t('积分抵扣')}
                    {availablePoints > 0 ? <Tag size="small" style={{ marginLeft: 4 }}>{availablePoints}</Tag> : null}
                  </span>
                  <Switch
                    disabled={availablePoints <= 0}
                    checked={usePoint === 1}
                    onChange={(checked) => {
                      const next = checked ? 1 : 0;
                      setUsePoint(next);
                      updateCheck({ usePoint: next });
                    }}
                  />
                  <span>{t('余额抵扣')}</span>
                  <Switch
                    disabled={!balanceUsable}
                    checked={Number(useBalance) > 0}
                    onChange={(checked) => {
                      const next = checked ? Number(user?.balance || 0) : 0;
                      setUseBalance(next);
                      updateCheck({ useBalance: next });
                    }}
                  />
                  {Number(useBalance) > 0 ? (
                    <Text type="tertiary" size="small">
                      {t('使用 {amount}', { amount: money(useBalance) })}
                    </Text>
                  ) : null}
                </Space>
              </div>
              <div className="proxy-check-section">
                <Text strong>{t('订单备注')}</Text>
                <TextArea value={buyerNote} onChange={setBuyerNote} placeholder={t('买家备注')} />
              </div>
              <div className="proxy-check-section proxy-check-amount">
                {checkData?.totalAmount != null && (
                  <span>
                    {t('商品总额：')}<b>{money(totalInfo.goodsAmount ?? checkData.totalAmount)}</b>
                  </span>
                )}
                {cartChangePrice && <Tag color="orange">{t('已改价')}</Tag>}
                {checkData?.discountAmount != null && (
                  <span>
                    {t('优惠：')}<b>{money(checkData.discountAmount)}</b>
                  </span>
                )}
                {checkData?.payAmount != null && (
                  <Tag color="red" size="large">
                    {t('应付：')}{money(checkData.payAmount)}
                  </Tag>
                )}
                <Button
                  theme="solid"
                  type="primary"
                  loading={submitting}
                  disabled={!checkData}
                  onClick={submitOrder}
                >
                  {t('提交订单')}
                </Button>
              </div>
            </div>
          </Spin>
        </Card>
      )}

      <Modal
        title={t('选择下单会员')}
        visible={userDialogOpen}
        footer={null}
        onCancel={() => setUserDialogOpen(false)}
        width={560}
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Input
            placeholder={t('会员名称/手机号')}
            value={userKeyword}
            onChange={setUserKeyword}
            onEnterPress={() => loadUserList(userKeyword)}
          />
          <Button theme="solid" type="primary" onClick={() => loadUserList(userKeyword)}>
            {t('搜索')}
          </Button>
        </div>
        <div className="proxy-user-list">
          {userList.map((item) => (
            <div
              key={item.userId}
              className="proxy-user-row-item"
              onClick={() => {
                setUser(item);
                setUserDialogOpen(false);
              }}
            >
              <Avatar size="default" src={item.avatar || undefined}>
                {(item.nickname || item.username || '?').slice(0, 1)}
              </Avatar>
              <div className="proxy-user-info">
                <div>{item.nickname || item.username || '-'}</div>
                <Text type="tertiary" size="small">
                  {item.mobile || '-'} · {t('余额')} {money(item.balance)}
                </Text>
              </div>
              <Button size="small">{t('选择')}</Button>
            </div>
          ))}
          {!userList.length ? <Empty description={t('暂无匹配会员')} /> : null}
        </div>
      </Modal>

      {/* SKU 规格弹窗（对应旧版 ProductSpecPop） */}
      <Modal
        title={specTarget ? `${t('选择规格')}：${specTarget.productName || ''}` : t('选择规格')}
        visible={Boolean(specTarget)}
        footer={null}
        onCancel={() => setSpecTarget(null)}
        width={620}
      >
        <div style={{ display: 'grid', gap: 8 }}>
          {specRows.map((sku) => (
            <div
              key={sku.skuId}
              className={`proxy-spec-row ${specSkuId === sku.skuId ? 'is-active' : ''}`}
              onClick={() => setSpecSkuId(sku.skuId)}
            >
              <Radio checked={specSkuId === sku.skuId} />
              <span>{sku.skuValue || t('默认规格')}</span>
              <span className="proxy-spec-price">{money(sku.skuPrice ?? specTarget?.productPrice ?? 0)}</span>
              <span className="proxy-spec-stock">
                {t('库存')} {sku.skuStock ?? '-'}
              </span>
            </div>
          ))}
          <Space>
            <span>{t('数量')}</span>
            <InputNumber
              style={{ width: 120 }}
              min={1}
              precision={0}
              value={specNumber}
              onChange={(next) => setSpecNumber(Number(next || 1))}
            />
            <Button
              theme="solid"
              type="primary"
              disabled={!specSkuId}
              onClick={() => specTarget && addToCart(specTarget, specSkuId, specNumber)}
            >
              {t('加入已选商品')}
            </Button>
          </Space>
        </div>
      </Modal>

      {/* 行改价弹窗（对应旧版 AlterPriceDrawer） */}
      <Modal
        title={priceTarget ? `${t('订单改价')}：${priceTarget.productName || ''}` : t('订单改价')}
        visible={Boolean(priceTarget)}
        onOk={submitChangePrice}
        onCancel={() => setPriceTarget(null)}
        okText={t('确定')}
        cancelText={t('取消')}
        width={440}
      >
        {priceTarget && (
          <div style={{ display: 'grid', gap: 8 }}>
            <Text type="tertiary">
              {t('原价：')}{money(Number(priceTarget.price || 0) * Number(priceTarget.quantity || 1))}
              {' · '}{t('数量')}：{priceTarget.quantity}
            </Text>
            <InputNumber
              style={{ width: 220 }}
              min={0}
              precision={2}
              value={priceValue}
              onChange={(next) => setPriceValue(Number(next ?? 0))}
              addonBefore="¥"
            />
          </div>
        )}
      </Modal>

      {/* 地址新增/编辑（对齐旧版地址表单） */}
      <Modal
        title={addressEditing ? t('编辑收货地址') : t('新增收货地址')}
        visible={addressModalOpen}
        onOk={saveAddress}
        okButtonProps={{ loading: addressSaving }}
        onCancel={() => setAddressModalOpen(false)}
        okText={t('保存')}
        cancelText={t('取消')}
        width={520}
      >
        <div style={{ display: 'grid', gap: 10 }}>
          <span>{t('联系人')}</span>
          <Input value={addressForm.contact} onChange={(next) => setAddressForm((c) => ({ ...c, contact: next }))} />
          <span>{t('手机号码')}</span>
          <Input value={addressForm.mobile} onChange={(next) => setAddressForm((c) => ({ ...c, mobile: next }))} />
          <span>{t('所在地区')}</span>
          <RegionSelect
            value={addressForm.regionId}
            onChange={(next) => setAddressForm((c) => ({ ...c, regionId: next }))}
          />
          <span>{t('详细地址')}</span>
          <TextArea
            value={addressForm.address}
            onChange={(next) => setAddressForm((c) => ({ ...c, address: next }))}
            autosize={{ minRows: 2, maxRows: 4 }}
          />
        </div>
      </Modal>
    </div>
  );
}
