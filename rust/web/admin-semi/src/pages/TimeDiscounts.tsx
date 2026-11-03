import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Image,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconPlus, IconRefresh, IconSearch } from '@douyinfe/semi-icons';
import { apiGet, apiPost, isDemo } from '../api';
import { useI18n } from '../i18n';
import FormDrawer from '../framework/FormDrawer';
import type { ColumnConfig, FormDrawerConfig } from '../framework/types';
import './time-discounts.css';

const { Text } = Typography;

interface ProductItem {
  productId: number;
  productName: string;
  productSn?: string;
  productPrice?: number | string;
  picThumb?: string;
  picUrl?: string;
  productStock?: number;
}

/** 折扣明细行：item 基础字段 + 选择商品时补充的商品展示信息 */
interface DiscountItemRow {
  itemId?: number;
  productId: number;
  productName?: string;
  productSn?: string;
  picThumb?: string;
  productPrice?: number | string;
  /** 适用 SKU 列表；为空表示作用于该商品全部规格 */
  skuIds?: number[];
  /** 1 打折 2 减钱 3 促销（固定价） */
  discountType: number;
  value?: number | string;
}

interface TimeDiscountRow {
  discountId: number;
  promotionName?: string;
  /** Unix 秒 */
  startTime: number;
  /** Unix 秒 */
  endTime: number;
  /** 1 未开始 2 进行中 3 已结束 */
  status: number;
  statusName?: string;
  item?: DiscountItemRow[];
}

type DiscountColumn = ColumnConfig<TimeDiscountRow> & { fixed?: 'left' | 'right' };

