import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  SideSheet,
  Space,
  Switch,
  Table,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconPlus, IconRefresh } from '@douyinfe/semi-icons';
import { apiDownload, apiGet, apiPost } from '../api';
import ListPage from '../framework/ListPage';
import type { ColumnConfig, FilterConfig, FormDrawerConfig } from '../framework/types';
import { useI18n } from '../i18n';

/**
 * 供应链（v5.8.61 view/admin/src/views/supplyChain）
 *
 * 旧版页面：
 * - supplier/List.vue + Info.vue        → 供应商列表/新增编辑
 * - supplierCategory/List.vue + Info.vue → 供应商分类
 * - supplierProduct/List.vue + Manage.vue → 供应商商品
 * - purchaseOrder/List.vue + Detail.vue + Info.vue → 采购订单
 * - purchaseInbound/List.vue + Detail.vue → 采购入库
 * - purchaseReturn/List.vue + Detail.vue → 采购退货
 * - purchaseReconciliation/List.vue + Detail.vue → 采购对账
 * - purchaseSetting/Index.vue → 采购设置
 *
 * 后端路由（Rust adminapi/supplyChain/*）已实现列表/详情/状态/保存/审批等接口。
 * 采购订单创建依赖供应商 SKU 选择接口；当前后端只提供供应商商品列表（无 SKU 列表接口），
 * 因此创建表单以「供应商商品 SKU ID + 数量 + 采购价」录入作为过渡，并在表单内标注。
 */

const { Text } = Typography;

function camelize<T>(input: T): T {
  if (Array.isArray(input)) {
    input.forEach((item) => camelize(item));
    return input;
  }
  if (input && typeof input === 'object') {
    const record = input as Record<string, any>;
    Object.keys(record).slice().forEach((key) => {
      const value = record[key];
      if (Array.isArray(value) || (value && typeof value === 'object')) camelize(value);
      if (key.includes('_')) {
        const camel = key.replace(/_([a-z0-9])/g, (_m, char: string) => char.toUpperCase());
        if (record[camel] === undefined) record[camel] = value;
      }
    });
  }
  return input;
}

function fmtTime(value: unknown): string {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return String(value || '-');
  const date = new Date(num > 1e12 ? num : num * 1000);
  return Number.isNaN(date.getTime()) ? String(value || '-') : date.toLocaleString('zh-CN', { hour12: false });
}

