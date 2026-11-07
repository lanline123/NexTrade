import { useState } from 'react';
import {
  Button,
  Input,
  InputNumber,
  Modal,
  Radio,
  RadioGroup,
  Space,
  Spin,
  Table,
  TextArea,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { apiGet, apiPost, apiUpload } from '../api';
import ListPage from '../framework/ListPage';
import FormDrawer from '../framework/FormDrawer';
import SkuPicker from '../components/SkuPicker';
import { useI18n } from '../i18n';
import type { ColumnConfig, FormDrawerConfig } from '../framework/types';

const { Text } = Typography;

interface StockRecordRow {
  productStockId?: number;
  stockCode?: string;
  type?: number | string;
  addTime?: string;
  comment?: string;
  addBy?: string;
}

interface PickedProduct {
  productId?: number;
  productName?: string;
  productSkuId?: number;
  skuValue?: string;
  stock?: number;
  quantity?: number;
}

const IN_TYPES = [
  { label: '采购入库', value: 11 },
  { label: '退货入库', value: 12 },
  { label: '其他入库', value: 10 },
];

const OUT_TYPES = [
  { label: '过期出库', value: 21 },
  { label: '订单出库', value: 22 },
  { label: '其他出库', value: 23 },
];

/** 商品入库/出库：对应旧版 product/goodsArePutIntoStorage|goodsArePutOutOfStorage（inOrOut 1/2 共用）。 */
export default function StockRecords({ inOrOut }: { inOrOut: 1 | 2 }) {
  const { t } = useI18n();
  const typeList = inOrOut === 1 ? IN_TYPES : OUT_TYPES;
  const typeLabel = inOrOut === 1 ? '入库' : '出库';
  const [reloadKey, setReloadKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerInitial, setDrawerInitial] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRows, setDetailRows] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  const reload = () => setReloadKey((key) => key + 1);

  const openCreate = () => {
    setDrawerInitial({ type: typeList[0].value, comment: '', productStockRecordDetailList: [] });
    setDrawerOpen(true);
  };

  const openDetail = async (row: StockRecordRow) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const result = await apiGet<any>('/product/stock/getRecordDetail', {
        inOrOut,
        id: row.productStockId,
      });
      setDetailRows(result?.productStockRecordDetailList || result?.records || result?.list || []);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载失败') });
    } finally {
      setDetailLoading(false);
    }
  };

  const importExcel = async (file: File | undefined) => {
    if (!file) return;
    setImporting(true);
    try {
      const result = await apiUpload<any>(
        `/product/stock/batchImport?inOrOut=${inOrOut}`,
        file,
      );
      const fail = result?.failCount ?? 0;
      Toast.success({
        content: fail ? t('导入完成，失败 {count} 条', { count: fail }) : t('导入成功'),
      });
      setImportOpen(false);
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('导入失败') });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const res = await fetch(`/adminapi/product/stock/downloadTemplate?inOrOut=${inOrOut}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${typeLabel}导入模板.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      Toast.error({ content: t('模板下载失败') });
    }
  };

  const columns: ColumnConfig<StockRecordRow>[] = [
    {
      title: inOrOut === 1 ? '入库单号' : '出库单号',
      dataIndex: 'stockCode',
      width: 190,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      title: inOrOut === 1 ? '入库类型' : '出库类型',
      dataIndex: 'type',
      width: 120,
      render: (value: number | string) => {
        const hit = typeList.find((item) => String(item.value) === String(value));
        return <span>{hit ? t(hit.label) : String(value ?? '-')}</span>;
      },
    },
    { title: inOrOut === 1 ? '入库时间' : '出库时间', dataIndex: 'addTime', width: 170 },
    {
      title: '备注',
      dataIndex: 'comment',
      width: 200,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      title: '经办人',
      dataIndex: 'addBy',
      width: 110,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      title: inOrOut === 1 ? '入库描述' : '出库描述',
      dataIndex: 'desc',
      width: 180,
      render: (value: string) => <span>{value || '--'}</span>,
    },
  ];

  const drawerConfig: FormDrawerConfig = {
    createApi: inOrOut === 1 ? '/product/stock/stockIn' : '/product/stock/stockOut',
    title: `商品${typeLabel}`,
    width: 700,
    labelWidth: 110,
    sections: [
      {
        key: 'basic',
        title: `${typeLabel}信息`,
        fields: [
          {
            field: 'type',
            label: inOrOut === 1 ? t('入库类型') : t('出库类型'),
            type: 'radio',
            options: typeList.map((item) => ({ ...item, label: t(item.label) })),
          },
          { field: 'comment', label: t('备注'), type: 'textarea' },
          {
            field: 'productStockRecordDetailList',
            label: t('选择商品'),
            type: 'custom',
            render: ({ formApi, values }) => {
              const picked: PickedProduct[] = values.productStockRecordDetailList || [];
              return (
                <div className="stock-record-picker">
                  <SkuPicker
                    value={picked.map((item) => ({
                      productId: Number(item.productId),
                      productName: (item as any).productName,
                      skuId: Number((item as any).productSkuId ?? (item as any).skuId ?? 0),
                      skuValue: (item as any).skuValue,
                      stock: (item as any).stock,
                    }))}
                    onChange={(picks) => {
                      const next: PickedProduct[] = picks.map((pick) => {
                        const existed = picked.find(
                          (item) =>
                            Number(item.productId) === pick.productId &&
                            Number((item as any).productSkuId ?? (item as any).skuId ?? 0) === pick.skuId,
                        );
                        return {
                          ...((existed || {}) as PickedProduct),
                          productId: pick.productId,
                          productName: pick.productName,
                          productSkuId: pick.skuId,
                          skuValue: pick.skuValue,
                          stock: pick.stock,
                          quantity: existed?.quantity ?? 1,
                        };
                      });
                      formApi?.setValue('productStockRecordDetailList', next);
                    }}
                    max={50}
                  />
                  {picked.map((item, index) => (
                    <div className="stock-record-row" key={`${item.productId}-${item.productSkuId ?? 0}-${index}`}>
                      <span className="stock-record-name">
                        {item.productName || t('商品#{id}', { id: String(item.productId ?? '') })}
                        {Number(item.productSkuId ?? 0) > 0 ? `（${item.skuValue || item.productSkuId}）` : ''}
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
                          formApi?.setValue('productStockRecordDetailList', nextRows);
                        }}
                      />
                      <Button
                        theme="borderless"
                        type="danger"
                        size="small"
                        onClick={() =>
                          formApi?.setValue(
                            'productStockRecordDetailList',
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
      const rows: PickedProduct[] = values.productStockRecordDetailList || [];
      if (!rows.length) throw new Error(t('请选择商品!'));
      return {
        type: values.type,
        comment: values.comment || '',
        productStockRecordDetailList: rows.map((item) => ({
          productId: item.productId,
          skuId: (item as any).productSkuId ?? (item as any).skuId,
          quantity: Number(item.quantity ?? 1),
        })),
      };
    },
  };

  return (
    <div className="stock-records-page">
      <ListPage<StockRecordRow>
        key={reloadKey}
        api="/product/stock/record/page"
        rowKey="productStockId"
        pageSize={10}
        actionWidth={120}
        query={{ inOrOut }}
        filters={[
          { field: 'keyword', label: `${typeLabel}单号`, type: 'input', placeholder: `输入${typeLabel}单号`, width: 220 },
        ]}
        columns={columns}
        rowActions={(row) => (
          <Button theme="borderless" size="small" onClick={() => openDetail(row)}>
            {t('详情')}
          </Button>
        )}
        toolbarExtra={
          <Space>
            <Button theme="solid" type="primary" onClick={openCreate}>
              {inOrOut === 1 ? t('商品入库') : t('商品出库')}
            </Button>
            <Button onClick={() => setImportOpen(true)}>{t('批量导入')}</Button>
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
            await apiPost(
              inOrOut === 1 ? '/product/stock/stockIn' : '/product/stock/stockOut',
              payload,
            );
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
              { title: t('商品名称'), dataIndex: 'productName', render: (v: any, r: any) => v || r.productName || '-' },
              { title: t('规格'), dataIndex: 'productSkuName', render: (v: any) => v || '-' },
              { title: t('数量'), dataIndex: 'quantity' },
            ]}
          />
          {!detailRows.length && !detailLoading ? <Text type="tertiary">{t('暂无数据')}</Text> : null}
        </Spin>
      </Modal>

      <Modal
        title={inOrOut === 1 ? t('入库批量导入') : t('出库批量导入')}
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
                  importExcel(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
              <Button theme="solid" type="primary" loading={importing}>
                {t('选择 Excel 文件')}
              </Button>
            </label>
            <Button onClick={downloadTemplate}>{t('下载导入模板')}</Button>
          </Space>
          <Text type="tertiary" size="small">
            {t('按模板填写后导入；若存在错误数据，可使用错误数据下载接口核对（getImportErrorData）。')}
          </Text>
        </div>
      </Modal>
    </div>
  );
}
