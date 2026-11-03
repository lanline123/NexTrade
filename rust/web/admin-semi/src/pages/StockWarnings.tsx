import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Image,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Toast,
  Tooltip,
} from '@douyinfe/semi-ui';
import { IconHelpCircle, IconRefresh, IconSearch } from '@douyinfe/semi-icons';
import { apiGet, apiPost, apiUpload, clearToken, getContextHeaders, getToken, isDemo } from '../api';
import { useI18n } from '../i18n';
import FormDrawer from '../framework/FormDrawer';
import type { FormDrawerConfig, OptionItem } from '../framework/types';
import './stock-warnings.css';

/**
 * 库存预警：对应旧版 product/stockWarning/List.vue + SetWarning.vue + ImportWarning.vue。
 * 列表按 SKU 成行（主键 productId + skuId 组合），故不使用 ListPage（其行选择依赖单一 rowKey 字段）。
 */

interface StockWarningRow {
  productId: number;
  skuId: number;
  productName?: string;
  productSkuName?: string;
  productPicThumb?: string;
  productSn?: string;
  skuSn?: string;
  currentStock?: number;
  transitStock?: number;
  lowerLimit?: number | null;
  upperLimit?: number | null;
  stockStatus?: number | null;
  warnEnabled?: number | null;
  relatedProductIds?: number[];
  relatedProductCount?: number;
}

interface StockWarningBatchResult {
  successCount?: number;
  failCount?: number;
  failItems?: Array<{ productId?: number; skuId?: number; reason?: string }>;
}

interface StockWarningImportResult {
  totalCount?: number;
  successCount?: number;
  failCount?: number;
  failItems?: Array<{ rowNumber?: number; productSn?: string; skuSn?: string; reason?: string }>;
}

interface StockWarningTarget {
  productId: number;
  skuId: number;
}

type ImportState = 'idle' | 'success' | 'partial' | 'error';

const PAGE_SIZE = 10;

/** 「全部」在页面上用 -1 表达，后端约定不传即全部 */
const FILTER_ALL = -1;

const STOCK_STATUS_TABS = [
  { value: FILTER_ALL, label: '全部' },
  { value: 1, label: '低库存' },
  { value: 2, label: '高库存' },
  { value: 0, label: '正常库存' },
];

const WARN_ENABLED_OPTIONS: OptionItem[] = [
  { label: '全部', value: FILTER_ALL },
  { label: '已开启', value: 1 },
  { label: '已关闭', value: 0 },
];

const FILTERS = [
  {
    field: 'keyword',
    label: '关键词',
    type: 'input' as const,
    placeholder: '商品名称/商品编码/SKU编码',
    width: 240,
  },
  { field: 'warnEnabled', label: '库存预警', type: 'select' as const, options: WARN_ENABLED_OPTIONS, width: 130 },
];

const STOCK_STATUS_META: Record<number, { label: string; color: string }> = {
  0: { label: '正常库存', color: 'green' },
  1: { label: '低库存', color: 'red' },
  2: { label: '高库存', color: 'orange' },
  3: { label: '无货', color: 'grey' },
};

/** 列表按 SKU 成行，主键是 productId + skuId 组合 */
const stockRowKey = (row?: StockWarningRow) => `${row?.productId ?? 0}-${row?.skuId ?? 0}`;

/** 未配置规则的行没有上下限值，与开关一样留空 */
const formatLimit = (value: number | null | undefined) => (value === 0 || value ? value : '-');

const warnEnabledLabel = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '-';
  return Number(value) === 1 ? '开启' : '关闭';
};

/** 未开启预警的行状态无意义（后端会给「未配置」），统一留空 */
const stockStatusMeta = (row: StockWarningRow) => {
  if (Number(row.warnEnabled) !== 1) return null;
  return STOCK_STATUS_META[Number(row.stockStatus)] || null;
};