function money(value: unknown): string {
  return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_TEXT: Record<string, string> = {
  '1': '启用',
  '2': '禁用',
};

const ORDER_STATUS: Record<string, string> = {
  '1': '待入库',
  '2': '部分入库',
  '3': '已完成',
  '4': '已关闭',
};

const RECONCILIATION_STATUS: Record<string, string> = {
  '1': '待审核',
  '2': '已通过',
  '3': '已驳回',
  '4': '已作废',
};

function StatusTag({ value, map }: { value: unknown; map?: Record<string, string> }) {
  const key = String(value ?? '');
  const color = key === '1' ? 'green' : key === '3' ? 'blue' : key === '4' ? 'grey' : 'orange';
  return <Tag color={color}>{(map || STATUS_TEXT)[key] || key || '-'}</Tag>;
}

function useCategoryOptions() {
  const [categories, setCategories] = useState<Array<{ label: string; value: number }>>([]);
  useEffect(() => {
    apiGet<{ records?: Array<Record<string, any>> }>('/supplyChain/supplierCategory/list', { page: 1, size: 200 })
      .then((result) => {
        setCategories(
          (result?.records || []).map((item) => ({
            label: String(item.categoryName || item.category_name || item.id),
            value: Number(item.id),
          })),
        );
      })
      .catch(() => setCategories([]));
  }, []);
  return categories;
}

function useSupplierOptions() {
  const [suppliers, setSuppliers] = useState<Array<{ label: string; value: number }>>([]);
  useEffect(() => {
    apiGet<{ records?: Array<Record<string, any>> }>('/supplyChain/supplier/list', { page: 1, size: 200 })
      .then((result) => {
        setSuppliers(
          (result?.records || []).map((item) => ({
            label: String(item.vendorName || item.vendor_name || item.vendorId || item.vendor_id || ''),
            value: Number(item.vendorId ?? item.vendor_id ?? 0),
          })),
        );
      })
      .catch(() => setSuppliers([]));
  }, []);
  return suppliers;
}

/** 供应商列表（supplier/List.vue）：关键词/状态筛选，新增编辑、启禁用、删除。 */
export function SupplierList() {
  const { t } = useI18n();
  const categories = useCategoryOptions();
  const [reloadKey, setReloadKey] = useState(0);
  const filters: FilterConfig[] = [
    { field: 'keyword', label: t('供应商名称/编号'), type: 'input', width: 220, placeholder: t('请输入供应商名称或编号') },
    { field: 'status', label: t('状态'), type: 'select', options: [{ label: t('启用'), value: 1 }, { label: t('禁用'), value: 2 }] },
  ];
  const columns: ColumnConfig[] = [
    { title: t('供应商名称'), dataIndex: 'vendorName', width: 200 },
    { title: t('供应商编号'), dataIndex: 'vendorCode', width: 160 },
    { title: t('供应商分类'), dataIndex: 'categoryName', width: 150, render: (value: string, row: any) => value || String(row.purchaseCategoryId ?? '-') },
    { title: t('联系人手机'), dataIndex: 'contactMobile', width: 130 },
    { title: t('状态'), dataIndex: 'status', width: 90, render: (value: unknown) => <StatusTag value={value} /> },
    { title: t('创建时间'), dataIndex: 'addTime', width: 170, render: (value: unknown) => fmtTime(value) },
  ];
  const drawer: FormDrawerConfig = useMemo(
    () => ({
      title: t('供应商'),
      createApi: '/supplyChain/supplier/create',
      updateApi: '/supplyChain/supplier/update',
      idField: 'vendorId',
      width: 620,
      sections: [
        {
          key: 'basic',
          title: t('供应商信息'),
          fields: [
            { field: 'vendorName', label: t('供应商名称'), type: 'input', required: true, placeholder: t('请输入供应商名称') },
            { field: 'vendorCode', label: t('供应商编号'), type: 'input', placeholder: t('请输入供应商编号') },
            { field: 'contactMobile', label: t('联系人手机'), type: 'input', placeholder: t('请输入联系人手机') },
            {
              field: 'purchaseCategoryId',
              label: t('供应商分类'),
              type: 'select',
              options: categories,
              placeholder: t('请选择供应商分类'),
            },
            { field: 'status', label: t('状态'), type: 'select', options: [{ label: t('启用'), value: 1 }, { label: t('禁用'), value: 2 }], initValue: 1 },
            { field: 'description', label: t('备注'), type: 'textarea', span: 24 },
          ],
        },
      ],
    }),
    [categories, t],
  );
  const toggleStatus = async (row: any) => {
    const next = Number(row.status) === 1 ? 2 : 1;
    try {
      await apiPost('/supplyChain/supplier/status', { id: Number(row.vendorId ?? row.vendor_id), status: next });
      Toast.success({ content: t('操作成功') });
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    }
  };
  const remove = (row: any) => {
    Modal.confirm({
      title: t('确认删除该供应商？'),
      onOk: async () => {
        try {
          await apiPost('/supplyChain/supplier/delete', { id: Number(row.vendorId ?? row.vendor_id) });
          Toast.success({ content: t('删除成功') });
          setReloadKey((key) => key + 1);
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
        }
      },
    });
  };
  return (
    <ListPage
      key={reloadKey}
      api="/supplyChain/supplier/list"
      rowKey={(row: any) => String(row.vendorId ?? row.vendor_id)}
      columns={columns}
      filters={filters}
      drawer={drawer}
      onDataLoaded={({ rows }) => rows.forEach((row) => camelize(row))}
      cardTitle={t('供应商列表')}
      rowActions={(row: any) => (
        <Space>
          <Button theme="borderless" size="small" onClick={() => void toggleStatus(row)}>
            {Number(row.status) === 1 ? t('禁用') : t('启用')}
          </Button>
          <Button theme="borderless" type="danger" size="small" onClick={() => remove(row)}>
            {t('删除')}
          </Button>
        </Space>
      )}
    />
  );
}

/** 供应商分类（supplierCategory/List.vue）。 */
export function SupplierCategories() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const filters: FilterConfig[] = [{ field: 'keyword', label: t('分类名称'), type: 'input', width: 220 }];
  const columns: ColumnConfig[] = [
    { title: t('分类名称'), dataIndex: 'categoryName', width: 220 },
    { title: t('排序'), dataIndex: 'sortOrder', width: 90 },
    { title: t('状态'), dataIndex: 'status', width: 90, render: (value: unknown) => <StatusTag value={value} /> },
    { title: t('备注'), dataIndex: 'remark', render: (value: string) => value || '-' },
    { title: t('创建时间'), dataIndex: 'createTime', width: 170, render: (value: unknown) => fmtTime(value) },
  ];
  const drawer: FormDrawerConfig = {
    title: t('供应商分类'),
    createApi: '/supplyChain/supplierCategory/save',
    updateApi: '/supplyChain/supplierCategory/save',
    deleteApi: '/supplyChain/supplierCategory/delete',
    width: 520,
    sections: [
      {
        key: 'basic',
        title: t('分类信息'),
        fields: [
          { field: 'categoryName', label: t('分类名称'), type: 'input', required: true },
          { field: 'sortOrder', label: t('排序'), type: 'number', initValue: 50 },
          { field: 'status', label: t('状态'), type: 'select', options: [{ label: t('启用'), value: 1 }, { label: t('禁用'), value: 2 }], initValue: 1 },
          { field: 'remark', label: t('备注'), type: 'textarea' },
        ],
      },
    ],
  };
  return (
    <ListPage
      key={reloadKey}
      api="/supplyChain/supplierCategory/list"
      rowKey="id"
      columns={columns}
      filters={filters}
      drawer={drawer}
      onDataLoaded={({ rows }) => rows.forEach((row) => camelize(row))}
      cardTitle={t('供应商分类')}
      actionWidth={150}
      rowActions={(row: any) => (
        <Button
          theme="borderless"
          size="small"
          onClick={async () => {
            try {
              await apiPost('/supplyChain/supplierCategory/status', { id: Number(row.id), status: Number(row.status) === 1 ? 2 : 1 });
              Toast.success({ content: t('操作成功') });
              setReloadKey((key) => key + 1);
            } catch (error) {
              Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
            }
          }}
        >
          {Number(row.status) === 1 ? t('禁用') : t('启用')}
        </Button>
      )}
    />
  );
}

