/**
 * 订单详情补充弹窗集合（补齐老版 views/order/order/src 下未迁移的悬浮窗）：
 *
 * - EditConsigneeModal   修改收货人（modifyConsignee，含地区选择）
 * - EditShippingModal    修改物流（modifyShipping）
 * - EditProductModal     修改商品（modifyProduct，行内改价/数量 + 添加商品 getAddProductInfo）
 * - OperationLogModal    操作日志（order/orderLog/list）
 * - PaymentLogModal      支付记录（finance/payLog/list，按订单号过滤）
 * - LogisticsTraceModal  物流跟踪（order/order/shippingInfo）
 * - SubOrderModal        子订单（order/order/list?orderIds=，parentDetail 拆单）
 * - WriteOffModal        扫码核销（order/order/writeOff?pickupSn=）
 * - DeliveryPhotoSection 配送/服务照片展示（O2O，detail.deliveryInfo）
 */

import { useEffect, useState } from 'react';
import {
  Avatar,
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  SideSheet,
  Space,
  Spin,
  Steps,
  Table,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconPlus, IconSearch } from '@douyinfe/semi-icons';
import { apiGet, apiPost, isDemo } from '../api';
import { useI18n } from '../i18n';
import RegionSelect from './RegionSelect';

const { Text } = Typography;

export interface OrderDetailLike extends Record<string, any> {
  orderId: number;
  orderSn: string;
  orderStatus?: number;
  items?: Array<Record<string, any>>;
  deliveryInfo?: Record<string, any> | null;
}

export interface LogisticsOption {
  id: number;
  name: string;
}

/* ============================== 修改收货人 ============================== */

interface ConsigneeValues {
  consignee?: string;
  mobile?: string;
  telephone?: string;
  email?: string;
  postcode?: string;
  address?: string;
  regionId?: number | string;
}

export function EditConsigneeModal({
  visible,
  detail,
  onCancel,
  onSuccess,
}: {
  visible: boolean;
  detail: OrderDetailLike | null;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [formApi, setFormApi] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && formApi && detail) {
      formApi.setValues(
        {
          consignee: detail.consignee || '',
          mobile: detail.mobile || '',
          telephone: detail.telephone || '',
          email: detail.email || '',
          postcode: detail.postcode || '',
          address: detail.address || '',
        },
        { isOverride: true },
      );
    }
  }, [visible, formApi, detail]);

  const submit = async () => {
    if (!detail || !formApi) return;
    let values: Record<string, any>;
    try {
      values = await formApi.validate();
    } catch {
      return;
    }
    setSaving(true);
    try {
      await apiPost('/order/order/modifyConsignee', {
        id: detail.orderId,
        consignee: values.consignee,
        mobile: values.mobile,
        telephone: values.telephone,
        email: values.email,
        postcode: values.postcode,
        regionIds: values.regionId ? [Number(values.regionId)] : undefined,
        address: values.address,
      });
      Toast.success({ content: t('收货信息已更新') });
      onSuccess();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={t('修改收货人')}
      visible={visible}
      onCancel={onCancel}
      width={560}
      footer={
        <Space>
          <Button onClick={onCancel}>{t('取消')}</Button>
          <Button theme="solid" type="primary" loading={saving} onClick={submit}>
            {t('保存')}
          </Button>
        </Space>
      }
    >
      <Form getFormApi={setFormApi} labelPosition="top">
        <Form.Input field="consignee" label={t('收货人')} rules={[{ required: true, message: t('请输入收货人') }]} />
        <Form.Input field="mobile" label={t('手机号码')} rules={[{ required: true, message: t('请输入手机号码') }]} />
        <Form.Input field="telephone" label={t('电话')} />
        <Form.Input field="email" label={t('邮箱地址')} />
        <Form.Input field="postcode" label={t('邮政编码')} />
        <Form.Slot label={t('所在地区')}>
          <RegionSelect
            value={(formApi?.getValues?.() as ConsigneeValues)?.regionId}
            onChange={(next) => formApi?.setValue?.('regionId', next)}
          />
        </Form.Slot>
        <Form.TextArea field="address" label={t('详细地址')} rules={[{ required: true, message: t('请输入详细地址') }]} />
      </Form>
    </Modal>
  );
}

/* ============================== 修改物流 ============================== */

