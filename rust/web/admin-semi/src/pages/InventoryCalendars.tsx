import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  DatePicker,
  Image,
  Input,
  InputNumber,
  Modal,
  Radio,
  RadioGroup,
  Select,
  Space,
  Table,
  Toast,
  Tooltip,
  Typography,
} from '@douyinfe/semi-ui';
import { IconRefresh, IconSearch } from '@douyinfe/semi-icons';
import { apiGet, apiPost, isDemo } from '../api';
import { useI18n } from '../i18n';
import ProductPicker from '../components/ProductPicker';
import './inventory-calendars.css';

const { Text } = Typography;

/**
 * 库存日历（旧页：java/view/admin/src/views/product/inventoryCalendar/List.vue
 *   + SetInventory.vue + ModifyInventory.vue + BatchSetInventory.vue）。
 *
 * 端点（Rust 后端已全部实现：crates/api/admin/src/routes/o2o/stock_calendar.rs）：
 * - GET  /o2o/stockCalendar/pageList       列表（按 门店×商品×SKU 分组 + 每日汇总）
 * - GET  /o2o/stockCalendar/getDailyStock  某日时间段库存
 * - POST /o2o/stockCalendar/updateDailyStock   按增量修改某日库存（timeSlotStockChanges）
 * - POST /o2o/stockCalendar/setUnifiedStock    统一设置库存（区间 + 门店选择 + 排除日）
 * - POST /o2o/stockCalendar/setTimeSlotStock   按时段设置库存（timeSlotStockItems）
 * - GET  /o2o/stockCalendar/getProductTimeList 商品时间段配置
 */

interface DateStockSummary {
  stockDate: string;
  totalStock: number;
  usedStock: number;
  availableStock: number;
}

interface CalendarRow {
  rowKey?: string;
  productInfo: {
    productId: number;
    productName?: string;
    productImage?: string;
    skuId?: number;
    specValue?: string;
  };
  shopInfo: { shopId: number; shopName?: string };
  dateStockList?: DateStockSummary[];
  dayMap?: Record<string, DateStockSummary>;
}

interface TimeSlotRow {
  productReservationTimeId: number;
  startTime?: string;
  endTime?: string;
  totalStock?: number;
  usedStock?: number;
  availableStock?: number;
  /** edit 模式：增量；set 模式：目标可预约数（未设置日 available=0，等价） */
  stockChange?: number;
  /** 按时段设置库存（ModifyInventory）的每时段变更量 */
  quantity?: number;
}

interface ShopOptionItem {
  shopId: number;
  shopTitle?: string;
  shopName?: string;
}

const pad = (num: number) => String(num).padStart(2, '0');

const fmtDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const monthStart = (month: string) => `${month}-01`;

const monthEnd = (month: string) => {
  const [year, mon] = month.split('-').map(Number);
  return fmtDate(new Date(year, mon, 0));
};

const shiftMonth = (month: string, delta: number) => {
  const [year, mon] = month.split('-').map(Number);
  const next = new Date(year, mon - 1 + delta, 1);
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}`;
};

const toDateText = (value: unknown): string => {
  if (value instanceof Date) return fmtDate(value);
  if (typeof value === 'string') return value.slice(0, 10);
  return '';
};

/** DatePicker(type=dateRange) onChange 两参兼容：取可用的一组日期串 */
const pickRangeTexts = (first: unknown, second: unknown): string[] => {
  if (Array.isArray(first) && first.length) return first.map((item) => toDateText(item));
  if (Array.isArray(second) && second.length) return second.map((item) => toDateText(item));
  return [toDateText(first), toDateText(second)];
};

/** DatePicker(type=month) onChange 兼容：取 yyyy-MM */
const pickMonthText = (first: unknown, second: unknown): string => {
  if (typeof second === 'string' && second) return second.slice(0, 7);
  if (first instanceof Date) return `${first.getFullYear()}-${pad(first.getMonth() + 1)}`;
  if (typeof first === 'string' && first) return first.slice(0, 7);
  return '';
};

const WEEK_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const weekLabel = (day: string) => {
  const date = new Date(`${day}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '' : WEEK_LABELS[date.getDay()];
};

const shortDay = (day: string) => (day || '').slice(5);

/** 规格值展示：a|b|c → a;b;c（对齐旧 formatSpecValue） */
const formatSpecValue = (specValue?: string) => {
  if (!specValue) return '-';
  return specValue
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)
    .join(';');
};

/** 时间段输入是否禁用：当天且已过该时段结束时间（对齐旧 isTimeSlotDisabled） */
const isTimeSlotDisabled = (slot: TimeSlotRow, stockDate: string) => {
  const now = new Date();
  const today = fmtDate(now);
  if (today !== stockDate) return false;
  const minutes = (text?: string) => {
    const parts = String(text || '00:00').split(':');
    return Number(parts[0] || 0) * 60 + Number(parts[1] || 0);
  };
  return now.getHours() * 60 + now.getMinutes() >= minutes(slot.endTime);
};

const WEEKDAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7].map((key) => ({
  value: key,
  label: WEEK_LABELS[key % 7],
}));

const MONTH_DAY_OPTIONS = Array.from({ length: 31 }, (_, index) => ({
  value: index + 1,
  label: `${index + 1}号`,
}));