/** 供应商商品（supplierProduct/List.vue + Manage.vue）：查看商品明细/启停。 */
export function SupplierProducts() {
  const { t } = useI18n();
  const [detail, setDetail] = useState<Record<string, any> | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const filters: FilterConfig[] = [{ field: 'keyword', label: t('供应商/商品'), type: 'input', width: 220 }];
  const columns: ColumnConfig[] = [
    { title: t('供应商名称'), dataIndex: 'vendorName', width: 200 },
    { title: t('供应商编号'), dataIndex: 'vendorCode', width: 160 },
    { title: t('商品名称'), dataIndex: 'productName', render: (value: string) => value || '-' },
    { title: t('商品状态'), dataIndex: 'productState', width: 100, render: (value: unknown) => <Tag color={Number(value) === 1 ? 'green' : 'grey'}>{Number(value) === 1 ? t('上架') : t('下架')}</Tag> },
    { title: t('创建时间'), dataIndex: 'createTime', width: 170, render: (value: unknown) => fmtTime(value) },
  ];
  const openDetail = async (row: any) => {
    try {
      const result = await apiGet<Record<string, any>>('/supplyChain/supplierProduct/detail', { id: Number(row.id) });
      setDetail(camelize(result) || row);
      setDetailVisible(true);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载失败') });
    }
  };
  const toggle = async (row: any) => {
    try {
      await apiPost('/supplyChain/supplierProduct/status', { id: Number(row.id), status: Number(row.productState) === 1 ? 0 : 1 });
      Toast.success({ content: t('操作成功') });
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    }
  };
  return (
    <>
      <ListPage
        key={reloadKey}
        api="/supplyChain/supplierProduct/list"
        rowKey="id"
        columns={columns}
        filters={filters}
        showEdit={false}
        onDataLoaded={({ rows }) => rows.forEach((row) => camelize(row))}
      cardTitle={t('供应商商品')}
        actionWidth={160}
        rowActions={(row: any) => (
          <Space>
            <Button theme="borderless" size="small" onClick={() => void openDetail(row)}>{t('详情')}</Button>
            <Button theme="borderless" size="small" onClick={() => void toggle(row)}>{Number(row.productState) === 1 ? t('下架') : t('上架')}</Button>
          </Space>
        )}
      />
      <SideSheet title={t('供应商商品详情')} visible={detailVisible} onCancel={() => setDetailVisible(false)} width={720}>
        {detail ? (
          <Descriptions
            data={[
              { key: t('供应商'), value: detail.vendorName || detail.vendor_name || '-' },
              { key: t('商品名称'), value: detail.productName || detail.product_name || '-' },
              { key: t('商品编号'), value: detail.productSn || detail.product_sn || '-' },
              { key: t('采购价'), value: detail.purchasePrice || detail.purchase_price || '-' },
              { key: t('状态'), value: Number(detail.productState ?? detail.product_state) === 1 ? t('上架') : t('下架') },
              { key: t('备注'), value: detail.remark || '-' },
            ]}
          />
        ) : null}
      </SideSheet>
    </>
  );
}