/** Unix 秒 → 'YYYY-MM-DD HH:mm:ss'（本地时区） */
const formatDateTime = (seconds: unknown) => {
  const value = Number(seconds);
  if (!value || Number.isNaN(value)) return '--';
  const date = new Date(value * 1000);
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

/** 'YYYY-MM-DD HH:mm:ss' → Unix 秒（本地时区），非法输入返回 undefined */
const toTimestamp = (value: unknown) => {
  const text = String(value || '').trim();
  if (!text) return undefined;
  const normalized = text.includes('T') ? text : text.replace(' ', 'T');
  const time = new Date(normalized).getTime();
  if (Number.isNaN(time)) return undefined;
  return Math.floor(time / 1000);
};

/** DatePicker onChange 两参版本兼容：取其中的字符串值 */
const pickDateStr = (first: unknown, second: unknown) => {
  if (typeof first === 'string') return first;
  if (typeof second === 'string') return second;
  return '';
};

/** 活动状态（与后端派生 status 一致）：1 未开始 2 进行中 3 已结束 */
const STATUS_META: Record<number, { text: string; color: string }> = {
  1: { text: '未开始', color: 'orange' },
  2: { text: '进行中', color: 'green' },
  3: { text: '已结束', color: 'grey' },
};

const ACTIVE_STATE_OPTIONS = [
  { label: '活动进行中', value: 2 },
  { label: '活动已结束', value: 3 },
  { label: '活动未开始', value: 1 },
];

/** 列表筛选项定义（keyword 服务端筛选；activeState 后端暂未支持，客户端过滤） */
const FILTERS = [
  {
    field: 'keyword',
    label: '活动名称',
    type: 'input',
    placeholder: '输入活动名称',
  },
  {
    field: 'activeState',
    label: '活动状态',
    type: 'select',
    options: ACTIVE_STATE_OPTIONS,
  },
];

const DISCOUNT_TYPE_OPTIONS = [
  { label: '打折', value: 1 },
  { label: '减钱', value: 2 },
  { label: '促销', value: 3 },
];

const DEFAULT_FORM = {
  promotionName: '',
  startTime: '',
  endTime: '',
  item: [] as DiscountItemRow[],
};

/** 商品选择弹窗（返回完整商品行，供折扣明细表展示编号/原价等信息） */
function ProductPickerModal({
  visible,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (products: ProductItem[]) => void;
}) {
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ProductItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();
  const [selectedRows, setSelectedRows] = useState<ProductItem[]>([]);

  const loadProducts = async (nextPage = 1, nextKeyword = '') => {
    setLoading(true);
    try {
      const result = await apiGet<{ records: ProductItem[]; total: number }>(
        '/product/product/list',
        { keyword: nextKeyword || undefined, page: nextPage, pageSize: 10 },
      );
      setRows(result.records || []);
      setTotal(result.total || 0);
      setPage(nextPage);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('商品加载失败') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    setKeyword('');
    setSelectedRows([]);
    void loadProducts(1, '');
  }, [visible]);

  return (
    <Modal
      title={t('选择商品')}
      visible={visible}
      onCancel={onCancel}
      width={780}
      footer={
        <Space>
          <span className="time-discount-picker-count">{t('已选择 {count} 个商品', { count: selectedRows.length })}</span>
          <Button onClick={onCancel}>{t('取消')}</Button>
          <Button theme="solid" type="primary" onClick={() => onConfirm(selectedRows)}>
            {t('确定')}
          </Button>
        </Space>
      }
    >
      <Space style={{ marginBottom: 12 }}>
        <Input
          prefix={<IconSearch />}
          placeholder={t('搜索商品名称 / 编号')}
          value={keyword}
          onChange={setKeyword}
          onEnterPress={() => loadProducts(1, keyword)}
          style={{ width: 300 }}
        />
        <Button onClick={() => loadProducts(1, keyword)}>{t('搜索')}</Button>
      </Space>
      <Table
        loading={loading}
        dataSource={rows}
        rowKey="productId"
        rowSelection={{
          selectedRowKeys: selectedRows.map((row) => row.productId),
          onChange: (keys: any, currentPageRows: any) => {
            const keySet = new Set(keys.map(Number));
            setSelectedRows((current) => {
              const merged = current.filter((row) => keySet.has(row.productId));
              (currentPageRows || []).forEach((row: ProductItem) => {
                if (keySet.has(row.productId) && !merged.some((item) => item.productId === row.productId)) {
                  merged.push(row);
                }
              });
              return merged;
            });
          },
        }}
        pagination={{
          currentPage: page,
          pageSize: 10,
          total,
          onChange: (next: number) => loadProducts(next, keyword),
        }}
        columns={[
          {
            title: t('商品信息'),
            dataIndex: 'productName',
            render: (_: unknown, record: ProductItem) => (
              <div className="time-discount-item-info">
                {record.picThumb || record.picUrl ? (
                  <Image
                    src={record.picThumb || record.picUrl}
                    width={40}
                    height={40}
                    style={{ objectFit: 'cover', borderRadius: 4 }}
                  />
                ) : (
                  <span />
                )}
                <div>
                  <div className="time-discount-item-name">{record.productName}</div>
                  {record.productSn ? (
                    <div className="time-discount-item-sn">{t('编号：')}{record.productSn}</div>
                  ) : null}
                </div>
              </div>
            ),
          },
          {
            title: t('商品价格'),
            dataIndex: 'productPrice',
            width: 120,
            render: (value: unknown) => <span>¥ {Number(value ?? 0)}</span>,
          },
          { title: t('商品库存'), dataIndex: 'productStock', width: 100 },
        ] as any}
      />
    </Modal>
  );
}

/** 活动商品折扣明细编辑器（对应旧 DiscountForm.vue） */
function DiscountItemEditor({
  value,
  onChange,
}: {
  value: DiscountItemRow[];
  onChange: (items: DiscountItemRow[]) => void;
}) {
  const { t } = useI18n();
  const [pickerOpen, setPickerOpen] = useState(false);

  const updateRow = (productId: number, patch: Partial<DiscountItemRow>) => {
    onChange(value.map((row) => (row.productId === productId ? { ...row, ...patch } : row)));
  };

  const removeRow = (productId: number) => {
    onChange(value.filter((row) => row.productId !== productId));
  };

  const confirmPick = (products: ProductItem[]) => {
    const known = new Set(value.map((row) => row.productId));
    const next: DiscountItemRow[] = [
      ...value,
      ...products
        .filter((product) => !known.has(product.productId))
        .map((product) => ({
          productId: product.productId,
          productName: product.productName,
          productSn: product.productSn,
          picThumb: product.picThumb || product.picUrl,
          productPrice: product.productPrice,
          skuIds: [] as number[],
          discountType: 1,
          value: undefined as number | string | undefined,
        })),
    ];
    onChange(next);
    setPickerOpen(false);
  };

  return (
    <div className="time-discount-items">
      <Space>
        <Button theme="solid" type="primary" onClick={() => setPickerOpen(true)}>
          {t('选择商品')}
        </Button>
        {value.length > 0 ? (
          <>
            <span className="time-discount-picker-count">
              {t('已选择 {count} 个商品', { count: value.length })}
            </span>
            <Button onClick={() => onChange([])}>{t('清空')}</Button>
          </>
        ) : null}
      </Space>
      {value.length > 0 ? (
        <Table
          size="small"
          dataSource={value}
          rowKey="productId"
          pagination={false}
          style={{ marginTop: 10 }}
          columns={[
            {
              title: t('商品编号'),
              dataIndex: 'productSn',
              width: 110,
              render: (v: unknown) => <span>{(v as string) || '-'}</span>,
            },
            {
              title: t('商品信息'),
              dataIndex: 'productName',
              width: 250,
              render: (_: unknown, row: DiscountItemRow) => (
                <div className="time-discount-item-info">
                  {row.picThumb ? (
                    <Image
                      src={row.picThumb}
                      width={50}
                      height={50}
                      style={{ objectFit: 'cover', borderRadius: 4 }}
                    />
                  ) : (
                    <span />
                  )}
                  <div>
                    <div className="time-discount-item-name">{row.productName || '-'}</div>
                    <div className="time-discount-item-sn" title={t('skuIds 为空表示作用于该商品全部规格')}>
                      {row.skuIds && row.skuIds.length > 0
                        ? t('已选{count}个规格', { count: row.skuIds.length })
                        : t('全部规格')}
                    </div>
                  </div>
                </div>
              ),
            },
            {
              title: t('原价'),
              dataIndex: 'productPrice',
              width: 100,
              render: (_: unknown, row: DiscountItemRow) => <span>¥ {Number(row.productPrice ?? 0)}</span>,
            },
            {
              title: t('优惠方式'),
              dataIndex: 'discountType',
              width: 110,
              render: (_: unknown, row: DiscountItemRow) => (
                <Select
                  size="small"
                  style={{ width: 90 }}
                  optionList={DISCOUNT_TYPE_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))}
                  value={row.discountType}
                  onChange={(next) => updateRow(row.productId, { discountType: Number(next) })}
                />
              ),
            },
            {
              title: t('优惠内容'),
              dataIndex: 'value',
              width: 170,
              render: (_: unknown, row: DiscountItemRow) => (
                <div className="time-discount-value-cell">
                  {row.discountType === 2 ? <Text>{t('减')}</Text> : null}
                  <InputNumber
                    size="small"
                    style={{ width: 90 }}
                    min={row.discountType === 1 ? 0.1 : 0.01}
                    max={row.discountType === 1 ? 9.9 : Number(row.productPrice ?? 999999)}
                    precision={row.discountType === 1 ? 1 : 2}
                    value={
                      row.value === undefined || row.value === null || row.value === ''
                        ? undefined
                        : Number(row.value)
                    }
                    onChange={(next) =>
                      updateRow(row.productId, {
                        value: next === undefined || next === null ? '' : next,
                      })
                    }
                  />
                  <Text>{row.discountType === 1 ? t('折') : t('元')}</Text>
                </div>
              ),
            },
            {
              title: t('操作'),
              width: 80,
              render: (_: unknown, row: DiscountItemRow) => (
                <Button theme="borderless" type="danger" size="small" onClick={() => removeRow(row.productId)}>
                  {t('删除')}
                </Button>
              ),
            },
          ] as any}
        />
      ) : null}
      <ProductPickerModal
        visible={pickerOpen}
        onCancel={() => setPickerOpen(false)}
        onConfirm={confirmPick}
      />
    </div>
  );
}