interface CalendarQuery {
  productName: string;
  shopScopeType: number;
  shopIds: string;
  timeType: 'week' | 'month';
  startDate: string;
  endDate: string;
}

const initialQuery = (): CalendarQuery => ({
  productName: '',
  shopScopeType: 0,
  shopIds: '',
  timeType: 'week',
  startDate: fmtDate(new Date()),
  endDate: fmtDate(addDays(new Date(), 6)),
});

interface DayModalState {
  visible: boolean;
  mode: 'set' | 'edit';
  day: string;
  productId: number;
  skuId: number;
  shopId: number;
  shopName?: string;
  productName?: string;
  slots: TimeSlotRow[];
  loading: boolean;
  saving: boolean;
}

const closedDayModal = (): DayModalState => ({
  visible: false,
  mode: 'set',
  day: '',
  productId: 0,
  skuId: 0,
  shopId: 0,
  slots: [],
  loading: false,
  saving: false,
});

interface UnifiedModalState {
  visible: boolean;
  loading: boolean;
  saving: boolean;
  productId: number;
  productName?: string;
  picThumb?: string;
  skuCount: number;
  /** 规格选项（v5.8.61：用 GET /product/product/skuList 拉取，对齐原版 BatchSetInventory 的规格选择） */
  skuOptions: Array<{ skuId: number; skuValue?: string }>;
  /** 已选规格：多规格商品必选（原版"请选择规格"校验） */
  skuId: number;
  /** 1 全部门店（配合排除） 3 指定门店；提交时若有排除门店自动转为 2 */
  selectionType: number;
  storeIds: number[];
  dateRange: string[];
  isExcluded: 0 | 1;
  excludeType: 1 | 2;
  excludeDay: number[];
  quantity: number;
}

const closedUnifiedModal = (): UnifiedModalState => ({
  visible: false,
  loading: false,
  saving: false,
  productId: 0,
  productName: '',
  picThumb: '',
  skuCount: 0,
  skuOptions: [],
  skuId: 0,
  selectionType: 1,
  storeIds: [],
  dateRange: [],
  isExcluded: 0,
  excludeType: 1,
  excludeDay: [],
  quantity: 0,
});

interface SlotModalState {
  visible: boolean;
  loading: boolean;
  saving: boolean;
  row: CalendarRow | null;
  productName?: string;
  picUrl?: string;
  slots: TimeSlotRow[];
  dateRange: string[];
  isExcluded: 0 | 1;
  excludeType: 1 | 2;
  excludeDay: number[];
}

const closedSlotModal = (): SlotModalState => ({
  visible: false,
  loading: false,
  saving: false,
  row: null,
  productName: '',
  picUrl: '',
  slots: [],
  dateRange: [],
  isExcluded: 0,
  excludeType: 1,
  excludeDay: [],
});

interface ExcludePatch {
  isExcluded?: 0 | 1;
  excludeType?: 1 | 2;
  excludeDay?: number[];
}