/** 采购订单（purchaseOrder/List.vue + Detail.vue + Info.vue）。 */
export function PurchaseOrders() {
  const { t } = useI18n();
  const suppliers = useSupplierOptions();
  const [detail, setDetail] = useState<Record<string, any> | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [formValues, setFormValues] = useState<Record<string, any>>({
    vendorId: undefined,
    expectedDeliveryDate: '',
    shippingMethod: 1,
    trackingNo: '',
    remark: '',
    items: [{ vendorProductSkuId: '', quantity: 1, purchasePrice: '' }],
  });
  const filters: FilterConfig[] = [
    { field: 'keyword', label: t('采购订单编号'), type: 'input', width: 220 },
    { field: 'status', label: t('单据状态'), type: 'select', options: Object.entries(ORDER_STATUS).map(([value, label]) => ({ label, value: Number(value) })) },
  ];
  const columns: ColumnConfig[] = [
    { title: t('采购订单编号'), dataIndex: 'orderSn', width: 190 },
    { title: t('物流单号'), dataIndex: 'trackingNo', width: 160 },
    { title: t('单据状态'), dataIndex: 'status', width: 100, render: (value: unknown) => <StatusTag value={value} map={ORDER_STATUS} /> },
    { title: t('采购总金额(元)'), dataIndex: 'productAmount', width: 140, render: (value: unknown) => money(value) },
    { title: t('采购数量'), dataIndex: 'orderedQuantity', width: 100 },
    { title: t('供应商'), dataIndex: 'vendorName', width: 160 },
    { title: t('制单人'), dataIndex: 'createByName', width: 110 },
    { title: t('制单时间'), dataIndex: 'createTime', width: 170, render: (value: unknown) => fmtTime(value) },
  ];
  const openDetail = async (row: any) => {
    try {
      const result = await apiGet<Record<string, any>>('/supplyChain/purchaseOrder/detail', { id: Number(row.id) });
      setDetail(camelize(result) || row);
      setDetailVisible(true);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载失败') });
    }
  };
  const finish = (row: any) => {
    Modal.confirm({
      title: t('确认结束该采购订单？'),
      content: t('结束后订单不可继续入库。'),
      onOk: async () => {
        try {
          await apiPost('/supplyChain/purchaseOrder/finish', { id: Number(row.id), remark: t('后台手动结束') });
          Toast.success({ content: t('操作成功') });
          setReloadKey((key) => key + 1);
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
        }
      },
    });
  };
  const submitCreate = async () => {
    if (!formValues.vendorId) {
      Toast.error({ content: t('请选择供应商') });
      return;
    }
    const items = (formValues.items || []).filter((item: any) => String(item.vendorProductSkuId || '').trim() && Number(item.quantity) > 0);
    if (!items.length) {
      Toast.error({ content: t('请至少填写一条采购商品（SKU ID/数量/采购价）') });
      return;
    }
    setSaving(true);
    try {
      await apiPost('/supplyChain/purchaseOrder/create', {
        vendorId: Number(formValues.vendorId),
        expectedDeliveryDate: formValues.expectedDeliveryDate ? Math.floor(new Date(formValues.expectedDeliveryDate).getTime() / 1000) : 0,
        shippingMethod: Number(formValues.shippingMethod || 1),
        trackingNo: formValues.trackingNo || '',
        remark: formValues.remark || '',
        items: items.map((item: any) => ({
          vendorProductSkuId: Number(item.vendorProductSkuId),
          quantity: Number(item.quantity),
          purchasePrice: String(item.purchasePrice || '0'),
        })),
      });
      Toast.success({ content: t('创建成功') });
      setCreateVisible(false);
      setFormValues({ vendorId: undefined, expectedDeliveryDate: '', shippingMethod: 1, trackingNo: '', remark: '', items: [{ vendorProductSkuId: '', quantity: 1, purchasePrice: '' }] });
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('创建失败') });
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <ListPage
        key={reloadKey}
        api="/supplyChain/purchaseOrder/list"
        rowKey="id"
        columns={columns}
        filters={filters}
        showEdit={false}
        onDataLoaded={({ rows }) => rows.forEach((row) => camelize(row))}
      cardTitle={t('采购订单')}
        actionWidth={170}
        toolbarExtra={<Button icon={<IconPlus />} theme="solid" type="primary" onClick={() => setCreateVisible(true)}>{t('新建采购订单')}</Button>}
        rowActions={(row: any) => (
          <Space>
            <Button theme="borderless" size="small" onClick={() => void openDetail(row)}>{t('详情')}</Button>
            {[1, 2].includes(Number(row.status)) ? <Button theme="borderless" size="small" onClick={() => finish(row)}>{t('结束')}</Button> : null}
          </Space>
        )}
      />
      <SideSheet title={t('采购订单详情')} visible={detailVisible} onCancel={() => setDetailVisible(false)} width={880}>
        {detail ? (
          <>
            <Descriptions
              data={[
                { key: t('采购订单编号'), value: detail.orderSn || '-' },
                { key: t('单据状态'), value: <StatusTag value={detail.status} map={ORDER_STATUS} /> },
                { key: t('供应商'), value: detail.vendorName || '-' },
                { key: t('物流单号'), value: detail.trackingNo || '-' },
                { key: t('预计送达日期'), value: detail.expectedDeliveryDate ? fmtTime(detail.expectedDeliveryDate) : '-' },
                { key: t('采购总金额(元)'), value: money(detail.productAmount) },
                { key: t('采购数量'), value: detail.orderedQuantity ?? '-' },
                { key: t('制单人'), value: detail.createByName || '-' },
                { key: t('制单时间'), value: fmtTime(detail.createTime) },
                { key: t('备注'), value: detail.remark || '-' },
              ]}
            />
            <Table
              style={{ marginTop: 16 }}
              pagination={false}
              rowKey="id"
              dataSource={detail.items || []}
              columns={[
                { title: t('商品名称'), dataIndex: 'productName' },
                { title: t('采购数量'), dataIndex: 'quantity', width: 100 },
                { title: t('已入库量'), dataIndex: 'receivedQuantity', width: 100 },
                { title: t('剩余入库量'), width: 110, render: (_: any, row: any) => Number(row.quantity || 0) - Number(row.receivedQuantity || 0) },
                { title: t('采购价'), dataIndex: 'purchasePrice', width: 100 },
                { title: t('小计(元)'), dataIndex: 'amount', width: 110, render: (value: unknown) => money(value) },
              ]}
            />
          </>
        ) : null}
      </SideSheet>
      <SideSheet title={t('新建采购订单')} visible={createVisible} onCancel={() => setCreateVisible(false)} width={760}>
        <Form labelPosition="left" labelWidth={120}>
          <Form.Section text={t('订单信息')}>
            <Select
              style={{ width: '100%', marginBottom: 12 }}
              placeholder={t('请选择供应商')}
              filter
              optionList={suppliers}
              value={formValues.vendorId}
              onChange={(value) => setFormValues((prev) => ({ ...prev, vendorId: value }))}
            />
            <Input
              style={{ width: '100%', marginBottom: 12 }}
              placeholder={t('预计送达日期，如 2026-11-20')}
              value={formValues.expectedDeliveryDate}
              onChange={(value) => setFormValues((prev) => ({ ...prev, expectedDeliveryDate: value }))}
            />
            <Select
              style={{ width: '100%', marginBottom: 12 }}
              optionList={[{ label: t('供应商配送'), value: 1 }, { label: t('自提'), value: 2 }]}
              value={formValues.shippingMethod}
              onChange={(value) => setFormValues((prev) => ({ ...prev, shippingMethod: value }))}
            />
            <Input
              style={{ width: '100%', marginBottom: 12 }}
              placeholder={t('物流单号（可选）')}
              value={formValues.trackingNo}
              onChange={(value) => setFormValues((prev) => ({ ...prev, trackingNo: value }))}
            />
            <Input
              style={{ width: '100%', marginBottom: 12 }}
              placeholder={t('备注（可选）')}
              value={formValues.remark}
              onChange={(value) => setFormValues((prev) => ({ ...prev, remark: value }))}
            />
          </Form.Section>
          <Form.Section text={t('采购商品')}>
            {(formValues.items || []).map((item: any, index: number) => (
              <Space key={index} style={{ display: 'flex', marginBottom: 8 }} align="end">
                <Input
                  style={{ width: 200 }}
                  placeholder={t('供应商商品 SKU ID')}
                  value={item.vendorProductSkuId}
                  onChange={(value) =>
                    setFormValues((prev) => ({
                      ...prev,
                      items: (prev.items || []).map((row: any, rowIndex: number) => (rowIndex === index ? { ...row, vendorProductSkuId: value } : row)),
                    }))
                  }
                />
                <InputNumber
                  style={{ width: 110 }}
                  min={1}
                  placeholder={t('数量')}
                  value={item.quantity}
                  onChange={(value) =>
                    setFormValues((prev) => ({
                      ...prev,
                      items: (prev.items || []).map((row: any, rowIndex: number) => (rowIndex === index ? { ...row, quantity: Number(value || 1) } : row)),
                    }))
                  }
                />
                <Input
                  style={{ width: 130 }}
                  placeholder={t('采购价')}
                  value={item.purchasePrice}
                  onChange={(value) =>
                    setFormValues((prev) => ({
                      ...prev,
                      items: (prev.items || []).map((row: any, rowIndex: number) => (rowIndex === index ? { ...row, purchasePrice: value } : row)),
                    }))
                  }
                />
                <Button
                  type="danger"
                  theme="borderless"
                  onClick={() =>
                    setFormValues((prev) => ({ ...prev, items: (prev.items || []).filter((_: any, rowIndex: number) => rowIndex !== index) }))
                  }
                >
                  {t('删除')}
                </Button>
              </Space>
            ))}
            <Button
              icon={<IconPlus />}
              onClick={() =>
                setFormValues((prev) => ({ ...prev, items: [...(prev.items || []), { vendorProductSkuId: '', quantity: 1, purchasePrice: '' }] }))
              }
            >
              {t('添加商品')}
            </Button>
            <div style={{ marginTop: 8 }}>
              <Text type="tertiary" size="small">{t('说明：后端暂未提供供应商 SKU 选择接口，请填写供应商商品 SKU ID；采购价按供应商报价填写。')}</Text>
            </div>
          </Form.Section>
        </Form>
        <Space style={{ marginTop: 16 }}>
          <Button onClick={() => setCreateVisible(false)}>{t('取消')}</Button>
          <Button theme="solid" type="primary" loading={saving} onClick={() => void submitCreate()}>{t('保存')}</Button>
        </Space>
      </SideSheet>
    </>
  );
}