/** 下载 xlsx（模板/导出/失败数据）。后端这几个接口直接回二进制流；JSON 响应视为业务错误。 */
const requestDownload = async (
  path: string,
  filename: string,
  options?: { params?: Record<string, unknown>; file?: File | null },
) => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getToken()}`,
    ...getContextHeaders(),
  };
  let res: Response;
  if (options?.file) {
    const form = new FormData();
    form.append('file', options.file);
    res = await fetch(`/adminapi${path}`, { method: 'POST', headers, body: form });
  } else {
    const query = new URLSearchParams();
    Object.entries(options?.params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    });
    const suffix = query.toString() ? `?${query.toString()}` : '';
    res = await fetch(`/adminapi${path}${suffix}`, { headers });
  }
  if (res.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error('登录已过期，请重新登录');
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = (await res.json().catch(() => ({}))) as { msg?: string };
    throw new Error(json?.msg || '请求失败');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const ensureNotDemo = (t: (key: string) => string) => {
  if (isDemo()) {
    Toast.warning({ content: t('演示模式不支持该操作') });
    return false;
  }
  return true;
};

export default function StockWarnings() {
  const { t } = useI18n();
  // 库存预警通知总开关（GET/POST /product/stockWarning/setting）
  const [notifyEnabled, setNotifyEnabled] = useState(0);
  const [notifySaving, setNotifySaving] = useState(false);

  // 列表查询
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState<{ keyword: string; warnEnabled: number }>({
    keyword: '',
    warnEnabled: FILTER_ALL,
  });
  const [stockStatus, setStockStatus] = useState(FILTER_ALL);
  const [sort, setSort] = useState<{ field: string; order: string }>({ field: '', order: '' });
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<StockWarningRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(!isDemo());
  const [reloadKey, setReloadKey] = useState(0);

  // 行选择（keys 跨页保留，rows 由 Map 缓存，对齐旧版 el-table row-key 行为）
  const [selectedKeys, setSelectedKeys] = useState<Array<string | number>>([]);
  const [selectedRows, setSelectedRows] = useState<StockWarningRow[]>([]);
  const selectedMapRef = useRef<Map<string, StockWarningRow>>(new Map());

  // 设置预警（单个/批量共用 FormDrawer）
  const [setOpen, setSetOpen] = useState(false);
  const [setTargets, setSetTargets] = useState<StockWarningTarget[]>([]);
  const [setInitial, setSetInitial] = useState<Record<string, any>>({});
  const [setSaving, setSetSaving] = useState(false);

  // 导入库存预警
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importState, setImportState] = useState<ImportState>('idle');
  const [importMessage, setImportMessage] = useState('');
  const [importSuccessCount, setImportSuccessCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const importedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 批量导出
  const [exporting, setExporting] = useState(false);

  const reload = () => setReloadKey((key) => key + 1);

  useEffect(() => {
    if (isDemo()) return;
    apiGet<{ notifyEnabled?: number }>('/product/stockWarning/setting')
      .then((result) => setNotifyEnabled(result?.notifyEnabled === 1 ? 1 : 0))
      .catch((error) => Toast.error({ content: error instanceof Error ? error.message : t('请求失败') }));
  }, []);

  useEffect(() => {
    if (isDemo()) return;
    let alive = true;
    setLoading(true);
    apiGet<{ records: StockWarningRow[]; total: number }>('/product/stockWarning/list', {
      page,
      size: PAGE_SIZE,
      keyword: query.keyword || undefined,
      warnEnabled: query.warnEnabled === FILTER_ALL ? undefined : query.warnEnabled,
      stockStatus: stockStatus === FILTER_ALL ? undefined : stockStatus,
      sortField: sort.field || undefined,
      sortOrder: sort.order || undefined,
    })
      .then((result) => {
        if (!alive) return;
        setRows(result.records || []);
        setTotal(result.total || 0);
      })
      .catch((error) => {
        if (alive) Toast.error({ content: error instanceof Error ? error.message : t('请求失败') });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [page, query, stockStatus, sort, reloadKey]);

  const onSelectionChange = (keys: Array<string | number> | undefined, currentRows?: StockWarningRow[]) => {
    const keyList = keys || [];
    const keySet = new Set(keyList.map(String));
    const map = new Map(selectedMapRef.current);
    Array.from(map.keys()).forEach((key) => {
      if (!keySet.has(key)) map.delete(key);
    });
    (currentRows || []).forEach((row) => {
      const key = stockRowKey(row);
      if (keySet.has(key)) map.set(key, row);
    });
    selectedMapRef.current = map;
    setSelectedKeys(keyList);
    setSelectedRows(
      keyList
        .map((key) => map.get(String(key)))
        .filter((row): row is StockWarningRow => Boolean(row)),
    );
  };

  const clearSelection = () => {
    selectedMapRef.current = new Map();
    setSelectedKeys([]);
    setSelectedRows([]);
  };

  // ——— 总开关 ———
  const onNotifyChange = async (next: boolean) => {
    if (!ensureNotDemo(t)) return;
    const value = next ? 1 : 0;
    const previous = notifyEnabled;
    setNotifyEnabled(value);
    setNotifySaving(true);
    try {
      await apiPost('/product/stockWarning/setting', { notifyEnabled: value });
      Toast.success({ content: t('操作成功') });
    } catch (error) {
      setNotifyEnabled(previous);
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    } finally {
      setNotifySaving(false);
    }
  };

  // ——— 筛选 ———
  const search = () => {
    setQuery((current) => ({ ...current, keyword }));
    setPage(1);
  };

  const reset = () => {
    setKeyword('');
    setQuery({ keyword: '', warnEnabled: FILTER_ALL });
    setStockStatus(FILTER_ALL);
    setSort({ field: '', order: '' });
    setPage(1);
  };

  const sortOrderFor = (field: string): 'ascend' | 'descend' | false => {
    if (sort.field !== field || !sort.order) return false;
    return sort.order === 'asc' ? 'ascend' : 'descend';
  };

  const columns = [
    {
      title: t('商品名称'),
      dataIndex: 'productName',
      width: 320,
      render: (_: unknown, row: StockWarningRow) => (
        <div className="sw-product-info">
          {row.productPicThumb ? (
            <Image
              src={row.productPicThumb}
              width={48}
              height={48}
              style={{ objectFit: 'contain', borderRadius: 4 }}
            />
          ) : null}
          <div className="sw-product-text">
            <span className="sw-product-name" title={t('商品名称')}>
              {row.productName || '-'}
            </span>
            <span className="sw-product-sn">{row.productSn || '-'}</span>
          </div>
        </div>
      ),
    },
    {
      title: t('规格'),
      dataIndex: 'productSkuName',
      width: 160,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      title: t('相关商品'),
      dataIndex: 'relatedProductCount',
      width: 90,
      render: (value: number) => (
        <span title={t('相关商品数量')}>{Number(value) > 0 ? value : '-'}</span>
      ),
    },
    {
      title: t('实物库存'),
      dataIndex: 'currentStock',
      width: 110,
      sorter: true,
      sortOrder: sortOrderFor('currentStock'),
    },
    {
      title: (
        <span className="sw-header-tip">
          {t('在途库存')}
          <Tooltip content={t('采购未入库的数量')}>
            <IconHelpCircle size="small" />
          </Tooltip>
        </span>
      ),
      dataIndex: 'transitStock',
      width: 120,
      sorter: true,
      sortOrder: sortOrderFor('transitStock'),
      render: (value: number) => <span>{formatLimit(value)}</span>,
    },
    {
      title: t('库存下限'),
      dataIndex: 'lowerLimit',
      width: 110,
      sorter: true,
      sortOrder: sortOrderFor('lowerLimit'),
      render: (value: number | null) => <span>{formatLimit(value)}</span>,
    },
    {
      title: t('库存上限'),
      dataIndex: 'upperLimit',
      width: 110,
      sorter: true,
      sortOrder: sortOrderFor('upperLimit'),
      render: (value: number | null) => <span>{formatLimit(value)}</span>,
    },
    {
      title: t('库存状态'),
      dataIndex: 'stockStatus',
      width: 100,
      render: (_: unknown, row: StockWarningRow) => {
        const meta = stockStatusMeta(row);
        if (!meta) return <span>-</span>;
        return <Tag color={meta.color as never}>{t(meta.label)}</Tag>;
      },
    },
    {
      title: t('库存预警'),
      dataIndex: 'warnEnabled',
      width: 90,
      render: (value: number | null) => <span>{t(warnEnabledLabel(value))}</span>,
    },
    {
      title: t('操作'),
      dataIndex: 'actions',
      width: 80,
      render: (_: unknown, row: StockWarningRow) => (
        <Button theme="borderless" size="small" onClick={() => openSet(row)}>
          {t('设置')}
        </Button>
      ),
    },
  ] as any;

  // ——— 设置预警（单个/批量） ———
  const isBatch = setTargets.length > 1;

  const setDrawerConfig: FormDrawerConfig = useMemo(
    () => ({
      title: isBatch ? '批量设置库存预警' : '库存预警设置',
      addText: '保存',
      width: 600,
      labelWidth: 100,
      inputWidth: 280,
      createApi: '/product/stockWarning/save',
      sections: [
        {
          key: 'rule',
          title: t('预警规则'),
          description: isBatch
            ? t('将为选中的 {count} 个商品/SKU 统一设置以下预警规则', { count: setTargets.length })
            : undefined,
          fields: [
            {
              field: 'warnEnabled',
              label: t('库存预警'),
              type: 'switch',
              checkedText: t('开启'),
              uncheckedText: t('关闭'),
              extraText: t('开启后，该商品达到库存上/下限的商品将会自动推送消息'),
            },
            {
              field: 'lowerLimit',
              label: t('库存下限'),
              type: 'number',
              required: true,
              placeholder: t('请输入库存下限'),
              extraText: t('当实时库存 < 库存下限，将显示低库存'),
            },
            {
              field: 'upperLimit',
              label: t('库存上限'),
              type: 'number',
              required: true,
              placeholder: t('请输入库存上限'),
              extraText: t('当实时库存 > 库存上限，将显示高库存'),
            },
          ],
        },
      ],
      toPayload: (values) => ({
        warnEnabled: Number(values.warnEnabled ?? 1) === 1 ? 1 : 0,
        lowerLimit: values.lowerLimit === '' || values.lowerLimit === undefined ? null : Number(values.lowerLimit),
        upperLimit: values.upperLimit === '' || values.upperLimit === undefined ? null : Number(values.upperLimit),
      }),
    }),
    [isBatch, setTargets.length, t],
  );

  const openSet = (row: StockWarningRow) => {
    // 未配置的商品 warnEnabled 为空，按开启预置
    setSetTargets([{ productId: row.productId, skuId: row.skuId }]);
    setSetInitial({
      warnEnabled: Number(row.warnEnabled) === 0 ? 0 : 1,
      lowerLimit: row.lowerLimit === 0 || row.lowerLimit ? row.lowerLimit : undefined,
      upperLimit: row.upperLimit === 0 || row.upperLimit ? row.upperLimit : undefined,
    });
    setSetOpen(true);
  };

  const openBatchSet = () => {
    if (!selectedRows.length) return;
    setSetTargets(selectedRows.map((row) => ({ productId: row.productId, skuId: row.skuId })));
    setSetInitial({ warnEnabled: 1, lowerLimit: undefined, upperLimit: undefined });
    setSetOpen(true);
  };

  const notifyBatchResult = (result: StockWarningBatchResult | undefined) => {
    const successCount = Number(result?.successCount || 0);
    const failItems = result?.failItems || [];
    if (successCount > 0) {
      Toast.success({ content: t('成功设置{count}条', { count: successCount }) });
    }
    // 后端失败项只回传定位信息，没有商品名
    failItems.forEach((item) => {
      Toast.error({ content: t('{id}：{reason}', { id: String(item.productId ?? ''), reason: item.reason || t('设置失败') }) });
    });
    if (successCount === 0 && failItems.length === 0) {
      Toast.success({ content: t('操作成功') });
    }
  };

  const submitSet = async (payload: Record<string, any>) => {
    const warnEnabled = Number(payload.warnEnabled ?? 1) === 1 ? 1 : 0;
    const lowerLimit = Number(payload.lowerLimit);
    const upperLimit = Number(payload.upperLimit);
    // 后端要求上下限始终必填，关闭开关时也照样保存，重新打开即恢复
    if (!Number.isInteger(lowerLimit) || lowerLimit < 0) {
      Toast.error({ content: t('库存下限须为非负整数') });
      return;
    }
    if (!Number.isInteger(upperLimit) || upperLimit < 0) {
      Toast.error({ content: t('库存上限须为非负整数') });
      return;
    }
    if (upperLimit <= lowerLimit) {
      Toast.error({ content: t('库存上限必须大于库存下限') });
      return;
    }
    setSetSaving(true);
    try {
      if (isBatch) {
        const result = await apiPost<StockWarningBatchResult>('/product/stockWarning/batchSave', {
          targets: setTargets,
          warnEnabled,
          lowerLimit,
          upperLimit,
        });
        notifyBatchResult(result);
      } else {
        await apiPost('/product/stockWarning/save', {
          ...setTargets[0],
          warnEnabled,
          lowerLimit,
          upperLimit,
        });
        Toast.success({ content: t('操作成功') });
      }
      setSetOpen(false);
      clearSelection();
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    } finally {
      setSetSaving(false);
    }
  };

  // ——— 批量导出（只导勾选行：后端按 productId_skuId 定位，筛选条件不参与） ———
  const handleExport = async () => {
    if (!selectedRows.length) {
      Toast.error({ content: t('请先选择要导出的数据') });
      return;
    }
    if (!ensureNotDemo(t)) return;
    setExporting(true);
    try {
      const ids = selectedRows.map((row) => `${row.productId}_${row.skuId}`).join(',');
      await requestDownload('/product/stockWarning/export', '库存预警导出.xlsx', { params: { ids } });
      Toast.success({ content: t('导出成功') });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    } finally {
      setExporting(false);
    }
  };

  // ——— 导入库存预警 ———
  const openImport = () => {
    setImportFile(null);
    setImportState('idle');
    setImportMessage('');
    setImportSuccessCount(0);
    importedRef.current = false;
    setImportOpen(true);
  };

  const closeImport = () => {
    // 导入弹窗调用过导入接口才刷新，点「完成」和点关闭都收敛到关闭时刷新一次
    if (importedRef.current) {
      importedRef.current = false;
      clearSelection();
      reload();
    }
    setImportOpen(false);
  };

  const downloadTemplate = async () => {
    if (!ensureNotDemo(t)) return;
    try {
      await requestDownload('/product/stockWarning/downloadTemplate', '库存预警导入模板.xlsx');
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    }
  };

  const pickImportFile = (file: File | null | undefined) => {
    if (!file) return;
    if (file.size / 1024 / 1024 >= 10) {
      Toast.error({ content: t('只能上传10M以内的文件') });
      return;
    }
    setImportFile(file);
    setImportState('idle');
    setImportMessage('');
    setImportSuccessCount(0);
  };

  const importNow = async () => {
    if (!importFile) return;
    if (!ensureNotDemo(t)) return;
    setImporting(true);
    setImportMessage('');
    // 接口一旦发出数据就可能已变化，关闭时刷新，不等结果
    importedRef.current = true;
    try {
      const result = await apiUpload<StockWarningImportResult>('/product/stockWarning/import', importFile);
      const failCount = Number(result?.failCount || 0);
      // 部分失败时后端 code 仍是 0，合法行已入库，用失败态承载提示与失败数据下载
      if (failCount > 0) {
        setImportState('partial');
        setImportSuccessCount(Number(result?.successCount || 0));
        setImportMessage(t('导入完成，成功{success}条，失败{fail}条', { success: Number(result?.successCount || 0), fail: failCount }));
        return;
      }
      setImportState('success');
      setImportSuccessCount(Number(result?.successCount || 0));
      Toast.success({ content: t('导入成功') });
    } catch (error) {
      setImportState('error');
      setImportMessage(error instanceof Error ? error.message : t('导入失败'));
    } finally {
      setImporting(false);
    }
  };

  // 回传原文件换取带失败原因的 Excel，与导入用同一个文件
  const downloadErrorData = async () => {
    if (!importFile) return;
    try {
      await requestDownload('/product/stockWarning/getBatchImportErrorData', '失败数据.xlsx', {
        file: importFile,
      });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    }
  };

  const clearImportFile = () => {
    setImportFile(null);
    setImportState('idle');
    setImportMessage('');
    setImportSuccessCount(0);
  };

  const renderFilter = (filter: (typeof FILTERS)[number]) => {
    if (filter.type === 'select') {
      return (
        <Select
          key={filter.field}
          placeholder={t(filter.label)}
          value={query.warnEnabled}
          optionList={(filter.options || []).map((option) => ({ ...option, label: t(String(option.label)) }))}
          onChange={(next) => {
            setQuery((current) => ({ ...current, warnEnabled: Number(next) }));
            setPage(1);
          }}
          style={{ width: filter.width }}
        />
      );
    }
    return (
      <Input
        key={filter.field}
        prefix={<IconSearch />}
        placeholder={t(filter.placeholder)}
        value={keyword}
        onChange={(next) => setKeyword(next)}
        onEnterPress={search}
        style={{ width: filter.width }}
      />
    );
  };

  return (
    <div className="sw-page">
      <Card shadows="hover" className="sw-switch-block">
        <div className="sw-switch-line">
          <span className="sw-switch-label">{t('库存预警通知')}</span>
          <Switch
            checked={notifyEnabled === 1}
            loading={notifySaving}
            onChange={(next) => onNotifyChange(next)}
          />
          <span className="sw-switch-desc">{t('开启后，达到库存上/下限的商品将会自动推送消息预警')}</span>
        </div>
      </Card>

      <Card shadows="hover" className="table-card">
        <div className="sw-section-header">
          <div className="sw-section-title">{t('商品预警设置')}</div>
          <Tabs
            type="button"
            size="small"
            activeKey={String(stockStatus)}
            onChange={(key: string) => {
              setStockStatus(Number(key));
              setPage(1);
            }}
            tabList={STOCK_STATUS_TABS.map((tab) => ({ tab: t(tab.label), itemKey: String(tab.value) }))}
          />
        </div>

        <div className="sw-toolbar">
          <Space wrap>
            {FILTERS.map((filter) => renderFilter(filter))}
            <Button theme="solid" type="primary" icon={<IconSearch />} onClick={search}>
              {t('搜索')}
            </Button>
            <Button onClick={reset}>{t('重置')}</Button>
            <Button icon={<IconRefresh />} onClick={reload}>
              {t('刷新')}
            </Button>
          </Space>
          <Space wrap>
            <Button disabled={!selectedRows.length} onClick={openBatchSet}>
              {t('设置库存预警')}
            </Button>
            <Button onClick={openImport}>{t('导入库存预警')}</Button>
            <Button loading={exporting} disabled={!selectedRows.length} onClick={handleExport}>
              {t('批量导出')}
            </Button>
            <span className="sw-selected-total">
              {t('共{count}条', { count: total })}
              {selectedRows.length ? t('，已选择{count}条', { count: selectedRows.length }) : ''}
            </span>
          </Space>
        </div>

        <Table
          loading={loading}
          dataSource={rows}
          rowKey={stockRowKey}
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: (keys, currentRows) => onSelectionChange(keys, currentRows),
          }}
          onChange={({ sorter, extra }: any) => {
            if (extra?.changeType !== 'sorter') return;
            const field = String(sorter?.dataIndex || '');
            const order = sorter?.order === 'ascend' ? 'asc' : sorter?.order === 'descend' ? 'desc' : '';
            setSort({ field: order ? field : '', order });
            setPage(1);
          }}
          scroll={{ x: 1200 }}
          pagination={{
            currentPage: page,
            pageSize: PAGE_SIZE,
            total,
            formatPageText: false,
            onChange: (next: number) => setPage(next),
          }}
          columns={columns}
        />
      </Card>

      <FormDrawer
        visible={setOpen}
        mode="create"
        initialValues={setInitial}
        config={setDrawerConfig}
        saving={setSaving}
        onCancel={() => setSetOpen(false)}
        onSubmit={submitSet}
      />

      <Modal title={t('导入库存预警')} visible={importOpen} footer={null} width={620} onCancel={closeImport}>
        <div className="sw-import">
          <div className="sw-import-tip">
            {t('上传前请先按Excel模板中的格式编辑内容')}{' '}
            <a className="sw-import-link" onClick={downloadTemplate}>
              {t('下载Excel模版')}
            </a>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            hidden
            onChange={(event) => {
              pickImportFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <div
            className="sw-import-dropzone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              pickImportFile(event.dataTransfer.files?.[0]);
            }}
          >
            {!importFile ? (
              <div className="sw-import-hint">
                <div>{t('将文件拖拽至此区域，或点击添加')}</div>
                <div className="sw-import-sub">{t('支持 .xls, .xlsx 格式，限10M以内')}</div>
              </div>
            ) : importState === 'success' ? (
              <div className="sw-import-hint">
                <div className="sw-import-file">{importFile.name}</div>
                <div>{t('全部导入成功，共{count}条', { count: importSuccessCount })}</div>
                <Space>
                  <Button onClick={clearImportFile}>{t('继续导入')}</Button>
                  <Button theme="solid" type="primary" onClick={closeImport}>
                    {t('完成')}
                  </Button>
                </Space>
              </div>
            ) : importState === 'idle' ? (
              <div className="sw-import-hint">
                <div className="sw-import-file">{importFile.name}</div>
                <Space>
                  <a className="sw-import-link" onClick={(event) => { event.stopPropagation(); fileInputRef.current?.click(); }}>
                    {t('重新上传')}
                  </a>
                  <a className="sw-import-link" onClick={(event) => { event.stopPropagation(); clearImportFile(); }}>
                    {t('删除')}
                  </a>
                </Space>
                <Button theme="solid" type="primary" loading={importing} onClick={(event) => { event.stopPropagation(); importNow(); }}>
                  {t('立即导入')}
                </Button>
              </div>
            ) : (
              <div className="sw-import-hint">
                <div className="sw-import-file sw-import-error-text">{importMessage}</div>
                {importState === 'partial' ? (
                  <div className="sw-import-sub">
                    {t('您可以下载失败数据，修改后再重新导入')}{' '}
                    <a className="sw-import-link" onClick={(event) => { event.stopPropagation(); downloadErrorData(); }}>
                      {t('下载失败数据')}
                    </a>
                  </div>
                ) : null}
                <Space>
                  <Button onClick={clearImportFile}>{t('继续导入')}</Button>
                  <Button theme="solid" type="primary" onClick={(event) => { event.stopPropagation(); closeImport(); }}>
                    {t('完成')}
                  </Button>
                </Space>
              </div>
            )}
          </div>
          <div className="sw-import-footer">
            <div className="sw-import-footer-title">{t('导入规则')}</div>
            <div>{t('1. 请先下载模板，在模板中按字段填写信息，然后上传该文件。')}</div>
            <div>{t('2. 导入未完成之前，请勿关闭页面，否则可能数据错误。')}</div>
            <div>{t('3. 文件大小不超过10MB。')}</div>
            <div>{t('4. 限制导入10000行记录，超出部分请分多次导入。')}</div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