export default function TimeDiscounts() {
  const { t } = useI18n();
  const [rows, setRows] = useState<TimeDiscountRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(!isDemo());
  const [reloadKey, setReloadKey] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  /** 活动状态筛选（后端 list 暂未支持该参数，在已加载结果上过滤） */
  const [activeState, setActiveState] = useState<number | undefined>(undefined);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [drawerInitial, setDrawerInitial] = useState<Record<string, any>>({ ...DEFAULT_FORM });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = () => {
    setSelectedIds([]);
    setReloadKey((key) => key + 1);
  };

  useEffect(() => {
    if (isDemo()) return;
    let alive = true;
    setLoading(true);
    apiGet<{ records: TimeDiscountRow[]; total: number }>('/promotion/timeDiscount/list', {
      page,
      size: 10,
      keyword: appliedKeyword || undefined,
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
  }, [page, appliedKeyword, reloadKey]);

  const search = () => {
    setPage(1);
    setAppliedKeyword(keyword.trim());
    setReloadKey((key) => key + 1);
  };

  const reset = () => {
    setKeyword('');
    setActiveState(undefined);
    setPage(1);
    setAppliedKeyword('');
    setReloadKey((key) => key + 1);
  };

  const openCreate = () => {
    setDrawerMode('create');
    setEditingId(null);
    setDrawerInitial({ ...DEFAULT_FORM, item: [] });
    setDrawerOpen(true);
  };

  const openEdit = async (row: TimeDiscountRow) => {
    setDrawerMode('edit');
    setEditingId(row.discountId);
    let detail: any = row;
    try {
      detail = (await apiGet<any>('/promotion/timeDiscount/detail', { id: row.discountId })) || row;
    } catch (error) {
      detail = row;
    }
    const items: DiscountItemRow[] = Array.isArray(detail.item) ? detail.item : [];
    const productIds = Array.from(new Set(items.map((item) => item.productId).filter(Boolean)));
    const productsById = new Map<number, ProductItem>();
    if (productIds.length) {
      try {
        const result = await apiGet<{ records: ProductItem[] }>('/product/product/list', {
          ids: productIds.join(','),
          page: 1,
          pageSize: 100,
        });
        (result.records || []).forEach((product) => productsById.set(product.productId, product));
      } catch {
        // 商品信息加载失败时仅回显折扣字段
      }
    }
    setDrawerInitial({
      discountId: detail.discountId ?? row.discountId,
      promotionName: detail.promotionName || '',
      startTime: formatDateTime(detail.startTime),
      endTime: formatDateTime(detail.endTime),
      item: items.map((item) => {
        const product = productsById.get(item.productId);
        return {
          ...item,
          productName: product?.productName || item.productName || '',
          productSn: product?.productSn || item.productSn || '',
          picThumb: product?.picThumb || product?.picUrl || item.picThumb || '',
          productPrice: product?.productPrice ?? item.productPrice,
          skuIds: Array.isArray(item.skuIds) ? item.skuIds : [],
          discountType: Number(item.discountType || 1),
        };
      }),
    });
    setDrawerOpen(true);
  };

  const validateForm = (values: Record<string, any>) => {
    if (!String(values.promotionName || '').trim()) {
      Toast.error({ content: t('请输入活动名称！') });
      return false;
    }
    if (!String(values.startTime || '')) {
      Toast.error({ content: t('活动日期不能为空') });
      return false;
    }
    if (!String(values.endTime || '')) {
      Toast.error({ content: t('活动日期不能为空') });
      return false;
    }
    const start = toTimestamp(values.startTime);
    const end = toTimestamp(values.endTime);
    if (start === undefined || end === undefined) {
      Toast.error({ content: t('活动日期格式不正确') });
      return false;
    }
    if (start >= end) {
      Toast.error({ content: t('开始时间必须早于结束时间') });
      return false;
    }
    const items: DiscountItemRow[] = values.item || [];
    if (!items.length) {
      Toast.error({ content: t('活动商品不能为空') });
      return false;
    }
    for (const item of items) {
      const name = item.productName || t('商品{id}', { id: item.productId });
      if (item.value === undefined || item.value === null || String(item.value) === '') {
        Toast.error({ content: t('【{name}】: 请输入折扣值', { name }) });
        return false;
      }
      const value = Number(item.value);
      if (Number.isNaN(value) || value <= 0) {
        Toast.error({ content: t('【{name}】: 请输入折扣值', { name }) });
        return false;
      }
      if (item.discountType === 1 && value > 9.9) {
        Toast.error({ content: t('【{name}】: 请输入0.1-9.9之间折扣', { name }) });
        return false;
      }
      if (item.discountType > 1 && value > Number(item.productPrice ?? 0)) {
        Toast.error({ content: t('【{name}】: 请输入大于0并且小于商品原价的折扣', { name }) });
        return false;
      }
    }
    return true;
  };

  const saveActivity = async (values: Record<string, any>) => {
    if (!validateForm(values)) return;
    const items: DiscountItemRow[] = values.item || [];
    setSaving(true);
    try {
      const body = {
        promotionName: String(values.promotionName || '').trim(),
        startTime: toTimestamp(values.startTime),
        endTime: toTimestamp(values.endTime),
        productIds: items.map((item) => item.productId),
        item: items.map((item) => ({
          productId: item.productId,
          skuIds: Array.isArray(item.skuIds) ? item.skuIds : [],
          discountType: Number(item.discountType),
          value: Number(item.value),
        })),
      };
      if (drawerMode === 'edit' && editingId) {
        await apiPost('/promotion/timeDiscount/update', { ...body, discountId: editingId });
      } else {
        await apiPost('/promotion/timeDiscount/create', body);
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

  const deleteActivity = async (row: TimeDiscountRow) => {
    try {
      await apiPost('/promotion/timeDiscount/del', { id: row.discountId });
      Toast.success({ content: t('删除成功') });
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
    }
  };

  const batchDelete = async () => {
    try {
      await apiPost('/promotion/timeDiscount/batch', { ids: selectedIds, type: 'del' });
      Toast.success({ content: t('批量删除成功') });
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('批量删除失败') });
    }
  };

  const drawerConfig: FormDrawerConfig = {
    title: '限时折扣',
    width: 1040,
    labelWidth: 110,
    inputWidth: 400,
    createApi: '/promotion/timeDiscount/create',
    updateApi: '/promotion/timeDiscount/update',
    idField: 'discountId',
    sections: [
      {
        key: 'basic',
        title: '基础信息',
        fields: [
          {
            field: 'promotionName',
            label: t('活动名称'),
            type: 'input',
            required: true,
            placeholder: t('请输入活动名称'),
            rules: [
              { required: true, message: t('请输入活动名称！') },
              { max: 60, message: t('活动名称不能超过60个字') },
            ],
          },
          {
            field: 'activityTime',
            label: t('活动时间'),
            type: 'custom',
            render: ({ formApi, values }) => (
              <div>
                <Space>
                  <DatePicker
                    type="dateTime"
                    format="yyyy-MM-dd HH:mm:ss"
                    placeholder={t('开始时间')}
                    style={{ width: 200 }}
                    value={(values.startTime as string) || ''}
                    onChange={(first: unknown, second: unknown) =>
                      formApi?.setValue('startTime', pickDateStr(first, second))
                    }
                    onClear={() => formApi?.setValue('startTime', '')}
                  />
                  <Text>{t('至')}</Text>
                  <DatePicker
                    type="dateTime"
                    format="yyyy-MM-dd HH:mm:ss"
                    placeholder={t('截止时间')}
                    style={{ width: 200 }}
                    value={(values.endTime as string) || ''}
                    onChange={(first: unknown, second: unknown) =>
                      formApi?.setValue('endTime', pickDateStr(first, second))
                    }
                    onClear={() => formApi?.setValue('endTime', '')}
                  />
                </Space>
                <div className="time-discount-extra">
                  {t('只有当前时间介于起始日期和截止日期之间时，此活动才可以生效')}
                </div>
              </div>
            ),
          },
          {
            field: 'item',
            label: t('活动商品'),
            type: 'custom',
            render: ({ formApi, values }) => (
              <DiscountItemEditor
                value={(values.item as DiscountItemRow[]) || []}
                onChange={(items) => formApi?.setValue('item', items)}
              />
            ),
          },
        ],
      },
    ],
  };

  // 状态筛选：后端 list 未提供 activeState 参数，在当前页结果上过滤
  const displayRows = activeState
    ? rows.filter((row) => Number(row.status) === activeState)
    : rows;

  const columns: DiscountColumn[] = [
    {
      title: t('活动名称'),
      dataIndex: 'promotionName',
      width: 220,
      render: (value: string) => <span>{value || '--'}</span>,
    },
    {
      title: t('起始日期'),
      dataIndex: 'startTime',
      width: 180,
      render: (value: number) => <span title={t('活动开始时间')}>{formatDateTime(value)}</span>,
    },
    {
      title: t('截止日期'),
      dataIndex: 'endTime',
      width: 180,
      render: (value: number) => <span title={t('活动截止时间')}>{formatDateTime(value)}</span>,
    },
    {
      title: t('状态'),
      dataIndex: 'statusName',
      width: 100,
      render: (_: unknown, row: TimeDiscountRow) => {
        const meta = STATUS_META[Number(row.status)] || { text: row.statusName || '-', color: 'grey' };
        return (
          <span title={t('活动状态')}>
            <Tag color={meta.color as never}>{row.statusName || t(meta.text)}</Tag>
          </span>
        );
      },
    },
    {
      title: t('操作'),
      dataIndex: 'actions',
      fixed: 'right',
      width: 150,
      render: (_: unknown, row: TimeDiscountRow) => (
        <Space spacing={2}>
          <Button theme="borderless" size="small" onClick={() => openEdit(row)}>
            {t('编辑')}
          </Button>
          <Popconfirm title={t('确定删除？')} onConfirm={() => deleteActivity(row)}>
            <Button theme="borderless" type="danger" size="small">
              {t('删除')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card className="table-card" shadows="hover">
        <div className="table-toolbar">
          <Space>
            <span className="framework-filter">
              <Input
                prefix={<IconSearch />}
                placeholder={t('输入活动名称')}
                value={keyword}
                onChange={setKeyword}
                onEnterPress={search}
                style={{ width: 240 }}
              />
            </span>
            <Button theme="solid" type="primary" icon={<IconSearch />} onClick={search}>
              {t('搜索')}
            </Button>
            <span className="framework-filter">
              <Select
                placeholder={t('请选择活动状态')}
                optionList={ACTIVE_STATE_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))}
                value={activeState}
                onChange={(next) => setActiveState(next === undefined ? undefined : Number(next))}
                style={{ width: 180 }}
              />
            </span>
            <Button onClick={reset}>{t('重置')}</Button>
          </Space>
          <Space>
            <Button icon={<IconRefresh />} onClick={reload}>
              {t('刷新')}
            </Button>
            <Button theme="solid" type="primary" icon={<IconPlus />} onClick={openCreate}>
              {t('新增限时折扣活动')}
            </Button>
          </Space>
        </div>

        {selectedIds.length > 0 && (
          <div className="batch-floating-bar">
            <span>
              {t('已选择')} <b>{selectedIds.length}</b> {t('项')}
            </span>
            <Popconfirm title={t('您确认要批量删除所选数据吗？')} onConfirm={batchDelete}>
              <Button size="small">{t('批量删除')}</Button>
            </Popconfirm>
            <Button theme="borderless" size="small" onClick={() => setSelectedIds([])}>
              {t('取消选择')}
            </Button>
          </div>
        )}

        <Table
          loading={loading}
          dataSource={displayRows}
          rowKey="discountId"
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys: any) => setSelectedIds((keys as Array<string | number>).map(Number)),
          }}
          empty={
            loading ? null : (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--semi-color-text-2)' }}>
                {t('暂无数据')}
              </div>
            )
          }
          pagination={{
            currentPage: page,
            pageSize: 10,
            total,
            onChange: (next: number) => setPage(next),
          }}
          columns={columns as any}
        />
      </Card>

      <FormDrawer
        visible={drawerOpen}
        mode={drawerMode}
        initialValues={drawerInitial}
        config={drawerConfig}
        saving={saving}
        onCancel={() => setDrawerOpen(false)}
        onSubmit={saveActivity}
      />
    </div>
  );
}