/** 采购入库（purchaseInbound/List.vue + Detail.vue）。 */
export function PurchaseInbound() {
  const { t } = useI18n();
  const [detail, setDetail] = useState<Record<string, any> | null>(null);
  const [visible, setVisible] = useState(false);
  const filters: FilterConfig[] = [{ field: 'keyword', label: t('入库单号/采购单号'), type: 'input', width: 220 }];
  const columns: ColumnConfig[] = [
    { title: t('单据编号'), dataIndex: 'receiptSn', width: 190 },
    { title: t('采购订单号'), dataIndex: 'orderSn', width: 190 },
    { title: t('供应商'), dataIndex: 'vendorName', width: 160 },
    { title: t('单据状态'), dataIndex: 'status', width: 100, render: (value: unknown) => <StatusTag value={value} map={ORDER_STATUS} /> },
    { title: t('入库数量'), dataIndex: 'totalQuantity', width: 100 },
    { title: t('入库总金额(元)'), dataIndex: 'totalAmount', width: 140, render: (value: unknown) => money(value) },
    { title: t('制单人'), dataIndex: 'createByName', width: 110 },
    { title: t('制单时间'), dataIndex: 'createTime', width: 170, render: (value: unknown) => fmtTime(value) },
  ];
  const openDetail = async (row: any) => {
    try {
      const result = await apiGet<Record<string, any>>('/supplyChain/purchaseReceipt/detail', { id: Number(row.id) });
      setDetail(camelize(result) || row);
      setVisible(true);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载失败') });
    }
  };
  return (
    <>
      <ListPage
        api="/supplyChain/purchaseReceipt/list"
        rowKey="id"
        columns={columns}
        filters={filters}
        showEdit={false}
        onDataLoaded={({ rows }) => rows.forEach((row) => camelize(row))}
      cardTitle={t('采购入库')}
        actionWidth={100}
        rowActions={(row: any) => <Button theme="borderless" size="small" onClick={() => void openDetail(row)}>{t('详情')}</Button>}
      />
      <SideSheet title={t('采购入库详情')} visible={visible} onCancel={() => setVisible(false)} width={820}>
        {detail ? (
          <>
            <Descriptions
              data={[
                { key: t('单据编号'), value: detail.receiptSn || '-' },
                { key: t('采购订单号'), value: detail.orderSn || '-' },
                { key: t('供应商'), value: detail.vendorName || '-' },
                { key: t('单据状态'), value: <StatusTag value={detail.status} map={ORDER_STATUS} /> },
                { key: t('入库数量'), value: detail.totalQuantity ?? '-' },
                { key: t('入库总金额(元)'), value: money(detail.totalAmount) },
                { key: t('制单时间'), value: fmtTime(detail.createTime) },
                { key: t('备注'), value: detail.remark || '-' },
              ]}
            />
            <Table
              style={{ marginTop: 16 }}
              pagination={false}
              rowKey="id"
              dataSource={detail.items || []}
              columns={[
                { title: t('商品名称'), dataIndex: 'productName' },
                { title: t('入库数量'), dataIndex: 'quantity', width: 100 },
                { title: t('采购价'), dataIndex: 'purchasePrice', width: 100 },
                { title: t('金额'), dataIndex: 'amount', width: 110, render: (value: unknown) => money(value) },
              ]}
            />
          </>
        ) : null}
      </SideSheet>
    </>
  );
}

