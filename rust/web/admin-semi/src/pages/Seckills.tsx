import { useState } from 'react';
import { Button, Input, InputNumber, Modal, Space, Toast, Typography } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import FormDrawer from '../framework/FormDrawer';
import ProductPicker from '../components/ProductPicker';
import type { ColumnConfig, FormDrawerConfig } from '../framework/types';

const { Text } = Typography;

interface SeckillSkuRow {
  productId?: number;
  skuId?: number | null;
  productName?: string;
  picThumb?: string;
  basePrice?: number | string;
  baseStock?: number | string;
  skuData?: string;
  seckillPrice?: number;
  seckillStock?: number;
}

interface SeckillRow {
  seckillId: number;
  seckillName?: string;
  productName?: string;
  seckillStartTime?: string;
  seckillEndTime?: string;
  statusName?: string;
}

const datetimeToStamp = (value: string) => Math.floor(new Date(value.replace(/-/g, '/')).getTime() / 1000);

/** 限时秒杀：对应旧版 promotion/seckill/List.vue + Info.vue + SelectSeckillProduct.vue。 */
export default function Seckills() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [drawerInitial, setDrawerInitial] = useState<Record<string, any>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [batchField, setBatchField] = useState<'price' | 'stock' | null>(null);
  const [batchValue, setBatchValue] = useState<number | null>(null);

  const reload = () => setReloadKey((key) => key + 1);

  const openCreate = () => {
    setDrawerMode('create');
    setEditingId(null);
    setDrawerInitial({
      seckillName: '',
      seckillStartTime: '',
      seckillEndTime: '',
      seckillItem: [] as SeckillSkuRow[],
    });
    setBatchField(null);
    setBatchValue(null);
    setDrawerOpen(true);
  };

  const openEdit = async (row: SeckillRow) => {
    setDrawerMode('edit');
    setEditingId(row.seckillId);
    setBatchField(null);
    setBatchValue(null);
    try {
      const detail = await apiGet<any>('/promotion/seckill/detail', { id: row.seckillId });
      const items = (detail?.seckillItem || detail?.seckillItems || []).map((item: any) => ({
        productId: item.productId,
        skuId: item.skuId ?? null,
        productName: item.productName || detail?.seckillName || '',
        picThumb: item.picThumb || detail?.picThumb || '',
        basePrice: item.skuPrice ?? item.productPrice ?? item.price ?? '',
        baseStock: item.skuStock ?? item.productStock ?? item.stock ?? '',
        skuData: typeof item.skuData === 'string' ? item.skuData : JSON.stringify(item.skuData || ''),
        seckillPrice: Number(item.seckillPrice ?? 0),
        seckillStock: Number(item.seckillStock ?? 0),
      }));
      setDrawerInitial({
        seckillId: row.seckillId,
        seckillName: detail?.seckillName || row.seckillName || '',
        seckillStartTime: detail?.seckillStartTime || row.seckillStartTime || '',
        seckillEndTime: detail?.seckillEndTime || row.seckillEndTime || '',
        seckillItem: items,
      });
    } catch {
      setDrawerInitial({ ...row, seckillItem: [] });
    }
    setDrawerOpen(true);
  };

  const applyBatch = (values: Record<string, any>, formApi: any) => {
    if (batchValue == null) return;
    const next = (values.seckillItem || []).map((item: SeckillSkuRow) => ({
      ...item,
      seckillPrice: batchField === 'price' ? Number(batchValue) : item.seckillPrice,
      seckillStock: batchField === 'stock' ? Number(batchValue) : item.seckillStock,
    }));
    formApi?.setValue('seckillItem', next);
    setBatchField(null);
    setBatchValue(null);
  };

  const saveSeckill = async (payload: Record<string, any>) => {
    if (!String(payload.seckillName || '').trim()) {
      Toast.error({ content: t('活动名称不能为空!') });
      return;
    }
    const items: SeckillSkuRow[] = payload.seckillItem || [];
    if (!items.length) {
      Toast.error({ content: t('活动商品不能为空!') });
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, any> = {
        seckillName: payload.seckillName,
        seckillStartTime: payload.seckillStartTime,
        seckillEndTime: payload.seckillEndTime,
        seckillLimitNum: 0,
        productId: items[0]?.productId,
        seckillItem: items.map((item) => ({
          recId: (item as any).recId,
          productId: item.productId,
          skuId: item.skuId ?? undefined,
          seckillPrice: item.seckillPrice ?? 0,
          seckillStock: item.seckillStock ?? 0,
        })),
      };
      if (drawerMode === 'edit' && editingId) {
        await apiPost('/promotion/seckill/update', { ...body, seckillId: editingId });
      } else {
        await apiPost('/promotion/seckill/create', body);
      }
      Toast.success({ content: drawerMode === 'edit' ? t('更新成功') : t('创建成功') });
      setDrawerOpen(false);
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  const deleteSeckill = (row: SeckillRow) => {
    Modal.confirm({
      title: t('确认删除该秒杀活动吗？'),
      onOk: async () => {
        try {
          await apiPost('/promotion/seckill/del', { id: row.seckillId });
          Toast.success({ content: t('删除成功') });
          reload();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
        }
      },
    });
  };

  const columns: ColumnConfig<SeckillRow>[] = [
    {
      title: '秒杀名称',
      dataIndex: 'seckillName',
      width: 200,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      title: '商品名称',
      dataIndex: 'productName',
      width: 260,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    { title: '秒杀开始时间', dataIndex: 'seckillStartTime', width: 170 },
    { title: '秒杀结束时间', dataIndex: 'seckillEndTime', width: 170 },
    {
      title: '秒杀状态',
      dataIndex: 'statusName',
      width: 110,
      render: (value: string) => (
        <span style={{ color: value === '已结束' ? 'red' : value === '进行中' ? 'green' : 'black' }}>
          {value ? t(value) : '-'}
        </span>
      ),
    },
  ];

  const drawerConfig: FormDrawerConfig = {
    createApi: '/promotion/seckill/create',
    title: '限时秒杀',
    width: 760,
    labelWidth: 110,
    sections: [
      {
        key: 'basic',
        title: '秒杀设置',
        fields: [
          {
            field: 'seckillItem',
            label: t('秒杀商品'),
            type: 'custom',
            render: ({ formApi, values, mode }) => {
              const items: SeckillSkuRow[] = values.seckillItem || [];
              return (
                <div className="seckill-form-content">
                  {mode === 'create' ? (
                    <Space>
                      <ProductPicker
                        value={items.map((item) => Number(item.productId))}
                        onChange={(ids) => {
                          if (!ids.length) {
                            formApi?.setValue('seckillItem', []);
                            return;
                          }
                          apiGet<any>('/product/product/detail', { id: ids[0] })
                            .then((detail: any) => {
                              const skus = detail?.skuList || detail?.productSkus || [];
                              const rows: SeckillSkuRow[] = skus.length
                                ? skus.map((sku: any) => ({
                                    productId: detail?.productId ?? ids[0],
                                    skuId: sku.skuId ?? null,
                                    productName: detail?.productName || '',
                                    picThumb: detail?.picThumb || '',
                                    basePrice: sku.price ?? detail?.productPrice ?? '',
                                    baseStock: sku.stock ?? detail?.productStock ?? '',
                                    skuData: sku.skuData || '',
                                    seckillPrice: Number(sku.price ?? detail?.productPrice ?? 0),
                                    seckillStock: Number(sku.stock ?? detail?.productStock ?? 0),
                                  }))
                                : [
                                    {
                                      productId: detail?.productId ?? ids[0],
                                      skuId: null,
                                      productName: detail?.productName || '',
                                      picThumb: detail?.picThumb || '',
                                      basePrice: detail?.productPrice ?? '',
                                      baseStock: detail?.productStock ?? '',
                                      skuData: '',
                                      seckillPrice: Number(detail?.productPrice ?? 0),
                                      seckillStock: Number(detail?.productStock ?? 0),
                                    },
                                  ];
                              formApi?.setValue('seckillItem', rows);
                            })
                            .catch((error) => Toast.error({ content: error.message }));
                        }}
                        max={1}
                      />
                      {items.length > 0 && (
                        <Button onClick={() => formApi?.setValue('seckillItem', [])}>{t('清空')}</Button>
                      )}
                    </Space>
                  ) : null}
                  {items.map((item, index) => (
                    <div className="seckill-item-row" key={`${item.productId}-${item.skuId ?? 'default'}-${index}`}>
                      <div className="seckill-item-info">
                        {item.picThumb ? <img src={item.picThumb} alt="" /> : null}
                        <div>
                          <div>{item.productName || '-'}</div>
                          {item.skuData ? (
                            <Text type="tertiary" size="small">
                              {item.skuData}
                            </Text>
                          ) : null}
                        </div>
                      </div>
                      <div className="seckill-item-field">
                        <InputNumber
                          size="small"
                          min={0}
                          style={{ width: 120 }}
                          disabled={mode === 'edit'}
                          value={Number(item.seckillPrice ?? 0)}
                          onChange={(next) => {
                            const nextItems = [...items];
                            nextItems[index] = { ...item, seckillPrice: Number(next ?? 0) };
                            formApi?.setValue('seckillItem', nextItems);
                          }}
                        />
                        <Text type="tertiary" size="small">
                          {t('价格(元)：{price}', { price: item.basePrice || '-' })}
                        </Text>
                      </div>
                      <div className="seckill-item-field">
                        <InputNumber
                          size="small"
                          min={0}
                          precision={0}
                          style={{ width: 120 }}
                          disabled={mode === 'edit'}
                          value={Number(item.seckillStock ?? 0)}
                          onChange={(next) => {
                            const nextItems = [...items];
                            nextItems[index] = { ...item, seckillStock: Number(next ?? 0) };
                            formApi?.setValue('seckillItem', nextItems);
                          }}
                        />
                        <Text type="tertiary" size="small">
                          {t('现有库存：{stock}', { stock: item.baseStock || 0 })}
                        </Text>
                      </div>
                    </div>
                  ))}
                  {items.length > 0 && mode === 'create' ? (
                    <Space>
                      <Text>{t('批量设置：')}</Text>
                      {batchField === null ? (
                        <>
                          <Button theme="borderless" type="primary" size="small" onClick={() => setBatchField('price')}>
                            {t('秒杀价格')}
                          </Button>
                          <Button theme="borderless" type="primary" size="small" onClick={() => setBatchField('stock')}>
                            {t('秒杀库存')}
                          </Button>
                        </>
                      ) : (
                        <>
                          <InputNumber
                            size="small"
                            min={0}
                            style={{ width: 140 }}
                            placeholder={batchField === 'price' ? t('请输入秒杀价格') : t('请输入秒杀库存')}
                            value={batchValue ?? undefined}
                            onChange={(next) => setBatchValue(next == null ? null : Number(next))}
                          />
                          <Button theme="borderless" type="primary" size="small" onClick={() => applyBatch(values, formApi)}>
                            {t('保存')}
                          </Button>
                          <Button theme="borderless" size="small" onClick={() => setBatchField(null)}>
                            {t('取消')}
                          </Button>
                        </>
                      )}
                    </Space>
                  ) : null}
                  <Text type="tertiary" size="small">
                    {t('只能添加一件商品参与秒杀活动（支持对不同规格进行单独设置）')}
                  </Text>
                </div>
              );
            },
          },
          { field: 'seckillName', label: t('活动名称'), type: 'input', required: true },
          {
            field: 'seckillTime',
            label: t('活动日期'),
            type: 'custom',
            render: ({ formApi, values }) => (
              <Space>
                <Input
                  style={{ width: 200 }}
                  placeholder={t('开始时间 YYYY-MM-DD HH:mm:ss')}
                  value={values.seckillStartTime || ''}
                  onChange={(next) => formApi?.setValue('seckillStartTime', next)}
                />
                <Input
                  style={{ width: 200 }}
                  placeholder={t('结束时间 YYYY-MM-DD HH:mm:ss')}
                  value={values.seckillEndTime || ''}
                  onChange={(next) => formApi?.setValue('seckillEndTime', next)}
                />
              </Space>
            ),
          },
        ],
      },
    ],
    toPayload: (values) => {
      if (!String(values.seckillName || '').trim()) throw new Error(t('活动名称不能为空!'));
      const items: SeckillSkuRow[] = values.seckillItem || [];
      if (!items.length) throw new Error(t('活动商品不能为空!'));
      return {
        seckillId: values.seckillId,
        seckillName: values.seckillName,
        seckillStartTime: values.seckillStartTime
          ? String(datetimeToStamp(values.seckillStartTime))
          : undefined,
        seckillEndTime: values.seckillEndTime ? String(datetimeToStamp(values.seckillEndTime)) : undefined,
        seckillLimitNum: 0,
        productId: items[0]?.productId,
        seckillItem: items.map((item) => ({
          recId: (item as any).recId,
          productId: item.productId,
          skuId: item.skuId ?? undefined,
          seckillPrice: item.seckillPrice ?? 0,
          seckillStock: item.seckillStock ?? 0,
        })),
      };
    },
  };

  return (
    <div className="seckills-page">
      <ListPage<SeckillRow>
        key={reloadKey}
        api="/promotion/seckill/list"
        rowKey="seckillId"
        pageSize={10}
        selectable
        actionWidth={150}
        filters={[
          { field: 'keyword', label: '秒杀名称', type: 'input', placeholder: '输入秒杀名称', width: 240 },
        ]}
        columns={columns}
        batchActions={(rows, clear) => (
          <Button
            size="small"
            onClick={() => {
              Modal.confirm({
                title: t('您确认要批量删除所选数据吗？'),
                onOk: async () => {
                  try {
                    await apiPost('/promotion/seckill/batch', {
                      ids: rows.map((row) => row.seckillId),
                      type: 'del',
                    });
                    Toast.success({ content: t('批量删除成功') });
                    clear();
                    reload();
                  } catch (error) {
                    Toast.error({ content: error instanceof Error ? error.message : t('批量删除失败') });
                  }
                },
              });
            }}
          >
            {t('批量删除')}
          </Button>
        )}
        rowActions={(row) => (
          <Space spacing={2}>
            <Button theme="borderless" size="small" onClick={() => openEdit(row)}>
              {t('编辑')}
            </Button>
            <Button theme="borderless" type="danger" size="small" onClick={() => deleteSeckill(row)}>
              {t('删除')}
            </Button>
          </Space>
        )}
        toolbarExtra={
          <Button theme="solid" type="primary" onClick={openCreate}>
            {t('添加限时秒杀')}
          </Button>
        }
      />

      <FormDrawer
        visible={drawerOpen}
        mode={drawerMode}
        initialValues={drawerInitial}
        config={drawerConfig}
        saving={saving}
        onCancel={() => setDrawerOpen(false)}
        onSubmit={saveSeckill}
      />
    </div>
  );
}
