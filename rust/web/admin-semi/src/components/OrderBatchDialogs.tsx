/**
 * 订单批量操作弹窗（补齐 view/admin order/order/src 下旧版弹窗）
 *
 * - BatchSignModal    添加标记（EditSign.vue 批量态：5 色 + 备注，支持清除）
 * - BatchShipModal    订单批量发货（BatchShip.vue：severalDetail 明细勾选 → POST /order/order/batch）
 * - BatchDeliverImportModal Excel 批量发货（BatchDeliverImport.vue：模板下载/上传导入/错误数据）
 * - ChangeStatusModal 取消订单 / 取消发货（ChangeStatus.vue：changeOrderStatus field=orderStatus）
 */
import { useEffect, useRef, useState } from 'react';
import {
  Banner,
  Button,
  Input,
  Modal,
  Radio,
  RadioGroup,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  TextArea,
  Toast,
} from '@douyinfe/semi-ui';
import { IconUpload } from '@douyinfe/semi-icons';
import { apiDownload, apiGet, apiPost, apiUpload, isDemo } from '../api';
import { useI18n } from '../i18n';

// ————————————————————— 添加标记（批量） —————————————————————

const SIGN_LIST = [
  { value: 1, color: '#ff5050' },
  { value: 2, color: '#ffba1f' },
  { value: 3, color: '#2ecf92' },
  { value: 4, color: '#16afff' },
  { value: 5, color: '#792dff' },
];

export function BatchSignModal({
  visible,
  ids,
  onCancel,
  onSuccess,
}: {
  visible: boolean;
  ids: number[];
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [mark, setMark] = useState(0);
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setMark(0);
      setAdminNote('');
    }
  }, [visible]);

  const submit = async () => {
    if (isDemo()) {
      Toast.warning({ content: t('演示模式不支持该操作') });
      return;
    }
    setSaving(true);
    try {
      await apiPost('/order/order/setAdminNote', {
        ids: ids.join(','),
        mark,
        adminNote: adminNote.trim(),
      });
      Toast.success({ content: t('操作成功') });
      onSuccess();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={t('添加标记')}
      visible={visible}
      onCancel={onCancel}
      onOk={() => void submit()}
      okText={t('确定')}
      cancelText={t('清除标记')}
      okButtonProps={{ loading: saving }}
      width={480}
    >
      <div style={{ marginBottom: 14 }}>
        <div style={{ marginBottom: 6 }}>{t('标记')}</div>
        <RadioGroup value={mark} onChange={(e: any) => setMark(Number(e.target.value))}>
          {SIGN_LIST.map((item) => (
            <Radio key={item.value} value={item.value}>
              <Tag color={item.color as any}>●</Tag>
            </Radio>
          ))}
        </RadioGroup>
      </div>
      <div>
        <div style={{ marginBottom: 6 }}>{t('备注')}</div>
        <TextArea value={adminNote} onChange={(v) => setAdminNote(v)} rows={3} maxLength={200} placeholder={t('请输入备注')} />
      </div>
    </Modal>
  );
}

// ————————————————————— 批量发货 —————————————————————

interface BatchOrderDetail {
  orderId: number;
  orderSn: string;
  trackingNo?: string;
  items?: Array<{
    itemId?: number;
    productName?: string;
    quantity?: number;
    deliveryQuantity?: number;
    toDeliveryQuantity?: number;
  }>;
}

