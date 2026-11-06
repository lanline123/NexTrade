import { useEffect, useState } from 'react';
import {
  Button,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  TextArea,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { apiGet, apiPost, apiUpload } from '../api';
import ListPage from '../framework/ListPage';
import FormDrawer from '../framework/FormDrawer';
import ProductPicker from '../components/ProductPicker';
import { useI18n } from '../i18n';
import type { ColumnConfig, FormDrawerConfig } from '../framework/types';

const { Text } = Typography;

interface AllocateRow {
  allocateId: number;
  allocateCode?: string;
  outboundOrganizationId?: number;
  outboundOrganizationName?: string;
  warehousingOrganizationId?: number;
  warehousingOrganizationName?: string;
  status?: number;
  addBy?: string;
  addTime?: string;
}

interface OrgOption {
  orgId?: number;
  shopId?: number;
  name?: string;
  shopTitle?: string;
}

interface PickedProduct {
  productId?: number;
  productName?: string;
  quantity?: number;
}

const STATUS_NAMES: Record<number, string> = {
  1: '待审核',
  2: '待调出',
  3: '待调入',
  4: '已完成',
  5: '审核驳回',
  6: '已作废',
};

const statusName = (status?: number) => STATUS_NAMES[Number(status)] || '-';

/** 库存调拨：对应旧版 product/inventoryTransfer/*（列表/新建/审核/调出/作废/导入导出）。 */
export default function InventoryTransfers() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerInitial, setDrawerInitial] = useState<Record<string, any>>({});
  const [orgOptions, setOrgOptions] = useState<Array<{ label: string; value: number }>>([]);
  const [saving, setSaving] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRows, setDetailRows] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const reload = () => setReloadKey((key) => key + 1);

  useEffect(() => {
    apiGet<any>('/product/stock/getOrgList')
      .then((result) => {
        const list = Array.isArray(result) ? result : result?.records || result?.list || [];
        setOrgOptions(
          list.map((org: OrgOption) => ({
            label: org.name || org.shopTitle || String(org.shopId ?? org.orgId ?? ''),
            value: Number(org.shopId ?? org.orgId ?? 0),
          })),
        );
      })
      .catch(() => undefined);
  }, []);

  const openCreate = () => {
    setDrawerInitial({
      outboundOrganizationId: undefined,
      warehousingOrganizationId: undefined,
      comment: '',
      productStockAllocateRecordDetailList: [],
    });
    setDrawerOpen(true);
  };

  const openDetail = async (row: AllocateRow) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const result = await apiGet<any>('/product/stock/productStockAllocateOperationDetail', {
        id: row.allocateId,
      });
      setDetailRows(result?.productStockAllocateRecordDetailList || result?.records || result?.list || []);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载失败') });
    } finally {
      setDetailLoading(false);
    }
  };

  const operate = (
    row: AllocateRow,
    action: 'auditAllocate' | 'stockOutAllocate' | 'cancelAllocate',
    title: string,
  ) => {
    Modal.confirm({
      title,
      onOk: async () => {
        try {
          await apiPost(`/product/stock/${action}`, { id: row.allocateId });
          Toast.success({ content: t('操作成功') });
          reload();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
        }
      },
    });
  };

  const exportAllocate = async (ids: number[]) => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (ids.length) params.set('ids', ids.join(','));
      const res = await fetch(`/adminapi/product/stock/exportAllocate?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '调拨单.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      Toast.error({ content: t('导出失败') });
    } finally {
      setExporting(false);
    }
  };

  const importAllocate = async (file: File | undefined) => {
    if (!file) return;
    setImporting(true);
    try {
      await apiUpload('/product/stock/batchImportAllocate', file);
      Toast.success({ content: t('导入成功') });
      setImportOpen(false);
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('导入失败') });
    } finally {
      setImporting(false);
    }
  };

  const columns: ColumnConfig<AllocateRow>[] = [
    {
      title: '单据号',
      dataIndex: 'allocateCode',
      width: 190,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      title: '出库组织',
      dataIndex: 'outboundOrganizationName',
      width: 150,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      title: '入库组织',
      dataIndex: 'warehousingOrganizationName',
      width: 150,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      title: '单据状态',
      dataIndex: 'status',
      width: 110,
      render: (value: number) => {
        const text = t(statusName(value));
        const color = Number(value) === 4 ? 'green' : Number(value) === 5 || Number(value) === 6 ? 'red' : 'orange';
        return <Tag color={color as never}>{text}</Tag>;
      },
    },
    {
      title: '经办人',
      dataIndex: 'addBy',
      width: 110,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    { title: '创建时间', dataIndex: 'addTime', width: 170 },
  ];

  const drawerConfig: FormDrawerConfig = {
    createApi: '/product/stock/createAllocate',
    title: '新建调拨单',
    width: 700,
    labelWidth: 110,
    sections: [
      {
        key: 'basic',
        title: '调拨信息',
        fields: [
          {
            field: 'outboundOrganizationId',
            label: t('出库组织'),
            type: 'custom',
            render: ({ formApi, values }) => (
              <Select
                style={{ width: 240 }}
                filter
                placeholder={t('请选择出库组织')}
                optionList={orgOptions}
                value={values.outboundOrganizationId}
                onChange={(next) => formApi?.setValue('outboundOrganizationId', Number(next))}
              />
            ),
          },
          {
            field: 'warehousingOrganizationId',
            label: t('入库组织'),
            type: 'custom',
            render: ({ formApi, values }) => (
              <Select
                style={{ width: 240 }}
                filter
                placeholder={t('请选择入库组织')}
                optionList={orgOptions}
                value={values.warehousingOrganizationId}
                onChange={(next) => formApi?.setValue('warehousingOrganizationId', Number(next))}
              />
            ),
          },
          { field: 'comment', label: t('备注'), type: 'textarea' },
          {
            field: 'productStockAllocateRecordDetailList',
            label: t('选择商品'),
            type: 'custom',
            render: ({ formApi, values }) => {
              const picked: PickedProduct[] = values.productStockAllocateRecordDetailList || [];
              return (
                <div className="stock-record-picker">
                  <ProductPicker
                    value={picked.map((item) => Number(item.productId))}
                    onChange={(ids) => {
                      const next: PickedProduct[] = ids.map((id) => {
                        const existed = picked.find((item) => Number(item.productId) === id);
                        return existed ?? { productId: id, quantity: 1 };
                      });
                      formApi?.setValue('productStockAllocateRecordDetailList', next);
                    }}
                    max={50}
                  />
                  {picked.map((item, index) => (
                    <div className="stock-record-row" key={item.productId}>
                      <span className="stock-record-name">
                        {item.productName || t('商品#{id}', { id: String(item.productId ?? '') })}
                      </span>
                      <InputNumber
                        size="small"
                        min={1}
                        precision={0}
                        style={{ width: 130 }}
                        value={Number(item.quantity ?? 1)}
                        onChange={(next) => {
                          const nextRows = [...picked];
                          nextRows[index] = { ...item, quantity: Number(next ?? 1) };
                          formApi?.setValue('productStockAllocateRecordDetailList', nextRows);
                        }}
                      />
                      <Button
                        theme="borderless"
                        type="danger"
                        size="small"
                        onClick={() =>
                          formApi?.setValue(
                            'productStockAllocateRecordDetailList',
                            picked.filter((_, i) => i !== index),
                          )
                        }
                      >
                        {t('移除')}
                      </Button>
                    </div>
                  ))}
                </div>
              );
            },
          },
        ],
      },
    ],
    toPayload: (values) => {
      if (!values.outboundOrganizationId) throw new Error(t('请选择出库组织'));
      if (!values.warehousingOrganizationId) throw new Error(t('请选择入库组织'));
      const rows: PickedProduct[] = values.productStockAllocateRecordDetailList || [];
      if (!rows.length) throw new Error(t('请选择商品!'));
      return {
        outboundOrganizationId: Number(values.outboundOrganizationId),
        warehousingOrganizationId: Number(values.warehousingOrganizationId),
        comment: values.comment || '',
        productStockAllocateRecordDetailList: rows.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity ?? 1),
        })),
      };
    },
  };

  return (
    <div className="allocate-page">
      <ListPage<AllocateRow>
        key={reloadKey}
        api="/product/stock/productStockAllocateRecordPage"
        rowKey="allocateId"
        pageSize={10}
        selectable
        actionWidth={220}
        filters={[
          { field: 'keyword', label: '单据号', type: 'input', placeholder: '输入单据号/关键词', width: 240 },
        ]}
        columns={columns}
        batchActions={(rows, clear) => (
          <Button
            size="small"
            onClick={() => {
              Modal.confirm({
                title: t('确认作废所选 {count} 张调拨单吗？', { count: rows.length }),
                onOk: async () => {
                  try {
                    await apiPost('/product/stock/cancelAllocate', {
                      ids: rows.map((row) => row.allocateId),
                    });
                    Toast.success({ content: t('作废成功') });
                    clear();
                    reload();
                  } catch (error) {
                    Toast.error({ content: error instanceof Error ? error.message : t('作废失败') });
                  }
                },
              });
            }}
          >
            {t('作废')}
          </Button>
        )}
        rowActions={(row) => (
          <Space spacing={2}>
            <Button theme="borderless" size="small" onClick={() => openDetail(row)}>
              {t('详情')}
            </Button>
            {Number(row.status) === 1 ? (
              <Button
                theme="borderless"
                type="danger"
                size="small"
                onClick={() => operate(row, 'auditAllocate', t('确认审核通过该调拨单？'))}
              >
                {t('审核')}
              </Button>
            ) : null}
            {Number(row.status) === 2 ? (
              <Button
                theme="borderless"
                type="danger"
                size="small"
                onClick={() => operate(row, 'stockOutAllocate', t('确认调拨出库？'))}
              >
                {t('调拨出库')}
              </Button>
            ) : null}
          </Space>
        )}
        toolbarExtra={
          <Space>
            <Button theme="solid" type="primary" onClick={openCreate}>
              {t('新建调拨单')}
            </Button>
            <Button onClick={() => setImportOpen(true)}>{t('导入调拨单')}</Button>
            <Button loading={exporting} onClick={() => exportAllocate([])}>
              {t('全部导出')}
            </Button>
          </Space>
        }
      />

      <FormDrawer
        visible={drawerOpen}
        mode="create"
        initialValues={drawerInitial}
        config={drawerConfig}
        saving={saving}
        onCancel={() => setDrawerOpen(false)}
        onSubmit={async (payload) => {
          setSaving(true);
          try {
            await apiPost('/product/stock/createAllocate', payload);
            Toast.success({ content: t('操作成功') });
            setDrawerOpen(false);
            reload();
          } catch (error) {
            Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
          } finally {
            setSaving(false);
          }
        }}
      />

      <Modal
        title={t('详情')}
        visible={detailOpen}
        footer={null}
        onCancel={() => setDetailOpen(false)}
        width={860}
      >
        <Spin spinning={detailLoading}>
          <Table
            size="small"
            pagination={false}
            rowKey={(record: any, index?: number) => String(record.productId ?? index)}
            dataSource={detailRows}
            columns={[
              { title: t('商品名称'), dataIndex: 'productName', render: (v: any) => v || '-' },
              { title: t('规格'), dataIndex: 'productSkuName', render: (v: any) => v || '-' },
              { title: t('数量'), dataIndex: 'quantity' },
            ]}
          />
          {!detailRows.length && !detailLoading ? <Text type="tertiary">{t('暂无数据')}</Text> : null}
        </Spin>
      </Modal>

      <Modal
        title={t('导入调拨单')}
        visible={importOpen}
        footer={null}
        onCancel={() => setImportOpen(false)}
      >
        <div className="stock-import-form">
          <Space>
            <label style={{ cursor: 'pointer' }}>
              <input
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={(event) => {
                  importAllocate(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
              <Button theme="solid" type="primary" loading={importing}>
                {t('选择 Excel 文件')}
              </Button>
            </label>
            <Button
              onClick={async () => {
                try {
                  const res = await fetch('/adminapi/product/stock/getAllocateTemplate', {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
                  });
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = '调拨导入模板.xlsx';
                  link.click();
                  URL.revokeObjectURL(url);
                } catch {
                  Toast.error({ content: t('模板下载失败') });
                }
              }}
            >
              {t('下载导入模板')}
            </Button>
          </Space>
        </div>
      </Modal>
    </div>
  );
}