export function EditShippingModal({
  visible,
  detail,
  logistics,
  onCancel,
  onSuccess,
}: {
  visible: boolean;
  detail: OrderDetailLike | null;
  logistics: LogisticsOption[];
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [formApi, setFormApi] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && formApi && detail) {
      formApi.setValues(
        {
          shippingMethod: detail.shippingTypeId || 1,
          logisticsId: detail.logisticsId,
          trackingNo: detail.trackingNo || '',
        },
        { isOverride: true },
      );
    }
  }, [visible, formApi, detail]);

  const submit = async () => {
    if (!detail || !formApi) return;
    let values: Record<string, any>;
    try {
      values = await formApi.validate();
    } catch {
      return;
    }
    setSaving(true);
    try {
      await apiPost('/order/order/modifyShipping', {
        id: detail.orderId,
        shippingMethod: Number(values.shippingMethod || 1),
        logisticsId: Number(values.shippingMethod) === 1 || Number(values.shippingMethod) === 4 ? Number(values.logisticsId) : undefined,
        trackingNo: Number(values.shippingMethod) === 1 ? values.trackingNo : undefined,
      });
      Toast.success({ content: t('物流信息已更新') });
      onSuccess();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={t('修改物流')}
      visible={visible}
      onCancel={onCancel}
      width={520}
      footer={
        <Space>
          <Button onClick={onCancel}>{t('取消')}</Button>
          <Button theme="solid" type="primary" loading={saving} onClick={submit}>
            {t('保存')}
          </Button>
        </Space>
      }
    >
      <Form getFormApi={setFormApi} labelPosition="top">
        <Form.Select
          field="shippingMethod"
          label={t('配送方式')}
          optionList={[
            { label: t('物流配送'), value: 1 },
            { label: t('商家配送'), value: 2 },
            { label: t('无需配送'), value: 3 },
            { label: t('电子面单'), value: 4 },
          ]}
        />
        <Form.Select
          field="logisticsId"
          label={t('物流公司')}
          filter
          optionList={logistics.map((item) => ({ label: item.name, value: item.id }))}
        />
        <Form.Input field="trackingNo" label={t('快递单号')} />
      </Form>
    </Modal>
  );
}

/* ============================== 修改商品 ============================== */

interface EditableItem extends Record<string, any> {
  itemId?: number;
  productId?: number;
  productName?: string;
  productSn?: string;
  picThumb?: string;
  price: number | string;
  quantity: number;
  deliveryQuantity?: number;
}