/** 采购退货（purchaseReturn/List.vue + Detail.vue）：查看/确认/删除。 */
export function PurchaseReturns() {
  const { t } = useI18n();
  const [detail, setDetail] = useState<Record<string, any> | null>(null);
  const [visible, setVisible] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const filters: FilterConfig[] = [{ field: 'keyword', label: t('退货单号/入库单号'), type: 'input', width: 220 }];
  const columns: ColumnConfig[] = [
    { title: t('采购退货申请单号'), dataIndex: 'returnSn', width: 190 },
    { title: t('关联采购入库单号'), dataIndex: 'receiptSn', width: 190 },
    { title: t('供应商'), dataIndex: 'vendorName', width: 160 },
    { title: t('单据状态'), dataIndex: 'status', width: 100, render: (value: unknown) => <StatusTag value={value} map={ORDER_STATUS} /> },
    { title: t('退货总数量'), dataIndex: 'totalQuantity', width: 120 },
    { title: t('退货总金额(元)'), dataIndex: 'totalAmount', width: 150, render: (value: unknown) => money(value) },
    { title: t('制单人'), dataIndex: 'createByName', width: 110 },
    { title: t('制单时间'), dataIndex: 'createTime', width: 170, render: (value: unknown) => fmtTime(value) },
  ];
  const openDetail = async (row: any) => {
    try {
      const result = await apiGet<Record<string, any>>('/supplyChain/purchaseReturn/detail', { id: Number(row.id) });
      setDetail(camelize(result) || row);
      setVisible(true);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载失败') });
    }
  };
  const confirm = (row: any) => {
    Modal.confirm({
      title: t('确认该采购退货单？'),
      onOk: async () => {
        try {
          await apiPost('/supplyChain/purchaseReturn/confirm', { id: Number(row.id) });
          Toast.success({ content: t('操作成功') });
          setReloadKey((key) => key + 1);
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
        }
      },
    });
  };
  const remove = (row: any) => {
    Modal.confirm({
      title: t('确认删除该采购退货单？'),
      onOk: async () => {
        try {
          await apiPost('/supplyChain/purchaseReturn/delete', { id: Number(row.id) });
          Toast.success({ content: t('删除成功') });
          setReloadKey((key) => key + 1);
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
        }
      },
    });
  };
  return (
    <>
      <ListPage
        key={reloadKey}
        api="/supplyChain/purchaseReturn/list"
        rowKey="id"
        columns={columns}
        filters={filters}
        showEdit={false}
        onDataLoaded={({ rows }) => rows.forEach((row) => camelize(row))}
      cardTitle={t('采购退货')}
        actionWidth={190}
        rowActions={(row: any) => (
          <Space>
            <Button theme="borderless" size="small" onClick={() => void openDetail(row)}>{t('详情')}</Button>
            {Number(row.status) === 1 ? <Button theme="borderless" size="small" onClick={() => confirm(row)}>{t('确认')}</Button> : null}
            <Button theme="borderless" type="danger" size="small" onClick={() => remove(row)}>{t('删除')}</Button>
          </Space>
        )}
      />
      <SideSheet title={t('采购退货详情')} visible={visible} onCancel={() => setVisible(false)} width={820}>
        {detail ? (
          <>
            <Descriptions
              data={[
                { key: t('退货申请单号'), value: detail.returnSn || '-' },
                { key: t('关联入库单号'), value: detail.receiptSn || '-' },
                { key: t('供应商'), value: detail.vendorName || '-' },
                { key: t('单据状态'), value: <StatusTag value={detail.status} map={ORDER_STATUS} /> },
                { key: t('退货总数量'), value: detail.totalQuantity ?? '-' },
                { key: t('退货总金额(元)'), value: money(detail.totalAmount) },
                { key: t('制单时间'), value: fmtTime(detail.createTime) },
                { key: t('备注'), value: detail.remark || '-' },
              ]}
            />
            <Table
              style={{ marginTop: 16 }}
              pagination={false}
              rowKey="id"
              dataSource={detail.items || []}
              columns={[
                { title: t('商品名称'), dataIndex: 'productName' },
                { title: t('退货数量'), dataIndex: 'quantity', width: 100 },
                { title: t('采购价'), dataIndex: 'purchasePrice', width: 100 },
                { title: t('金额'), dataIndex: 'amount', width: 110, render: (value: unknown) => money(value) },
              ]}
            />
          </>
        ) : null}
      </SideSheet>
    </>
  );
}

