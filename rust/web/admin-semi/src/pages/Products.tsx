import { useEffect, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Input,
  InputNumber,
  Popconfirm,
  Popover,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconEdit, IconPlus, IconRefresh, IconSearch } from '@douyinfe/semi-icons';
import { apiGet, apiPost, isDemo } from '../api';
import { useI18n } from '../i18n';
import { mockProductPage } from '../mock';
import type { PageResult, ProductRow } from '../types';
import ProductFormDrawer from '../components/ProductFormDrawer';

const { Text } = Typography;

/** 列表页签（对齐旧版 List.vue：出售中/下架/待审核/审核失败/回收站）。 */
const buildStatusOptions = (t: (key: string) => string) => [
  { label: t('全部状态'), value: '' },
  { label: t('在售'), value: '1' },
  { label: t('下架'), value: '0' },
  { label: t('待审核'), value: 'check:0' },
  { label: t('审核失败'), value: 'check:2' },
  { label: t('回收站'), value: 'recycle' },
];

interface Option {
  id: number;
  name: string;
}

/** GET /product/product/skuList 返回的规格行（ProductStockPop 契约所需字段） */
interface SkuRow {
  skuId: number;
  skuValue?: string;
  skuSn?: string;
  skuStock?: number;
  isEnabled?: number;
}