export function EditProductModal({
  visible,
  detail,
  onCancel,
  onSuccess,
}: {
  visible: boolean;
  detail: OrderDetailLike | null;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [items, setItems] = useState<EditableItem[]>([]);
  const [addKeyword, setAddKeyword] = useState('');
  const [addCandidates, setAddCandidates] = useState<Array<Record<string, any>>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && detail) {
      setItems(
        (detail.items || []).map((item: Record<string, any>) => ({
          ...item,
          price: Number(item.price || 0),
          quantity: Number(item.quantity || 0),
        })),
      );
      setAddCandidates([]);
      setAddKeyword('');
    }
  }, [visible, detail]);

  const updateItem = (index: number, patch: Partial<EditableItem>) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeItem = (index: number) => {
    setItems((current) => current.filter((_, i) => i !== index));
  };

  const searchAddProduct = async () => {
    const keyword = addKeyword.trim();
    if (!keyword) return;
    try {
      const result = await apiPost<any>('/order/order/getAddProductInfo', {
        keyword,
        productIds: [],
      });
      setAddCandidates(result?.products || result?.records || (Array.isArray(result) ? result : []));
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('查询商品失败') });
    }
  };

  const addCandidate = (product: Record<string, any>) => {
    setItems((current) => [
      ...current,
      {
        itemId: 0,
        productId: product.productId ?? product.id,
        productName: product.productName ?? product.name,
        productSn: product.productSn ?? product.sn,
        picThumb: product.picThumb ?? product.pic,
        price: Number(product.price ?? product.shopPrice ?? 0),
        quantity: 1,
        deliveryQuantity: 0,
      },
    ]);
    setAddCandidates((current) => current.filter((item) => item !== product));
  };

  const submit = async () => {
    if (!detail) return;
    if (items.length === 0) {
      Toast.warning({ content: t('请至少保留一个商品') });
      return;
    }
    if (items.some((item) => Number(item.quantity) <= 0)) {
      Toast.warning({ content: t('商品数量必须大于0') });
      return;
    }
    setSaving(true);
    try {
      await apiPost('/order/order/modifyProduct', {
        id: detail.orderId,
        items: items.map((item) => ({
          itemId: Number(item.itemId || 0),
          productId: item.productId,
          productName: item.productName,
          productSn: item.productSn,
          picThumb: item.picThumb,
          price: String(item.price),
          quantity: Number(item.quantity),
        })),
      });
      Toast.success({ content: t('商品明细已更新') });
      onSuccess();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={t('修改商品')}
      visible={visible}
      onCancel={onCancel}
      width={860}
      footer={
        <Space>
          <Button onClick={onCancel}>{t('取消')}</Button>
          <Button theme="solid" type="primary" loading={saving} onClick={submit}>
            {t('保存')}
          </Button>
        </Space>
      }
    >
      <Table<EditableItem>
        dataSource={items}
        pagination={false}
        rowKey={(record?: EditableItem, index?: number) => String(record?.itemId ?? `new-${index ?? 0}`)}
        columns={[
          {
            title: t('商品'),
            dataIndex: 'productName',
            render: (value: string, record: EditableItem) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {record.picThumb ? <Avatar shape="square" src={record.picThumb} size="small" /> : null}
                <div>
                  <div>{value || '--'}</div>
                  <Text type="tertiary" size="small">{record.productSn}</Text>
                </div>
              </div>
            ),
          },
          {
            title: t('单价'),
            dataIndex: 'price',
            width: 140,
            render: (value: unknown, record: EditableItem, index?: number) => (
              <InputNumber
                style={{ width: 110 }}
                min={0}
                precision={2}
                value={Number(value || 0)}
                onChange={(next) => index !== undefined && updateItem(index, { price: Number(next ?? 0) })}
              />
            ),
          },
          {
            title: t('数量'),
            dataIndex: 'quantity',
            width: 120,
            render: (value: unknown, record: EditableItem, index?: number) => (
              <InputNumber
                style={{ width: 90 }}
                min={1}
                precision={0}
                value={Number(value || 1)}
                onChange={(next) => index !== undefined && updateItem(index, { quantity: Number(next ?? 1) })}
              />
            ),
          },
          {
            title: t('操作'),
            width: 90,
            render: (_value: unknown, _record: EditableItem, index?: number) => (
              <Popconfirm title={t('确定删除该商品？')} onConfirm={() => { if (index !== undefined) removeItem(index); }}>
                <Button theme="borderless" type="danger" size="small">{t('删除')}</Button>
              </Popconfirm>
            ),
          },
        ] as any}
      />

      <div style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('添加商品')}</div>
        <Space>
          <Input
            prefix={<IconSearch />}
            style={{ width: 260 }}
            placeholder={t('搜索商品名称 / 编号')}
            value={addKeyword}
            showClear
            onClear={() => setAddKeyword('')}
            onChange={(next) => setAddKeyword(next)}
            onEnterPress={searchAddProduct}
          />
          <Button icon={<IconSearch />} onClick={searchAddProduct}>{t('搜索')}</Button>
        </Space>
        {addCandidates.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {addCandidates.map((product, index) => (
              <div
                key={`${product.productId ?? product.id ?? index}`}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--semi-color-border)' }}
              >
                {product.picThumb || product.pic ? (
                  <Avatar shape="square" src={product.picThumb || product.pic} size="small" />
                ) : null}
                <div style={{ flex: 1 }}>
                  <div>{product.productName ?? product.name}</div>
                  <Text type="tertiary" size="small">¥ {Number(product.price ?? product.shopPrice ?? 0).toFixed(2)}</Text>
                </div>
                <Button size="small" onClick={() => addCandidate(product)}>{t('添加')}</Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ============================== 操作日志 ============================== */

interface OrderLogRow extends Record<string, any> {
  logId?: number;
  content?: string;
  addTime?: string;
  userName?: string;
}

export function OperationLogModal({
  visible,
  detail,
  onCancel,
}: {
  visible: boolean;
  detail: OrderDetailLike | null;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [rows, setRows] = useState<OrderLogRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !detail) return;
    setLoading(true);
    apiGet<any>('/order/orderLog/list', { orderId: detail.orderId, page: 1, size: 50 })
      .then((result) => setRows(result?.records || []))
      .catch((error) => Toast.error({ content: error?.message || t('加载操作日志失败') }))
      .finally(() => setLoading(false));
  }, [visible, detail, t]);

  return (
    <Modal title={t('操作日志')} visible={visible} onCancel={onCancel} footer={null} width={640}>
      <Table<OrderLogRow>
        loading={loading}
        dataSource={rows}
        pagination={false}
        rowKey={(record?: OrderLogRow, index?: number) => String(record?.logId ?? index ?? 0)}
        columns={[
          { title: t('时间'), dataIndex: 'addTime', width: 170, render: (v: string) => v || '--' },
          { title: t('操作人'), dataIndex: 'userName', width: 120, render: (v: string) => v || '--' },
          { title: t('内容'), dataIndex: 'content', render: (v: string) => v || '--' },
        ] as any}
      />
    </Modal>
  );
}

/* ============================== 支付记录 ============================== */

interface PayLogRow extends Record<string, any> {
  payLogId?: number;
  paySn?: string;
  outTradeSn?: string;
  payMethod?: string;
  money?: number | string;
  status?: number;
  statusName?: string;
  addTime?: string;
}

export function PaymentLogModal({
  visible,
  detail,
  onCancel,
}: {
  visible: boolean;
  detail: OrderDetailLike | null;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [rows, setRows] = useState<PayLogRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !detail) return;
    setLoading(true);
    apiGet<any>('/finance/payLog/list', { orderId: detail.orderId, page: 1, size: 50 })
      .then((result) => setRows(result?.records || []))
      .catch((error) => Toast.error({ content: error?.message || t('加载支付记录失败') }))
      .finally(() => setLoading(false));
  }, [visible, detail, t]);

  return (
    <Modal title={t('支付记录')} visible={visible} onCancel={onCancel} footer={null} width={720}>
      <Table<PayLogRow>
        loading={loading}
        dataSource={rows}
        pagination={false}
        rowKey={(record?: PayLogRow, index?: number) => String(record?.payLogId ?? index ?? 0)}
        columns={[
          { title: t('支付单号'), dataIndex: 'paySn', width: 200, render: (v: string) => v || '--' },
          { title: t('支付方式'), dataIndex: 'payMethod', width: 120, render: (v: string) => v || '--' },
          {
            title: t('金额'),
            dataIndex: 'money',
            width: 110,
            render: (v: unknown) => `¥ ${Number(v || 0).toFixed(2)}`,
          },
          { title: t('状态'), dataIndex: 'statusName', width: 100, render: (v: string) => v || '--' },
          { title: t('时间'), dataIndex: 'addTime', width: 170, render: (v: string) => v || '--' },
        ] as any}
      />
    </Modal>
  );
}