/** 采购对账（purchaseReconciliation/List.vue + Detail.vue）：详情/审批/作废/导出。 */
export function PurchaseReconciliation() {
  const { t } = useI18n();
  const [detail, setDetail] = useState<Record<string, any> | null>(null);
  const [visible, setVisible] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const filters: FilterConfig[] = [
    { field: 'keyword', label: t('对账单编号'), type: 'input', width: 220 },
    { field: 'status', label: t('对账单状态'), type: 'select', options: Object.entries(RECONCILIATION_STATUS).map(([value, label]) => ({ label, value: Number(value) })) },
  ];
  const columns: ColumnConfig[] = [
    { title: t('对账单编号'), dataIndex: 'reconciliationSn', width: 200 },
    { title: t('对账单状态'), dataIndex: 'status', width: 120, render: (value: unknown) => <StatusTag value={value} map={RECONCILIATION_STATUS} /> },
    { title: t('供应商'), dataIndex: 'vendorName', width: 170 },
    { title: t('创建人'), dataIndex: 'createByName', width: 110 },
    { title: t('创建时间'), dataIndex: 'createTime', width: 170, render: (value: unknown) => fmtTime(value) },
  ];
  const openDetail = async (row: any) => {
    try {
      const result = await apiGet<Record<string, any>>('/supplyChain/purchaseReconciliation/detail', { id: Number(row.id) });
      setDetail(camelize(result) || row);
      setVisible(true);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载失败') });
    }
  };
  const action = (row: any, path: string, title: string) => {
    Modal.confirm({
      title,
      onOk: async () => {
        try {
          await apiPost(`/supplyChain/purchaseReconciliation/${path}`, { id: Number(row.id) });
          Toast.success({ content: t('操作成功') });
          setReloadKey((key) => key + 1);
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
        }
      },
    });
  };
  const exportExcel = async () => {
    try {
      await apiDownload('/supplyChain/purchaseReconciliation/export', {}, 'purchase-reconciliation');
      Toast.success({ content: t('导出成功') });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('导出失败') });
    }
  };
  return (
    <>
      <ListPage
        key={reloadKey}
        api="/supplyChain/purchaseReconciliation/list"
        rowKey="id"
        columns={columns}
        filters={filters}
        showEdit={false}
        onDataLoaded={({ rows }) => rows.forEach((row) => camelize(row))}
      cardTitle={t('采购对账')}
        actionWidth={230}
        toolbarExtra={<Button icon={<IconRefresh />} onClick={() => void exportExcel()}>{t('导出')}</Button>}
        rowActions={(row: any) => (
          <Space>
            <Button theme="borderless" size="small" onClick={() => void openDetail(row)}>{t('详情')}</Button>
            {Number(row.status) === 1 ? (
              <>
                <Button theme="borderless" size="small" onClick={() => action(row, 'approve', t('确认通过对账单？'))}>{t('通过')}</Button>
                <Button theme="borderless" size="small" onClick={() => action(row, 'reject', t('确认驳回对账单？'))}>{t('驳回')}</Button>
              </>
            ) : null}
            {Number(row.status) === 2 ? <Button theme="borderless" size="small" onClick={() => action(row, 'void', t('确认作废对账单？'))}>{t('作废')}</Button> : null}
          </Space>
        )}
      />
      <SideSheet title={t('采购对账详情')} visible={visible} onCancel={() => setVisible(false)} width={900}>
        {detail ? (
          <>
            <Descriptions
              data={[
                { key: t('对账单编号'), value: detail.reconciliationSn || '-' },
                { key: t('对账单状态'), value: <StatusTag value={detail.status} map={RECONCILIATION_STATUS} /> },
                { key: t('供应商'), value: detail.vendorName || '-' },
                { key: t('创建人'), value: detail.createByName || '-' },
                { key: t('创建时间'), value: fmtTime(detail.createTime) },
                { key: t('备注'), value: detail.remark || '-' },
              ]}
            />
            <Typography.Title heading={6} style={{ marginTop: 16 }}>{t('对账来源单据')}</Typography.Title>
            <Table
              pagination={false}
              rowKey="id"
              dataSource={detail.sources || []}
              columns={[
                { title: t('来源类型'), dataIndex: 'sourceType', width: 100, render: (value: unknown) => (Number(value) === 1 ? t('采购入库') : t('采购退货')) },
                { title: t('来源单据'), dataIndex: 'sourceSn', render: (value: string) => value || '-' },
                { title: t('确认时间'), dataIndex: 'confirmTime', width: 170, render: (value: unknown) => fmtTime(value) },
              ]}
            />
            <Typography.Title heading={6} style={{ marginTop: 16 }}>{t('对账商品')}</Typography.Title>
            <Table
              pagination={false}
              rowKey="id"
              dataSource={detail.items || []}
              columns={[
                { title: t('商品名称'), dataIndex: 'productName' },
                { title: t('数量'), dataIndex: 'quantity', width: 100 },
                { title: t('金额'), dataIndex: 'amount', width: 120, render: (value: unknown) => money(value) },
              ]}
            />
          </>
        ) : null}
      </SideSheet>
    </>
  );
}