export function BatchShipModal({
  visible,
  ids,
  logistics,
  onCancel,
  onSuccess,
}: {
  visible: boolean;
  ids: number[];
  logistics: Array<{ id: number; name: string }>;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState<BatchOrderDetail[]>([]);
  const [logisticsId, setLogisticsId] = useState<number | undefined>();
  const [trackingNos, setTrackingNos] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!visible || ids.length === 0) return;
    setLoading(true);
    apiGet<BatchOrderDetail[]>('/order/order/severalDetail', { ids: ids.join(',') })
      .then((result) => {
        const list = Array.isArray(result) ? result : [];
        setOrders(list);
        setTrackingNos(
          Object.fromEntries(list.map((item) => [item.orderId, String(item.trackingNo || '')])),
        );
      })
      .catch((error) => Toast.error({ content: error instanceof Error ? error.message : t('加载失败') }))
      .finally(() => setLoading(false));
  }, [visible, ids]);

  const submit = async () => {
    if (isDemo()) {
      Toast.warning({ content: t('演示模式不支持发货') });
      return;
    }
    const deliverData = orders
      .map((order) => ({
        id: order.orderId,
        trackingNo: (trackingNos[order.orderId] || '').trim(),
        deliverInfo: (order.items || [])
          .map((item) => ({
            itemId: item.itemId,
            toDeliveryQuantity:
              item.toDeliveryQuantity !== undefined && item.toDeliveryQuantity !== null
                ? Number(item.toDeliveryQuantity)
                : Math.max(0, Number(item.quantity || 0) - Number(item.deliveryQuantity || 0)),
          }))
          .filter((item) => item.itemId && item.toDeliveryQuantity > 0),
      }))
      .filter((order) => order.deliverInfo.length > 0);
    if (deliverData.length === 0) {
      Toast.warning({ content: t('请选择要发货的商品明细') });
      return;
    }
    setSaving(true);
    try {
      await apiPost('/order/order/batch', {
        ids: deliverData.map((order) => order.id),
        type: 'deliver',
        data: {
          logisticsId: logisticsId || undefined,
          shippingMethod: 1,
          deliverData,
        },
      });
      Toast.success({ content: t('操作成功') });
      onSuccess();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('发货失败') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={t('订单批量发货')}
      visible={visible}
      onCancel={onCancel}
      onOk={() => void submit()}
      okText={t('确认发货')}
      cancelText={t('取消')}
      okButtonProps={{ loading: saving }}
      width={760}
    >
      <Spin spinning={loading}>
        <Space style={{ marginBottom: 12 }} wrap>
          <Select
            placeholder={t('物流公司')}
            style={{ width: 220 }}
            showClear
            optionList={logistics.map((item) => ({ label: item.name, value: item.id }))}
            value={logisticsId}
            onChange={(value) => setLogisticsId(Number(value) || undefined)}
          />
        </Space>
        {orders.map((order) => (
          <div key={order.orderId} style={{ marginBottom: 14, border: '1px solid var(--semi-color-border)', borderRadius: 6, padding: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span className="mono">{order.orderSn}</span>
              <Input
                value={trackingNos[order.orderId] || ''}
                onChange={(v) => setTrackingNos((prev) => ({ ...prev, [order.orderId]: v }))}
                placeholder={t('快递单号')}
                style={{ width: 240 }}
              />
            </div>
            <Table
              size="small"
              pagination={false}
              rowKey={(row?: any) => String(row?.itemId ?? row?.productName)}
              columns={[
                { title: t('商品名称'), dataIndex: 'productName' },
                { title: t('数量'), dataIndex: 'quantity', width: 80 },
                {
                  title: t('待发货数量'),
                  dataIndex: 'toDeliveryQuantity',
                  width: 110,
                  render: (value: unknown, row: any) =>
                    Number(value ?? (Number(row.quantity || 0) - Number(row.deliveryQuantity || 0))),
                },
              ]}
              dataSource={order.items || []}
            />
          </div>
        ))}
      </Spin>
    </Modal>
  );
}

// ————————————————————— Excel 批量发货 —————————————————————

export function BatchDeliverImportModal({
  visible,
  onCancel,
  onSuccess,
}: {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<Record<string, any> | null>(null);
  const [templateType, setTemplateType] = useState(1);

  useEffect(() => {
    if (visible) {
      setImportResult(null);
      setTemplateType(1);
    }
  }, [visible]);

  const downloadTemplate = () => {
    void apiDownload('/order/order/downloadDeliverTemplate', { templateType }, templateType === 2 ? '拆单发货模板.xlsx' : '批量发货模板.xlsx');
  };

  const upload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    if (isDemo()) {
      Toast.warning({ content: t('演示模式不支持导入') });
      return;
    }
    setUploading(true);
    try {
      const result = await apiUpload<Record<string, any>>('/order/order/batchDeliverImport', files[0], {
        templateType: String(templateType),
      });
      setImportResult(result || {});
      Toast.success({ content: t('导入完成') });
      onSuccess();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('导入失败') });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const failDetails: Array<{ rowNum?: number; orderSn?: string; reason?: string }> =
    importResult?.failDetails || [];
  const failCount = Number(importResult?.failCount ?? 0);

  return (
    <Modal
      title={t('Excel批量发货')}
      visible={visible}
      onCancel={onCancel}
      footer={null}
      width={620}
    >
      <Banner
        type="info"
        closeIcon={null}
        style={{ marginBottom: 14 }}
        description={t('先下载模板，按模板填写订单号和快递单号后上传，系统将批量发货。')}
      />
      <div style={{ marginBottom: 12 }}>
        <RadioGroup value={templateType} onChange={(e: any) => setTemplateType(Number(e.target.value))}>
          <Radio value={1}>{t('整单发货模板')}</Radio>
          <Radio value={2}>{t('拆单发货模板')}</Radio>
        </RadioGroup>
      </div>
      <Space wrap style={{ marginBottom: 14 }}>
        <Button onClick={downloadTemplate}>{t('下载模板')}</Button>
        <Button theme="solid" type="primary" icon={<IconUpload />} loading={uploading} onClick={() => fileRef.current?.click()}>
          {t('上传导入')}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".xls,.xlsx"
          style={{ display: 'none' }}
          onChange={(event) => void upload(event.target.files)}
        />
      </Space>
      {importResult ? (
        <div>
          <Banner
            type={failCount > 0 ? 'warning' : 'success'}
            closeIcon={null}
            style={{ marginBottom: 10 }}
            description={t('总 {totalCount}，成功 {successCount}，失败 {failCount}', {
              totalCount: Number(importResult.totalCount ?? 0),
              successCount: Number(importResult.successCount ?? 0),
              failCount,
            })}
          />
          {failDetails.length > 0 ? (
            <Table
              size="small"
              pagination={false}
              rowKey={(row?: any) => `${row?.rowNum ?? ''}-${row?.orderSn ?? ''}`}
              columns={[
                { title: t('行号'), dataIndex: 'rowNum', width: 80 },
                { title: t('订单号'), dataIndex: 'orderSn' },
                { title: t('失败原因'), dataIndex: 'reason' },
              ]}
              dataSource={failDetails}
            />
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

// ————————————————————— 取消订单 / 取消发货 —————————————————————

export function ChangeStatusModal({
  visible,
  orderId,
  preOrderStatus,
  title,
  onCancel,
  onSuccess,
}: {
  visible: boolean;
  orderId: number;
  /** 3 取消订单 / 1 取消发货（与旧版 ChangeStatus.vue preOrderStatus 一致） */
  preOrderStatus: number;
  title: string;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setAdminNote('');
  }, [visible]);

  const submit = async () => {
    if (isDemo()) {
      Toast.warning({ content: t('演示模式不支持该操作') });
      return;
    }
    setSaving(true);
    try {
      await apiPost('/order/order/changeOrderStatus', {
        id: orderId,
        field: 'orderStatus',
        val: preOrderStatus,
        adminNote: adminNote.trim(),
      });
      Toast.success({ content: t('操作成功') });
      onSuccess();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={title}
      visible={visible}
      onCancel={onCancel}
      onOk={() => void submit()}
      okText={t('确定')}
      cancelText={t('取消')}
      okButtonProps={{ loading: saving }}
      width={520}
    >
      {preOrderStatus === 3 ? (
        <Banner
          type="warning"
          closeIcon={null}
          style={{ marginBottom: 14 }}
          description={t('提示：该订单已完成支付为备货/待发货状态，取消后该订单自动变为取消状态；取消订单后，该订单已付款金额或使用的余额，可通过订单->售后管理->售后申请处理')}
        />
      ) : (
        <Banner
          type="warning"
          closeIcon={null}
          style={{ marginBottom: 14 }}
          description={t('提示：已发货订单状态修改为取消发货状态，已填写的物流信息将会清空 ，请谨慎操作！')}
        />
      )}
      <div>
        <div style={{ marginBottom: 6 }}>{t('备注')}</div>
        <TextArea value={adminNote} onChange={(v) => setAdminNote(v)} rows={4} maxLength={200} placeholder={t('请输入备注')} />
      </div>
    </Modal>
  );
}
