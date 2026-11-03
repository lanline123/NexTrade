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
  Space,
  Spin,
  Tag,
  TextArea,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '../api';
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

/** 代客下单：对应旧版 order/proxyShopping/Index.vue + CheckPanel.vue（核心下单流程）。 */
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

  const addToCart = async (product: ProxyProduct) => {
    if (!user) {
      Toast.warning({ content: t('请先选择下单会员') });
      return;
    }
    try {
      await apiPost('/proxyShopping/cart/addToCart', {
        userId: user.userId,
        id: product.productId,
        number: 1,
      });
      Toast.success({ content: t('已加入已选商品') });
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

  const cartCount = cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const goCheck = () => {
    if (!user || !cartItems.length) return;
    setStep('check');
    setCheckLoading(true);
    apiPost<any>('/proxyShopping/order/check/index', { userId: user.userId })
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
              { flowType: Number(result?.flowType ?? 0) },
            );
            payments = Array.isArray(res) ? res : res?.paymentTypes || [];
          } catch {
            payments = [];
          }
        }
        if (payments.length) setPayTypeId(Number(payments[0].payTypeId ?? payments[0].payType ?? 0));
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
          addressId,
          deliveryType,
          payTypeId,
          buyerNote,
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
      loadCart();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('下单失败') });
    } finally {
      setSubmitting(false);
    }
  };

  const addresses: CheckAddress[] = checkData?.addressList || checkData?.addressInfo?.list || [];
  const payments: CheckPaymentType[] = checkData?.paymentTypes || [];
  const totalInfo = checkData?.total || {};

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
                          onClick={() => addToCart(product)}
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
                        <Button theme="borderless" type="danger" size="small" onClick={() => removeCart(item)}>
                          {t('移除')}
                        </Button>
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
                  <RadioGroup value={addressId} onChange={(e) => setAddressId(Number(e.target.value))}>
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
              </div>
              <div className="proxy-check-section">
                <Text strong>{t('配送方式')}</Text>
                <RadioGroup
                  value={deliveryType}
                  onChange={(e) => setDeliveryType(Number(e.target.value))}
                >
                  <Radio value={1}>{t('物流快递')}</Radio>
                  <Radio value={2}>{t('到店自提')}</Radio>
                  <Radio value={3}>{t('同城配送')}</Radio>
                </RadioGroup>
              </div>
              <div className="proxy-check-section">
                <Text strong>{t('支付方式')}</Text>
                {payments.length ? (
                  <RadioGroup value={payTypeId} onChange={(e) => setPayTypeId(Number(e.target.value))}>
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
                <Text strong>{t('订单备注')}</Text>
                <TextArea value={buyerNote} onChange={setBuyerNote} placeholder={t('买家备注')} />
              </div>
              <div className="proxy-check-section proxy-check-amount">
                {checkData?.totalAmount != null && (
                  <span>
                    {t('商品总额：')}<b>{money(totalInfo.goodsAmount ?? checkData.totalAmount)}</b>
                  </span>
                )}
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
    </div>
  );
}