/** 采购设置（purchaseSetting/Index.vue）：自动结束天数、是否允许超收。 */
export function PurchaseSetting() {
  const { t } = useI18n();
  const [autoFinishDays, setAutoFinishDays] = useState<number>(0);
  const [allowOverReceive, setAllowOverReceive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiGet<Record<string, any> | null>('/supplyChain/purchaseSetting/detail');
      if (result) {
        setAutoFinishDays(Number(result.autoFinishDays ?? result.auto_finish_days ?? 0));
        setAllowOverReceive(Number(result.allowOverReceive ?? result.allow_over_receive ?? 0) === 1);
      }
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载失败') });
    } finally {
      setLoading(false);
    }
  }, [t]);
  useEffect(() => {
    void load();
  }, [load]);
  const save = async () => {
    setSaving(true);
    try {
      await apiPost('/supplyChain/purchaseSetting/save', { autoFinishDays: Number(autoFinishDays || 0), allowOverReceive: allowOverReceive ? 1 : 0 });
      Toast.success({ content: t('保存成功') });
      await load();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card loading={loading} title={t('采购设置')}>
      <Form labelPosition="left" labelWidth={160}>
        <Form.Section text={t('收货设置')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <span>{t('采购订单超过预计送达日期')}</span>
            <InputNumber min={0} value={autoFinishDays} onChange={(value) => setAutoFinishDays(Number(value || 0))} style={{ width: 120 }} />
            <span>{t('天后自动结束')}</span>
          </div>
          <Text type="tertiary" size="small">{t('在送达日期后的默认 n 天，采购订单状态为待入库时会自动关闭；部分入库时会自动完结。')}</Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0 8px' }}>
            <span>{t('是否允许超收')}</span>
            <Switch checked={allowOverReceive} onChange={setAllowOverReceive} />
            <Text type="tertiary" size="small">{t('开启后，对采购订单进行收货时允许超收，不限制采购入库的数量。')}</Text>
          </div>
        </Form.Section>
      </Form>
      <Button theme="solid" type="primary" loading={saving} onClick={() => void save()}>{t('提交')}</Button>
    </Card>
  );
}

/** 兼容旧 App 默认导出（占位逻辑已移除；保留导出避免引用断裂）。 */
export default function SupplyChainPage({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <Typography.Title heading={5}>{title}</Typography.Title>
      <Text type="tertiary">{description}</Text>
      <p style={{ marginTop: 12 }}>
        <Button theme="solid" type="primary" onClick={() => window.location.reload()}>
          刷新
        </Button>
      </p>
    </Card>
  );
}