export default function InventoryCalendars() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(!isDemo());
  const [rows, setRows] = useState<CalendarRow[]>([]);
  const [dayList, setDayList] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [reloadKey, setReloadKey] = useState(0);

  // 筛选输入态（未提交）与已提交查询态
  const [productName, setProductName] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<number>(0);
  const [timeType, setTimeType] = useState<'week' | 'month'>('week');
  const [monthValue, setMonthValue] = useState(fmtDate(new Date()).slice(0, 7));
  const [query, setQuery] = useState<CalendarQuery>(initialQuery);
  const [storeOptions, setStoreOptions] = useState<ShopOptionItem[]>([]);

  // 单选行（旧页为单选复选框，隐藏表头全选）
  const [selectedKeys, setSelectedKeys] = useState<Array<string | number>>([]);
  const [selectedRow, setSelectedRow] = useState<CalendarRow | null>(null);

  const [dayModal, setDayModal] = useState<DayModalState>(closedDayModal);
  const [unified, setUnified] = useState<UnifiedModalState>(closedUnifiedModal);
  const [slotModal, setSlotModal] = useState<SlotModalState>(closedSlotModal);

  const isAdmin = (localStorage.getItem('adminType') || 'admin') === 'admin';

  const search = (patch?: Partial<CalendarQuery>) => {
    setPage(1);
    setQuery((current) => ({ ...current, ...(patch || {}) }));
    setReloadKey((key) => key + 1);
  };

  useEffect(() => {
    if (isDemo()) return;
    let alive = true;
    setLoading(true);
    apiGet<{ records: CalendarRow[]; total: number }>('/o2o/stockCalendar/pageList', {
      page,
      size,
      timeType: query.timeType,
      startDate: query.startDate,
      endDate: query.endDate,
      productName: query.productName,
      shopScopeType: query.shopScopeType,
      shopIds: query.shopIds,
    })
      .then((result) => {
        if (!alive) return;
        const records = (result.records || []).map((row) => ({
          ...row,
          rowKey: `${row.shopInfo?.shopId || 0}-${row.productInfo?.productId || 0}-${
            row.productInfo?.skuId || 0
          }`,
          dayMap: Object.fromEntries(
            (row.dateStockList || []).map((item) => [item.stockDate, item] as const),
          ),
        }));
        setRows(records);
        setDayList((records[0]?.dateStockList || []).map((item) => item.stockDate));
        setTotal(result.total || 0);
        setSelectedKeys([]);
        setSelectedRow(null);
      })
      .catch((error) => alive && Toast.error({ content: error.message }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [page, size, reloadKey, query]);

  // 门店选项（旧 SelectStore：shopType=2 的 O2O 门店）
  useEffect(() => {
    if (isDemo()) return;
    apiGet<{ records?: ShopOptionItem[] }>('/merchant/shop/list', { shopType: 2, page: 1, size: 99 })
      .then((result) => setStoreOptions(result.records || []))
      .catch(() => undefined);
  }, []);

  const storeSelectOptions = useMemo(
    () => [
      { label: t('全部门店'), value: 0 },
      ...storeOptions.map((shop) => ({
        label: shop.shopTitle || shop.shopName || `门店${shop.shopId}`,
        value: shop.shopId,
      })),
    ],
    [storeOptions, t],
  );

  const handleStoreChange = (value: unknown) => {
    const storeId = Number(value || 0);
    setSelectedStoreId(storeId);
    search({
      shopScopeType: storeId > 0 ? 1 : 0,
      shopIds: storeId > 0 ? String(storeId) : '',
    });
  };

  const changeTimeType = (next: 'week' | 'month') => {
    setTimeType(next);
    if (next === 'week') {
      search({
        timeType: 'week',
        startDate: fmtDate(new Date()),
        endDate: fmtDate(addDays(new Date(), 6)),
      });
    } else {
      const month = fmtDate(new Date()).slice(0, 7);
      setMonthValue(month);
      search({ timeType: 'month', startDate: monthStart(month), endDate: monthEnd(month) });
    }
  };

  const changePeriod = (direction: 'prev' | 'next') => {
    if (timeType === 'week') {
      const next = addDays(new Date(`${query.startDate}T00:00:00`), direction === 'prev' ? -7 : 7);
      const startDate = fmtDate(next);
      search({ startDate, endDate: fmtDate(addDays(next, 6)) });
    } else {
      const month = shiftMonth(monthValue, direction === 'prev' ? -1 : 1);
      setMonthValue(month);
      search({ startDate: monthStart(month), endDate: monthEnd(month) });
    }
  };

  const isPrevDisabled = useMemo(() => {
    if (timeType === 'week') return query.startDate === fmtDate(startOfToday());
    return monthValue === fmtDate(new Date()).slice(0, 7);
  }, [timeType, query.startDate, monthValue]);

  // ————————————————————— 某日库存弹窗（SetInventory.vue） —————————————————————

  const openDayModal = (row: CalendarRow, day: string, mode: 'set' | 'edit') => {
    const productId = Number(row.productInfo?.productId || 0);
    const skuId = Number(row.productInfo?.skuId || 0);
    const shopId = Number(row.shopInfo?.shopId || 0);
    setDayModal({
      ...closedDayModal(),
      visible: true,
      mode,
      day,
      productId,
      skuId,
      shopId,
      shopName: row.shopInfo?.shopName,
      productName: row.productInfo?.productName,
      loading: true,
    });
    apiGet<{ timeSlotStockList?: TimeSlotRow[] }>('/o2o/stockCalendar/getDailyStock', {
      productId,
      skuId,
      shopId,
      stockDate: day,
    })
      .then((detail) =>
        setDayModal((current) => ({
          ...current,
          loading: false,
          slots: (detail.timeSlotStockList || []).map((slot) => ({ ...slot, stockChange: 0 })),
        })),
      )
      .catch((error) => {
        Toast.error({ content: error instanceof Error ? error.message : t('加载失败') });
        setDayModal((current) => ({ ...current, loading: false }));
      });
  };

  const updateDaySlotChange = (timeId: number, stockChange: number) =>
    setDayModal((current) => ({
      ...current,
      slots: current.slots.map((slot) =>
        slot.productReservationTimeId === timeId ? { ...slot, stockChange } : slot,
      ),
    }));

  const saveDayModal = async () => {
    if (!dayModal.slots.length) {
      Toast.warning({ content: t('该商品未配置可预约时间段') });
      return;
    }
    setDayModal((current) => ({ ...current, saving: true }));
    try {
      await apiPost('/o2o/stockCalendar/updateDailyStock', {
        productId: dayModal.productId,
        skuId: dayModal.skuId,
        shopId: dayModal.shopId,
        stockDate: dayModal.day,
        timeSlotStockChanges: dayModal.slots.map((slot) => ({
          productReservationTimeId: slot.productReservationTimeId,
          stockChange: Number(slot.stockChange || 0),
        })),
      });
      Toast.success({ content: t('操作成功') });
      setDayModal(closedDayModal());
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setDayModal((current) => ({ ...current, saving: false }));
    }
  };

  // ————————————————————— 统一设置库存弹窗（BatchSetInventory.vue） —————————————————————

  const loadUnifiedProduct = (productId: number) => {
    if (!productId) {
      setUnified((current) => ({ ...current, productName: '', picThumb: '', skuCount: 0, skuOptions: [], skuId: 0 }));
      return;
    }
    setUnified((current) => ({ ...current, loading: true, skuOptions: [], skuId: 0 }));
    apiGet<{
      records?: Array<{ productName?: string; picThumb?: string; picUrl?: string; productSku?: unknown[] }>;
    }>('/product/product/list', { ids: productId, page: 1, pageSize: 1 })
      .then((result) => {
        const product = result.records?.[0];
        setUnified((current) => ({
          ...current,
          loading: false,
          productName: product?.productName,
          picThumb: product?.picThumb || product?.picUrl || '',
          skuCount: Array.isArray(product?.productSku) ? product.productSku.length : 0,
        }));
      })
      .catch(() => setUnified((current) => ({ ...current, loading: false })));
    // 规格列表：GET /product/product/skuList（原版从商品详情 productSku 取，这里按接口化契约拉取）
    apiGet<{ records?: Array<{ skuId: number; skuValue?: string; isEnabled?: number }> }>(
      '/product/product/skuList',
      { id: productId, page: 1, size: 100 },
    )
      .then((result) => {
        const options = (result?.records || [])
          .filter((item) => Number(item.skuId || 0) > 0 && Number(item.isEnabled ?? 1) !== 0)
          .map((item) => ({ skuId: Number(item.skuId), skuValue: item.skuValue }));
        setUnified((current) => ({
          ...current,
          skuOptions: options,
          // 单规格自动选中（原版 syncSelectedSkuIds：单规格默认选唯一规格）
          skuId: options.length === 1 ? options[0].skuId : current.skuId && options.some((o) => o.skuId === current.skuId) ? current.skuId : 0,
          skuCount: options.length || current.skuCount,
        }));
      })
      .catch(() => undefined);
  };

  const openUnifiedModal = () => {
    const presetProductId = Number(selectedRow?.productInfo?.productId || 0);
    setUnified({ ...closedUnifiedModal(), visible: true, productId: presetProductId });
    if (presetProductId > 0) loadUnifiedProduct(presetProductId);
  };

  const saveUnified = async () => {
    if (Number(unified.productId) <= 0) {
      Toast.warning({ content: t('请选择商品') });
      return;
    }
    // 原版 BatchSetInventory：多规格商品必须选择规格
    if (unified.skuOptions.length > 1 && !unified.skuId) {
      Toast.warning({ content: t('请选择规格') });
      return;
    }
    if (!unified.dateRange[0] || !unified.dateRange[1]) {
      Toast.warning({ content: t('请选择时间范围') });
      return;
    }
    // 全部门店 + 排除门店 → selectionType 2（排除模式），对齐旧 BatchSetInventory
    const selectionType =
      unified.selectionType === 1 && unified.storeIds.length ? 2 : unified.selectionType;
    setUnified((current) => ({ ...current, saving: true }));
    try {
      await apiPost('/o2o/stockCalendar/setUnifiedStock', {
        productId: unified.productId,
        // 原版提交 skuId（首个已选规格），单规格/未选时缺省作用于全部规格
        skuId: Number(unified.skuId || 0) || undefined,
        shopSelection: { selectionType, shopIds: unified.storeIds },
        startDate: unified.dateRange[0],
        endDate: unified.dateRange[1],
        dateExclusion: {
          excludeWeekdays:
            unified.isExcluded === 1 && unified.excludeType === 1 ? unified.excludeDay : [],
          excludeMonthDays:
            unified.isExcluded === 1 && unified.excludeType === 2 ? unified.excludeDay : [],
          excludeSpecificDates: [],
        },
        quantity: Number(unified.quantity || 0),
      });
      Toast.success({ content: t('操作成功') });
      setUnified(closedUnifiedModal());
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setUnified((current) => ({ ...current, saving: false }));
    }
  };

  // ————————————————————— 按时段设置库存弹窗（ModifyInventory.vue） —————————————————————

  const openSlotModal = (row: CalendarRow | null) => {
    if (!row) {
      Toast.warning({ content: t('请至少选择一项商品') });
      return;
    }
    const productId = Number(row.productInfo?.productId || 0);
    setSlotModal({ ...closedSlotModal(), visible: true, loading: true, row });
    apiGet<{ productName?: string; picUrl?: string; timeSlotStockList?: TimeSlotRow[] }>(
      '/o2o/stockCalendar/getProductTimeList',
      { productId },
    )
      .then((detail) =>
        setSlotModal((current) => ({
          ...current,
          loading: false,
          productName: detail.productName || row.productInfo?.productName,
          picUrl: detail.picUrl || row.productInfo?.productImage,
          slots: (detail.timeSlotStockList || []).map((slot) => ({ ...slot, quantity: 0 })),
        })),
      )
      .catch((error) => {
        Toast.error({ content: error instanceof Error ? error.message : t('加载失败') });
        setSlotModal((current) => ({ ...current, loading: false }));
      });
  };

  const updateSlotQuantity = (timeId: number, quantity: number) =>
    setSlotModal((current) => ({
      ...current,
      slots: current.slots.map((slot) =>
        slot.productReservationTimeId === timeId ? { ...slot, quantity } : slot,
      ),
    }));

  const saveSlotModal = async () => {
    const row = slotModal.row;
    if (!row) return;
    if (!slotModal.dateRange[0] || !slotModal.dateRange[1]) {
      Toast.warning({ content: t('请选择时间范围') });
      return;
    }
    setSlotModal((current) => ({ ...current, saving: true }));
    try {
      await apiPost('/o2o/stockCalendar/setTimeSlotStock', {
        productId: Number(row.productInfo?.productId || 0),
        skuId: Number(row.productInfo?.skuId || 0),
        shopSelection: {
          selectionType: 3,
          shopIds: [Number(row.shopInfo?.shopId || 0)],
        },
        startDate: slotModal.dateRange[0],
        endDate: slotModal.dateRange[1],
        dateExclusion:
          slotModal.isExcluded === 1
            ? {
                excludeWeekdays: slotModal.excludeType === 1 ? slotModal.excludeDay : undefined,
                excludeMonthDays: slotModal.excludeType === 2 ? slotModal.excludeDay : undefined,
              }
            : undefined,
        timeSlotStockItems: slotModal.slots.map((slot) => ({
          productReservationTimeId: slot.productReservationTimeId,
          quantity: Number(slot.quantity || 0),
        })),
      });
      Toast.success({ content: t('操作成功') });
      setSlotModal(closedSlotModal());
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSlotModal((current) => ({ ...current, saving: false }));
    }
  };

  // ————————————————————— 渲染 —————————————————————

  const renderDayCell = (row: CalendarRow, day: string) => {
    const data = row.dayMap?.[day];
    if (!Number(row.productInfo?.productId) || !Number(row.shopInfo?.shopId)) {
      return <span className="cal-cell-empty">-</span>;
    }
    if (!data || Number(data.totalStock) === 0) {
      return (
        <div className="cal-cell">
          <Button size="small" theme="borderless" onClick={() => openDayModal(row, day, 'set')}>
            {t('设置库存')}
          </Button>
        </div>
      );
    }
    return (
      <div className="cal-cell">
        <span className="cal-cell-stock" title={t('可预约数')}>
          {t('可预约数：')}{data.availableStock}
        </span>
        <span className="cal-cell-used" title={t('已预约数')}>
          {t('已预约数：')}{Number(data.usedStock) || 0}
        </span>
        <Button size="small" theme="borderless" onClick={() => openDayModal(row, day, 'edit')}>
          {t('修改库存')}
        </Button>
      </div>
    );
  };

  const columns = useMemo(() => {
    const fixedColumns = [
      {
        title: t('商品信息'),
        dataIndex: 'productInfo',
        key: 'productInfo',
        width: 280,
        fixed: 'left' as const,
        render: (_value: unknown, row: CalendarRow) => (
          <div className="cal-product">
            <Image
              src={row.productInfo?.productImage}
              width={40}
              height={40}
              style={{ objectFit: 'contain' }}
            />
            <span className="cal-product-name" title={row.productInfo?.productName}>
              {row.productInfo?.productName || '-'}
            </span>
          </div>
        ),
      },
      {
        title: t('规格'),
        dataIndex: 'specValue',
        key: 'specValue',
        width: 150,
        fixed: 'left' as const,
        render: (_value: unknown, row: CalendarRow) => (
          <span className="cal-ellipsis" title={formatSpecValue(row.productInfo?.specValue)}>
            {formatSpecValue(row.productInfo?.specValue)}
          </span>
        ),
      },
      {
        title: t('门店'),
        dataIndex: 'shopInfo',
        key: 'shopInfo',
        width: 140,
        fixed: 'left' as const,
        render: (_value: unknown, row: CalendarRow) => (
          <span className="cal-ellipsis" title={row.shopInfo?.shopName}>
            {row.shopInfo?.shopName || '-'}
          </span>
        ),
      },
    ];
    const dayColumns = dayList.map((day) => ({
      title: (
        <div className="cal-day-head">
          {timeType === 'week' ? <span className="cal-day-week">{t(weekLabel(day))}</span> : null}
          <span className="cal-day-date">{shortDay(day)}</span>
        </div>
      ),
      dataIndex: day,
      key: day,
      width: dayList.length > 10 ? 150 : 130,
      render: (_value: unknown, row: CalendarRow) => renderDayCell(row, day),
    }));
    return [...fixedColumns, ...dayColumns];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayList, timeType, t]);

  const renderExcludeBlock = (
    isExcluded: 0 | 1,
    excludeType: 1 | 2,
    excludeDay: number[],
    onChange: (patch: ExcludePatch) => void,
  ) => (
    <div className="cal-exclude-block">
      <Checkbox
        checked={isExcluded === 1}
        onChange={(event) => onChange({ isExcluded: event.target.checked ? 1 : 0, excludeDay: [] })}
      >
        {t('排除时间')}
      </Checkbox>
      {isExcluded === 1 ? (
        <>
          <RadioGroup
            value={excludeType}
            onChange={(event) =>
              onChange({ excludeType: Number(event.target.value) as 1 | 2, excludeDay: [] })
            }
          >
            <Radio value={1}>{t('每周排除')}</Radio>
            <Radio value={2}>{t('每月排除')}</Radio>
          </RadioGroup>
          <Select
            multiple
            placeholder={t('请选择排除时间')}
            style={{ width: 260 }}
            optionList={(excludeType === 1 ? WEEKDAY_OPTIONS : MONTH_DAY_OPTIONS).map((option) => ({ ...option, label: t(option.label) }))}
            value={excludeDay}
            onChange={(next) => onChange({ excludeDay: (next as number[]) || [] })}
          />
          <p className="cal-exclude-tip">{t('仅修改商品在改日期范围内的可预约数量')}</p>
        </>
      ) : null}
    </div>
  );

  const scrollX = 570 + dayList.length * (dayList.length > 10 ? 150 : 130);

  return (
    <div className="stock-calendar-page">
      <Table
        className="stock-calendar-table"
        loading={loading}
        dataSource={rows}
        rowKey="rowKey"
        empty={isDemo() ? t('演示模式下不加载库存日历数据') : t('暂无数据')}
        scroll={scrollX > 1000 ? { x: scrollX } : undefined}
        rowSelection={{
          selectedRowKeys: selectedKeys,
          onChange: (keys: Array<string | number> = [], selectedRows: CalendarRow[] = []) => {
            // 旧页为单选：仅保留最后一次勾选的行
            const nextKey = keys.length ? keys[keys.length - 1] : '';
            const nextRow = selectedRows.find((row) => row.rowKey === nextKey) || null;
            setSelectedKeys(nextKey ? [nextKey] : []);
            setSelectedRow(nextRow);
          },
        }}
        pagination={{
          currentPage: page,
          pageSize: size,
          total,
          pageSizeOpts: [10, 20, 50],
          showSizeChanger: true,
          onPageChange: (nextPage: number) => {
            setPage(nextPage);
          },
          onPageSizeChange: (nextSize: number) => {
            setSize(nextSize);
            setPage(1);
          },
        }}
        columns={columns as never}
        title={
          <div className="stock-calendar-toolbar">
            <Space wrap>
              <Input
                prefix={<IconSearch />}
                placeholder={t('输入商品名称')}
                value={productName}
                onChange={setProductName}
                onEnterPress={() => search({ productName })}
                style={{ width: 220 }}
              />
              <Select
                placeholder={t('请选择门店')}
                filter
                value={selectedStoreId}
                optionList={storeSelectOptions}
                onChange={handleStoreChange}
                style={{ width: 180 }}
              />
              <Select
                value={timeType}
                optionList={[
                  { label: t('按周'), value: 'week' },
                  { label: t('按月'), value: 'month' },
                ]}
                onChange={(next) => changeTimeType(next as 'week' | 'month')}
                style={{ width: 90 }}
              />
              <Button disabled={isPrevDisabled} onClick={() => changePeriod('prev')}>
                {timeType === 'week' ? t('上一周') : t('上一月')}
              </Button>
              {timeType === 'week' ? (
                <>
                  <DatePicker
                    type="date"
                    format="yyyy-MM-dd"
                    value={query.startDate}
                    disabledDate={(date) => (date ? date.getTime() < startOfToday().getTime() : false)}
                    onChange={(date, dateStr) => {
                      const startDate = toDateText(dateStr ?? date);
                      if (startDate) {
                        search({
                          startDate,
                          endDate: fmtDate(addDays(new Date(`${startDate}T00:00:00`), 6)),
                        });
                      }
                    }}
                    style={{ width: 140 }}
                  />
                  <DatePicker type="date" format="yyyy-MM-dd" value={query.endDate} disabled style={{ width: 140 }} />
                </>
              ) : (
                <DatePicker
                  type="month"
                  format="yyyy-MM"
                  value={monthValue}
                  disabledDate={(date) => {
                    const first = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
                    return date ? date.getTime() < first.getTime() : false;
                  }}
                  onChange={(date, dateStr) => {
                    const month = pickMonthText(date, dateStr);
                    if (month) {
                      setMonthValue(month);
                      search({ startDate: monthStart(month), endDate: monthEnd(month) });
                    }
                  }}
                  style={{ width: 140 }}
                />
              )}
              <Button onClick={() => changePeriod('next')}>
                {timeType === 'week' ? t('下一周') : t('下一月')}
              </Button>
              <Button icon={<IconRefresh />} onClick={() => setReloadKey((key) => key + 1)}>
                {t('刷新')}
              </Button>
            </Space>
            <Space wrap>
              <span className="cal-total">
                {t('共{count}条', { count: total })}{selectedRow ? t('，已选择1条') : ''}
              </span>
              {isAdmin ? (
                <Button theme="solid" type="primary" onClick={openUnifiedModal}>
                  {t('统一设置库存')}
                </Button>
              ) : null}
              <Button disabled={!selectedRow} onClick={() => openSlotModal(selectedRow)}>
                {t('按时段设置库存')}
              </Button>
            </Space>
          </div>
        }
      />

      {/* 某日库存（旧 SetInventory.vue：按时间段增量修改） */}
      <Modal
        title={`${dayModal.mode === 'edit' ? t('修改库存') : t('设置库存')}${
          dayModal.day ? `（${dayModal.day}）` : ''
        }`}
        visible={dayModal.visible}
        confirmLoading={dayModal.saving}
        onOk={saveDayModal}
        okText={t('保存')}
        onCancel={() => setDayModal(closedDayModal())}
        width={dayModal.mode === 'edit' ? 620 : 480}
      >
        <div className="cal-modal-meta">
          <Text strong>{dayModal.productName || '-'}</Text>
          {dayModal.shopName ? <Text type="tertiary">{t('门店：')}{dayModal.shopName}</Text> : null}
        </div>
        <Table
          size="small"
          loading={dayModal.loading}
          pagination={false}
          rowKey="productReservationTimeId"
          dataSource={dayModal.slots}
          empty={t('该商品未配置可预约时间段')}
          columns={
            [
              {
                title: t('时间段'),
                dataIndex: 'startTime',
                render: (_value: unknown, slot: TimeSlotRow) => (
                  <span>{`${slot.startTime || ''}~${slot.endTime || ''}`}</span>
                ),
              },
              ...(dayModal.mode === 'edit'
                ? [
                    {
                      title: t('当前可预约'),
                      dataIndex: 'availableStock',
                      width: 110,
                      render: (_value: unknown, slot: TimeSlotRow) => (
                        <span title={t('当前可预约')}>{Number(slot.availableStock) || 0}</span>
                      ),
                    },
                  ]
                : []),
              {
                title: (
                  <span className="cal-table-head">
                    {dayModal.mode === 'edit' ? t('增加/减少数量') : t('可预约数量')}
                    <Tooltip content={t('正数为增加数量 负数为减少数量')}>
                      <span className="cal-help-icon">?</span>
                    </Tooltip>
                  </span>
                ),
                dataIndex: 'stockChange',
                width: 150,
                render: (_value: unknown, slot: TimeSlotRow) => (
                  <InputNumber
                    size="small"
                    precision={0}
                    min={dayModal.mode === 'set' ? 0 : undefined}
                    style={{ width: 90 }}
                    value={Number(slot.stockChange || 0)}
                    disabled={isTimeSlotDisabled(slot, dayModal.day)}
                    onChange={(next) =>
                      updateDaySlotChange(slot.productReservationTimeId, Number(next || 0))
                    }
                  />
                ),
              },
              ...(dayModal.mode === 'edit'
                ? [
                    {
                      title: t('实际可预约'),
                      dataIndex: 'usedStock',
                      width: 110,
                      render: (_value: unknown, slot: TimeSlotRow) => (
                        <span title={t('实际可预约')}>
                          {Math.max(
                            0,
                            (Number(slot.availableStock) || 0) + (Number(slot.stockChange) || 0),
                          )}
                        </span>
                      ),
                    },
                  ]
                : []),
            ] as never
          }
        />
      </Modal>

      {/* 统一设置库存（旧 BatchSetInventory.vue） */}
      <Modal
        title={t('统一设置库存')}
        visible={unified.visible}
        confirmLoading={unified.saving}
        onOk={saveUnified}
        okText={t('保存')}
        onCancel={() => setUnified(closedUnifiedModal())}
        width={640}
      >
        <div className="cal-modal-tip">{t('批量设置库存即：同时对商品设置多个门店的库存')}</div>
        <div className="cal-form-field">
          <label className="cal-form-label">{t('商品')}</label>
          <div className="cal-form-control">
            <ProductPicker
              value={unified.productId > 0 ? [unified.productId] : []}
              onChange={(ids) => {
                const productId = Number(ids[0] || 0);
                setUnified((current) => ({
                  ...current,
                  productId,
                  storeIds: [],
                  productName: '',
                  picThumb: '',
                  skuCount: 0,
                  skuOptions: [],
                  skuId: 0,
                }));
                loadUnifiedProduct(productId);
              }}
              max={1}
            />
            {unified.productId > 0 && unified.productName ? (
              <div className="cal-unified-product">
                {unified.picThumb ? (
                  <Image src={unified.picThumb} width={40} height={40} style={{ objectFit: 'contain' }} />
                ) : null}
                <span title={unified.productName}>{unified.productName}</span>
                {unified.skuOptions.length > 1 ? (
                  unified.skuId ? (
                    <Text type="tertiary" size="small">
                      {t('已选规格：')}
                      {(
                        unified.skuOptions.find((option) => option.skuId === unified.skuId)?.skuValue || ''
                      )
                        .split('|')
                        .map((item) => item.trim())
                        .filter(Boolean)
                        .join(';')}
                    </Text>
                  ) : (
                    <Text type="warning" size="small">
                      {t('请选择规格')}
                    </Text>
                  )
                ) : null}
              </div>
            ) : null}
            {unified.productId > 0 && unified.skuOptions.length > 1 ? (
              <div className="cal-form-field" style={{ marginTop: 8 }}>
                <label className="cal-form-label">{t('规格')}</label>
                <div className="cal-form-control">
                  <Select
                    placeholder={t('请选择规格')}
                    optionList={unified.skuOptions.map((option) => ({
                      value: option.skuId,
                      label:
                        (option.skuValue || '')
                          .split('|')
                          .map((item) => item.trim())
                          .filter(Boolean)
                          .join(';') || t('规格{id}', { id: option.skuId }),
                    }))}
                    value={unified.skuId || undefined}
                    onChange={(next) =>
                      setUnified((current) => ({ ...current, skuId: Number(next || 0) }))
                    }
                    style={{ width: 360 }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div className="cal-form-field">
          <label className="cal-form-label">{t('门店')}</label>
          <div className="cal-form-control">
            {!unified.productId ? (
              <Text type="tertiary">{t('请先选择商品')}</Text>
            ) : (
              <>
                <RadioGroup
                  value={unified.selectionType}
                  onChange={(event) =>
                    setUnified((current) => ({
                      ...current,
                      selectionType: Number(event.target.value),
                      storeIds: [],
                    }))
                  }
                >
                  <Radio value={1}>{t('全部门店')}</Radio>
                  <Radio value={3}>{t('指定门店')}</Radio>
                </RadioGroup>
                <Select
                  multiple
                  filter
                  placeholder={unified.selectionType === 1 ? t('排除门店') : t('选择门店')}
                  optionList={storeSelectOptions.filter((option) => option.value !== 0)}
                  value={unified.storeIds}
                  onChange={(next) =>
                    setUnified((current) => ({ ...current, storeIds: (next as number[]) || [] }))
                  }
                  style={{ width: 360 }}
                />
              </>
            )}
          </div>
        </div>
        <div className="cal-form-field">
          <label className="cal-form-label">{t('日期范围')}</label>
          <div className="cal-form-control">
            <DatePicker
              type="dateRange"
              format="yyyy-MM-dd"
              value={unified.dateRange as never}
              disabledDate={(date) => (date ? date.getTime() < startOfToday().getTime() : false)}
              onChange={(date, dateStr) => {
                const range = pickRangeTexts(date, dateStr);
                setUnified((current) => ({ ...current, dateRange: range }));
              }}
              style={{ width: 300 }}
            />
            {renderExcludeBlock(unified.isExcluded, unified.excludeType, unified.excludeDay, (patch) =>
              setUnified((current) => ({ ...current, ...patch })),
            )}
          </div>
        </div>
        <div className="cal-form-field">
          <label className="cal-form-label">{t('可预约数量')}</label>
          <div className="cal-form-control cal-inline-field">
            <span className="cal-inline-text">{t('所选商品在每个可预约时间段上同时增加/减少')}</span>
            <InputNumber
              precision={0}
              style={{ width: 100 }}
              value={Number(unified.quantity || 0)}
              onChange={(next) => setUnified((current) => ({ ...current, quantity: Number(next || 0) }))}
            />
          </div>
        </div>
      </Modal>

      {/* 按时段设置库存（旧 ModifyInventory.vue） */}
      <Modal
        title={t('单个设置库存')}
        visible={slotModal.visible}
        confirmLoading={slotModal.saving}
        onOk={saveSlotModal}
        okText={t('保存')}
        onCancel={() => setSlotModal(closedSlotModal())}
        width={620}
      >
        <div className="cal-modal-meta">
          <div className="cal-modal-product">
            {slotModal.picUrl || slotModal.row?.productInfo?.productImage ? (
              <Image
                src={slotModal.picUrl || slotModal.row?.productInfo?.productImage}
                width={40}
                height={40}
                style={{ objectFit: 'contain' }}
              />
            ) : null}
            <span title={slotModal.productName || slotModal.row?.productInfo?.productName}>
              {slotModal.productName || slotModal.row?.productInfo?.productName || '-'}
            </span>
          </div>
          <Text type="tertiary">{t('门店：')}{slotModal.row?.shopInfo?.shopName || '-'}</Text>
        </div>
        <div className="cal-form-field">
          <label className="cal-form-label">{t('日期范围')}</label>
          <div className="cal-form-control">
            <DatePicker
              type="dateRange"
              format="yyyy-MM-dd"
              value={slotModal.dateRange as never}
              disabledDate={(date) => (date ? date.getTime() < startOfToday().getTime() : false)}
              onChange={(date, dateStr) => {
                const range = pickRangeTexts(date, dateStr);
                setSlotModal((current) => ({ ...current, dateRange: range }));
              }}
              style={{ width: 300 }}
            />
            {renderExcludeBlock(
              slotModal.isExcluded,
              slotModal.excludeType,
              slotModal.excludeDay,
              (patch) => setSlotModal((current) => ({ ...current, ...patch })),
            )}
          </div>
        </div>
        <div className="cal-form-field">
          <label className="cal-form-label">{t('可预约时段')}</label>
          <div className="cal-form-control">
            <Table
              size="small"
              loading={slotModal.loading}
              pagination={false}
              rowKey="productReservationTimeId"
              dataSource={slotModal.slots}
              empty={t('该商品未配置可预约时间段')}
              columns={
                [
                  {
                    title: t('时间段'),
                    dataIndex: 'startTime',
                    render: (_value: unknown, slot: TimeSlotRow) => (
                      <span>{`${slot.startTime || ''}~${slot.endTime || ''}`}</span>
                    ),
                  },
                  {
                    title: (
                      <span className="cal-table-head">
                        {t('增加/减少数量')}
                        <Tooltip content={t('正数为增加数量 负数为减少数量')}>
                          <span className="cal-help-icon">?</span>
                        </Tooltip>
                      </span>
                    ),
                    dataIndex: 'quantity',
                    width: 160,
                    render: (_value: unknown, slot: TimeSlotRow) => (
                      <InputNumber
                        size="small"
                        precision={0}
                        style={{ width: 100 }}
                        value={Number(slot.quantity || 0)}
                        onChange={(next) =>
                          updateSlotQuantity(slot.productReservationTimeId, Number(next || 0))
                        }
                      />
                    ),
                  },
                ] as never
              }
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