/* ============================== 物流跟踪 ============================== */

interface ShippingTrace {
  action?: string;
  acceptTime?: string;
  acceptStation?: string;
  location?: string;
}

export function LogisticsTraceModal({
  visible,
  detail,
  onCancel,
}: {
  visible: boolean;
  detail: OrderDetailLike | null;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [traces, setTraces] = useState<ShippingTrace[]>([]);
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    if (!visible || !detail) return;
    setLoading(true);
    apiGet<any>('/order/order/shippingInfo', { id: detail.orderId })
      .then((result) => {
        setTraces(result?.traces || []);
        setDegraded(result?.success === '0');
      })
      .catch((error) => Toast.error({ content: error?.message || t('加载物流信息失败') }))
      .finally(() => setLoading(false));
  }, [visible, detail, t]);

  return (
    <Modal title={t('物流跟踪')} visible={visible} onCancel={onCancel} footer={null} width={560}>
      <Spin spinning={loading}>
        {degraded && (
          <Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 12 }}>
            {t('当前未接入第三方物流查询，以下为运单快照信息。')}
          </Text>
        )}
        {traces.length === 0 && !loading && (
          <Empty description={t('暂无物流轨迹')} style={{ padding: 32 }} />
        )}
        {traces.length > 0 && (
          <Steps direction="vertical" style={{ padding: '8px 0' }}>
            {traces.map((trace, index) => (
              <Steps.Step
                key={index}
                title={trace.acceptTime || ''}
                description={
                  <div>
                    <div>{trace.action || trace.acceptStation || '--'}</div>
                    {trace.location ? <Text type="tertiary" size="small">{trace.location}</Text> : null}
                  </div>
                }
              />
            ))}
          </Steps>
        )}
      </Spin>
    </Modal>
  );
}

/* ============================== 子订单 ============================== */

interface SubOrderRow extends Record<string, any> {
  orderId?: number;
  orderSn?: string;
  orderStatusName?: string;
  totalAmount?: number | string;
  consignee?: string;
  addTime?: string;
  items?: Array<Record<string, any>>;
}