/** 规格值展示：a|b → a;b（对齐旧版 formatSpecValue） */
const formatSkuValue = (value?: string) =>
  (value || '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)
    .join(';') || '-';

/**
 * 库存编辑弹层（对应原版 ProductStockPop.vue）：
 * 打开时用 GET /product/product/skuList 拉规格库存；多规格逐行改库存，
 * 保存走 POST /product/product/updateField {field:'productSku', val:[{skuId, skuStock}]}；
 * 单规格/无规格时编辑商品库存，保存 field='productStock'。
 */
function StockPopover({
  productId,
  stock,
  onSaved,
}: {
  productId: number;
  stock: number;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [skus, setSkus] = useState<SkuRow[]>([]);
  const [singleStock, setSingleStock] = useState<string>(String(stock || 0));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !productId || isDemo()) return;
    let alive = true;
    setLoading(true);
    setSkus([]);
    apiGet<PageResult<SkuRow>>('/product/product/skuList', { id: productId, page: 1, size: 100 })
      .then((result) => {
        if (!alive) return;
        const records = (result?.records || []).filter((item) => Number(item.isEnabled ?? 1) !== 0);
        setSkus(records);
        if (!records.length) setSingleStock(String(stock || 0));
      })
      .catch((error) => alive && Toast.error({ content: error.message }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, productId]);

  const save = async () => {
    if (isDemo()) {
      Toast.warning({ content: t('演示模式不支持操作') });
      return;
    }
    if (skus.length > 0) {
      const empty = skus.find((item) => item.skuStock === undefined || item.skuStock === null || String(item.skuStock) === '');
      if (empty) {
        Toast.error({ content: t('请填写库存') });
        return;
      }
    } else if (singleStock === '') {
      Toast.error({ content: t('请填写库存') });
      return;
    }
    setSaving(true);
    try {
      if (skus.length > 0) {
        await apiPost('/product/product/updateField', {
          id: productId,
          field: 'productSku',
          val: skus.map((item) => ({ skuId: item.skuId, skuStock: Number(item.skuStock || 0) })),
        });
      } else {
        await apiPost('/product/product/updateField', {
          id: productId,
          field: 'productStock',
          val: Number(singleStock || 0),
        });
      }
      Toast.success({ content: t('操作成功') });
      setVisible(false);
      onSaved();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover
      trigger="custom"
      visible={visible}
      onClickOutSide={() => setVisible(false)}
      content={
        <div style={{ width: skus.length > 0 ? 320 : 180, padding: 4 }}>
          <Spin spinning={loading}>
            {skus.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                {skus.map((item) => (
                  <div key={item.skuId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {formatSkuValue(item.skuValue)}
                      </div>
                      {item.skuSn ? (
                        <Text type="tertiary" size="small">
                          {item.skuSn}
                        </Text>
                      ) : null}
                    </div>
                    <InputNumber
                      precision={0}
                      min={0}
                      style={{ width: 100 }}
                      value={Number(item.skuStock || 0)}
                      onChange={(next) =>
                        setSkus((current) =>
                          current.map((row) =>
                            row.skuId === item.skuId ? { ...row, skuStock: Number(next || 0) } : row,
                          ),
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            ) : (
              <InputNumber
                precision={0}
                min={0}
                style={{ width: 140 }}
                value={Number(singleStock || 0)}
                onChange={(next) => setSingleStock(String(Number(next || 0)))}
              />
            )}
          </Spin>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <Button size="small" onClick={() => setVisible(false)}>
              {t('取消')}
            </Button>
            <Button size="small" theme="solid" type="primary" loading={saving} onClick={save}>
              {t('保存')}
            </Button>
          </div>
        </div>
      }
    >
      <span
        style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2 }}
        onClick={(event) => {
          event.stopPropagation();
          setVisible(true);
        }}
      >
        {stock}
        <IconEdit size="small" style={{ color: 'var(--semi-color-text-2)' }} />
      </span>
    </Popover>
  );
}

export default function Products() {
  const { t } = useI18n();
  const statusOptions = buildStatusOptions(t);
  const [rows, setRows] = useState<ProductRow[]>(isDemo() ? mockProductPage.records : []);
  const [total, setTotal] = useState(isDemo() ? mockProductPage.total : 0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(!isDemo());
  const [reloadKey, setReloadKey] = useState(0);
  const [categories, setCategories] = useState<Option[]>([
    { id: 1010, name: '拆解设备' },
    { id: 1011, name: '环保设备' },
    { id: 1012, name: '自动化' },
  ]);
  const [brands, setBrands] = useState<Option[]>([{ id: 2, name: '万物新生' }]);
  const [modalOpen, setModalOpen] = useState(
    () => new URLSearchParams(window.location.search).get('modal') === 'product',
  );
  const [editingId, setEditingId] = useState<number | undefined>(undefined);
  /** 在售状态切换中的商品（防重复点击） */
  const [salePendingId, setSalePendingId] = useState<number | undefined>(undefined);
  /** 批量选择（对齐旧版批量操作栏） */
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  /** URL 携带的商品 ID 过滤（如库存预警「相关商品」跳转） */
  const [urlProductIds, setUrlProductIds] = useState<number[]>(() => {
    const raw = new URLSearchParams(window.location.search).get('productIds') || '';
    return raw
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item) && item > 0);
  });

  useEffect(() => {
    if (isDemo()) return;
    let alive = true;
    apiGet<{ catList: Array<{ categoryId: number; categoryName: string }>; brandList: Array<{ brandId: number; brandName: string }> }>(
      '/product/product/catAndBrandList',
    )
      .then((result) => {
        if (!alive) return;
        setCategories((result.catList || []).map((item) => ({ id: item.categoryId, name: item.categoryName })));
        setBrands((result.brandList || []).map((item) => ({ id: item.brandId, name: item.brandName })));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (isDemo()) return;
    let alive = true;
    setLoading(true);
    apiGet<PageResult<ProductRow>>('/product/product/list', {
      page,
      pageSize: 10,
      keyword: keyword || undefined,
      // 页签映射（对齐旧版 onTabChange）：
      // check:N → checkStatus=N；recycle → isDelete=1；其余 → productStatus
      ...(status.startsWith('check:')
        ? { checkStatus: Number(status.split(':')[1]), isDelete: 0 }
        : status === 'recycle'
          ? { isDelete: 1 }
          : { productStatus: status || undefined, isDelete: 0 }),
      productIds: urlProductIds.length ? urlProductIds : undefined,
    })
      .then((result) => {
        if (!alive) return;
        setRows(result.records || []);
        setTotal(result.total || 0);
      })
      .catch((error) => alive && Toast.error({ content: error.message }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [page, status, reloadKey, urlProductIds]);

  const search = () => {
    setPage(1);
    setReloadKey((key) => key + 1);
  };

  const toggleStatus = async (record: ProductRow) => {
    if (isDemo()) {
      Toast.warning({ content: t('演示模式不支持操作') });
      return;
    }
    try {
      const next = record.productStatus === 1 ? 0 : 1;
      await apiPost('/product/product/updateField', {
        id: record.productId,
        field: 'productStatus',
        val: next,
      });
      Toast.success({ content: next === 1 ? t('商品已上架') : t('商品已下架') });
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    }
  };

  /** 在售状态切换（v5.8.61，对齐原版 List.vue changeSaleStatus：POST /product/product/saleStatus） */
  const changeSaleStatus = async (record: ProductRow, val: number) => {
    if (isDemo()) {
      Toast.warning({ content: t('演示模式不支持操作') });
      return;
    }
    setSalePendingId(record.productId);
    try {
      await apiPost('/product/product/saleStatus', {
        productId: record.productId,
        saleStatus: val,
        saleBanTime: 0,
      });
      Toast.success({ content: val === 1 ? t('商品已设为可售') : t('商品已设为禁售') });
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    } finally {
      setSalePendingId(undefined);
    }
  };

  const remove = async (record: ProductRow) => {
    if (isDemo()) {
      Toast.warning({ content: t('演示模式不支持操作') });
      return;
    }
    try {
      await apiPost('/product/product/del', { id: record.productId });
      Toast.success({ content: t('商品已删除') });
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
    }
  };

  /** 复制商品（对齐旧版 List.vue「复制」：POST /product/product/copy {id}）。 */
  const copyProduct = async (record: ProductRow) => {
    if (isDemo()) {
      Toast.warning({ content: t('演示模式不支持操作') });
      return;
    }
    try {
      await apiPost('/product/product/copy', { id: record.productId });
      Toast.success({ content: t('商品已复制') });
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('复制失败') });
    }
  };

  /** 单商品批量操作（行内「移入回收站 / 还原」）。 */
  const submitRowBatch = async (type: 'recycle' | 'restore', record: ProductRow) => {
    if (isDemo()) {
      Toast.warning({ content: t('演示模式不支持操作') });
      return;
    }
    try {
      await apiPost('/product/product/batch', { ids: [record.productId], type });
      Toast.success({ content: type === 'recycle' ? t('商品已移入回收站') : t('商品已还原') });
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    }
  };

  /** 行内排序编辑（对齐旧版 PopForm 排序：updateField field=sortOrder）。 */
  const updateSort = async (record: ProductRow, value: number) => {
    try {
      await apiPost('/product/product/updateField', {
        id: record.productId,
        field: 'sortOrder',
        val: Number(value || 0),
      });
      Toast.success({ content: t('排序已更新') });
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    }
  };

  /** 批量操作（对齐旧版 onBatchSubmit：up/down/recycle/restore/audit/del）。 */
  const batchSubmit = async (type: 'up' | 'down' | 'recycle' | 'restore' | 'audit' | 'del') => {
    if (isDemo()) {
      Toast.warning({ content: t('演示模式不支持操作') });
      return;
    }
    if (selectedIds.length === 0) return;
    const successText: Record<string, string> = {
      up: t('商品已上架'),
      down: t('商品已下架'),
      recycle: t('商品已移入回收站'),
      restore: t('商品已还原'),
      audit: t('批量审核通过'),
      del: t('商品已删除'),
    };
    try {
      await apiPost('/product/product/batch', { ids: selectedIds, type });
      Toast.success({ content: successText[type] });
      setSelectedIds([]);
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    }
  };

  return (
    <>
      <Card className="table-card" shadows="hover">
        <div className="table-toolbar">
          <Space>
            <Input
              prefix={<IconSearch />}
              placeholder={t('搜索商品名称 / 编号')}
              value={keyword}
              onChange={setKeyword}
              onEnterPress={search}
              style={{ width: 280 }}
            />
            <Select
              value={status}
              onChange={(value) => {
                setStatus(String(value || ''));
                setPage(1);
              }}
              optionList={statusOptions}
              style={{ width: 140 }}
            />
            <Button theme="solid" type="primary" onClick={search}>
              {t('查询')}
            </Button>
          </Space>
          <Space>
            <Button icon={<IconRefresh />} onClick={() => setReloadKey((key) => key + 1)}>
              {t('刷新')}
            </Button>
            <Button
              theme="solid"
              type="primary"
              icon={<IconPlus />}
              onClick={() => {
                setEditingId(undefined);
                setModalOpen(true);
              }}
            >
              {t('新增商品')}
            </Button>
          </Space>
        </div>

        {selectedIds.length > 0 && (
          <div className="batch-floating-bar">
            <span>
              {t('已选择 {count} 项', { count: selectedIds.length })}
            </span>
            <Space spacing={4} wrap>
              <Popconfirm title={t('您确认要批量上架吗？')} onConfirm={() => batchSubmit('up')}>
                <Button size="small">{t('批量上架')}</Button>
              </Popconfirm>
              <Popconfirm title={t('您确认要批量下架吗？')} onConfirm={() => batchSubmit('down')}>
                <Button size="small">{t('批量下架')}</Button>
              </Popconfirm>
              {status !== 'recycle' && (
                <Popconfirm title={t('您确认要批量移入回收站吗？')} onConfirm={() => batchSubmit('recycle')}>
                  <Button size="small">{t('批量移入回收站')}</Button>
                </Popconfirm>
              )}
              {status === 'recycle' && (
                <Popconfirm title={t('您确认要批量还原吗？')} onConfirm={() => batchSubmit('restore')}>
                  <Button size="small">{t('批量还原')}</Button>
                </Popconfirm>
              )}
              {status === 'check:0' && (
                <Popconfirm title={t('您确认要批量通过审核吗？')} onConfirm={() => batchSubmit('audit')}>
                  <Button size="small">{t('批量通过审核')}</Button>
                </Popconfirm>
              )}
              <Popconfirm title={t('您确认要批量删除吗？')} onConfirm={() => batchSubmit('del')}>
                <Button size="small" type="danger">{t('批量删除')}</Button>
              </Popconfirm>
            </Space>
            <Button theme="borderless" size="small" onClick={() => setSelectedIds([])}>
              {t('取消选择')}
            </Button>
          </div>
        )}

        <Table
          loading={loading}
          dataSource={rows}
          rowKey="productId"
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys) => setSelectedIds((keys || []).map((key) => Number(key))),
          }}
          pagination={{
            currentPage: page,
            pageSize: 10,
            total,
            onChange: (nextPage: number) => setPage(nextPage),
          }}
          columns={[
            {
              title: t('商品'),
              dataIndex: 'productName',
              render: (value: string, record: ProductRow) => (
                <div className="product-cell">
                  {record.picThumb ? (
                    <Avatar shape="square" src={record.picThumb} size="small" />
                  ) : (
                    <div className="product-thumb">W</div>
                  )}
                  <div>
                    <div className="product-name">{value}</div>
                    <Text type="tertiary" size="small">
                      {record.productSn || '-'}
                    </Text>
                  </div>
                </div>
              ),
            },
            {
              title: t('销售价'),
              dataIndex: 'productPrice',
              width: 140,
              render: (value: string) => <span className="money">¥ {Number(value || 0).toLocaleString()}</span>,
            },
            {
              title: t('库存'),
              dataIndex: 'productStock',
              width: 110,
              render: (value: number, record: ProductRow) => (
                <StockPopover
                  productId={record.productId}
                  stock={Number(value || 0)}
                  onSaved={() => setReloadKey((key) => key + 1)}
                />
              ),
            },
            {
              title: t('状态'),
              dataIndex: 'productStatus',
              width: 90,
              render: (value: number) =>
                value === 1 ? <Tag color="green">{t('在售')}</Tag> : <Tag color="grey">{t('下架')}</Tag>,
            },
            {
              title: t('在售状态'),
              dataIndex: 'saleStatus',
              width: 100,
              render: (_: unknown, record: ProductRow) => {
                const onSale = Number(record.saleStatus ?? 1) === 1;
                return (
                  <Popconfirm
                    title={onSale ? t('确定将所选商品设为禁售状态吗?') : t('确定将所选商品设为可售状态吗?')}
                    onConfirm={() => changeSaleStatus(record, onSale ? 0 : 1)}
                  >
                    <Switch
                      size="small"
                      checked={onSale}
                      loading={salePendingId === record.productId}
                    />
                  </Popconfirm>
                );
              },
            },
            {
              title: t('审核'),
              dataIndex: 'checkStatus',
              width: 100,
              render: (value: number) => {
                const map: Record<number, { color: string; text: string }> = {
                  0: { color: 'orange', text: t('待审核') },
                  1: { color: 'green', text: t('已通过') },
                  2: { color: 'red', text: t('未通过') },
                };
                const item = map[value] || map[0];
                return <Tag color={item.color as any}>{item.text}</Tag>;
              },
            },
            {
              title: t('排序'),
              dataIndex: 'sortOrder',
              width: 90,
              render: (value: number, record: ProductRow) => (
                <InputNumber
                  size="small"
                  style={{ width: 70 }}
                  precision={0}
                  defaultValue={Number(value || 0)}
                  onBlur={(event) => {
                    const next = Number((event.target as HTMLInputElement)?.value || 0);
                    if (next !== Number(value || 0)) updateSort(record, next);
                  }}
                />
              ),
            },
            {
              title: t('操作'),
              width: 300,
              render: (_: unknown, record: ProductRow) => (
                <Space spacing={4}>
                  <Button
                    theme="borderless"
                    size="small"
                    onClick={() => {
                      setEditingId(record.productId);
                      setModalOpen(true);
                    }}
                  >
                    {t('编辑')}
                  </Button>
                  <Button theme="borderless" size="small" onClick={() => copyProduct(record)}>
                    {t('复制')}
                  </Button>
                  <Button theme="borderless" size="small" onClick={() => toggleStatus(record)}>
                    {record.productStatus === 1 ? t('下架') : t('上架')}
                  </Button>
                  {status !== 'recycle' ? (
                    <Popconfirm title={t('确定把该商品移入回收站吗？')} onConfirm={() => submitRowBatch('recycle', record)}>
                      <Button theme="borderless" size="small">{t('移入回收站')}</Button>
                    </Popconfirm>
                  ) : (
                    <Popconfirm title={t('确定将该商品还原吗？')} onConfirm={() => submitRowBatch('restore', record)}>
                      <Button theme="borderless" size="small">{t('还原')}</Button>
                    </Popconfirm>
                  )}
                  <Popconfirm title={t('确定删除该商品？')} onConfirm={() => remove(record)}>
                    <Button theme="borderless" type="danger" size="small">
                      {t('删除')}
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <ProductFormDrawer
        visible={modalOpen}
        productId={editingId}
        categories={categories}
        brands={brands}
        onCancel={() => setModalOpen(false)}
        onSaved={() => setReloadKey((key) => key + 1)}
      />
    </>
  );
}