export function SubOrderModal({
  visible,
  detail,
  onCancel,
}: {
  visible: boolean;
  detail: OrderDetailLike | null;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [rows, setRows] = useState<SubOrderRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !detail) return;
    setLoading(true);
    apiGet<any>('/order/order/list', { orderIds: detail.orderId, page: 1, size: 50 })
      .then((result) => setRows((result?.records || []).filter((row: SubOrderRow) => row.orderId !== detail.orderId)))
      .catch((error) => Toast.error({ content: error?.message || t('加载子订单失败') }))
      .finally(() => setLoading(false));
  }, [visible, detail, t]);

  return (
    <Modal title={t('子订单')} visible={visible} onCancel={onCancel} footer={null} width={820}>
      <Table<SubOrderRow>
        loading={loading}
        dataSource={rows}
        pagination={false}
        rowKey={(record?: SubOrderRow) => String(record?.orderId ?? Math.random())}
        expandRowRender={(record: SubOrderRow) => (
          <div style={{ padding: 8 }}>
            {(record.items || []).map((item: Record<string, any>, index: number) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                {item.picThumb ? <Avatar shape="square" src={item.picThumb} size="extra-small" /> : null}
                <span>{item.productName}</span>
                <span style={{ color: 'var(--semi-color-text-2)' }}>× {item.quantity}</span>
                <span style={{ color: 'var(--semi-color-danger)' }}>¥ {Number(item.price || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
        columns={[
          { title: t('订单号'), dataIndex: 'orderSn', width: 200, render: (v: string) => <span className="mono">{v || '--'}</span> },
          { title: t('订单状态'), dataIndex: 'orderStatusName', width: 100, render: (v: string) => v || '--' },
          {
            title: t('订单金额'),
            dataIndex: 'totalAmount',
            width: 110,
            render: (v: unknown) => `¥ ${Number(v || 0).toFixed(2)}`,
          },
          { title: t('收货人'), dataIndex: 'consignee', width: 110, render: (v: string) => v || '--' },
          { title: t('下单时间'), dataIndex: 'addTime', width: 170, render: (v: string) => v || '--' },
        ] as any}
      />
    </Modal>
  );
}

/* ============================== 扫码核销 ============================== */

export function WriteOffModal({
  visible,
  onCancel,
  onSuccess,
}: {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [pickupSn, setPickupSn] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setPickupSn('');
  }, [visible]);

  const submit = async () => {
    const code = pickupSn.trim();
    if (!code) {
      Toast.warning({ content: t('请输入核销码') });
      return;
    }
    if (isDemo()) {
      Toast.warning({ content: t('演示模式不支持操作') });
      return;
    }
    setSaving(true);
    try {
      await apiPost(`/order/order/writeOff?pickupSn=${encodeURIComponent(code)}`);
      Toast.success({ content: t('核销成功') });
      onSuccess();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('核销失败') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={t('订单核销')}
      visible={visible}
      onCancel={onCancel}
      width={480}
      footer={
        <Space>
          <Button onClick={onCancel}>{t('取消')}</Button>
          <Button theme="solid" type="primary" loading={saving} onClick={submit}>
            {t('确认核销')}
          </Button>
        </Space>
      }
    >
      <div style={{ margin: '12px 0' }}>
        <Input
          placeholder={t('请输入自提核销码')}
          value={pickupSn}
          onChange={(next) => setPickupSn(next)}
          onEnterPress={submit}
        />
        <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 8 }}>
          {t('输入用户出示的自提码即可完成门店核销。')}
        </Text>
      </div>
    </Modal>
  );
}

/* ============================== 配送/服务照片（O2O） ============================== */

export function DeliveryPhotoSection({ detail }: { detail: OrderDetailLike | null }) {
  const { t } = useI18n();
  const info = detail?.deliveryInfo;
  if (!info) return null;
  const isDelivery = (info.typeName || '') === '配送订单';
  const pickupPhotos: string[] = info.pickupPhoto || [];
  const arrivePhotos: string[] = info.arrivePhoto || info.servicePhoto || [];

  return (
    <div className="order-detail-card">
      <div className="order-detail-card-title">
        {isDelivery ? t('配送照片') : t('服务照片')}
      </div>
      <div className="order-info-row">
        <span>{isDelivery ? t('配送员') : t('服务员')}</span>
        <b>
          {info.staffName || '-'} {info.staffPhone ? `（${info.staffPhone}）` : ''}
        </b>
        {info.statusName ? <Tag size="small">{info.statusName}</Tag> : null}
      </div>
      {pickupPhotos.length > 0 && (
        <div className="order-info-row is-block">
          <span>{t('取货照片')}</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {pickupPhotos.map((photo, index) => (
              <img key={index} src={photo} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 4 }} />
            ))}
          </div>
        </div>
      )}
      {arrivePhotos.length > 0 && (
        <div className="order-info-row is-block">
          <span>{isDelivery ? t('送达照片') : t('服务照片')}</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {arrivePhotos.map((photo, index) => (
              <img key={index} src={photo} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 4 }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// SideSheet 引用占位（保持与详情弹窗相同的依赖面）
void SideSheet;
