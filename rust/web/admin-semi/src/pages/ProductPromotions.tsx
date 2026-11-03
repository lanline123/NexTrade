import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  DatePicker,
  InputNumber,
  Modal,
  Popover,
  Radio,
  RadioGroup,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Toast,
} from '@douyinfe/semi-ui';
import { IconChevronDown, IconPlus } from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import FormDrawer from '../framework/FormDrawer';
import type { ColumnConfig, FormDrawerConfig } from '../framework/types';
import ProductPicker from '../components/ProductPicker';
import './product-promotions.css';

/**
 * 满减活动（fullReductionManage）
 * 旧页面：java/view/admin/src/views/promotion/productActivity/fullReduction/List.vue
 *        （25 行包装页）+ 共享 activityTable.vue（promotionType=1）+ Info.vue + src/stepTable.vue
 * 后端：rust/crates/api/admin/src/routes/marketing/product_promotion.rs
 *       GET  /promotion/productPromotion/list|detail|config|conflict
 *       POST /promotion/productPromotion/create|update|del|updateField|batch
 * 列表查询 promotionType="1,2"（旧 activityTable 对非满赠类型默认查 1,2：满减 + 满折）。
 */

interface PromotionStep {
  minAmount?: number | string;
  reduce?: number | string;
  giftId?: number;
  giftName?: string;
  giftStock?: number;
  num?: number;
}

interface PromotionRow {
  promotionId: number;
  promotionName?: string;
  startTime?: string;
  endTime?: string;
  limitUserRank?: number[];
  range?: number;
  rangeData?: number[];
  minOrderAmount?: number | string;
  maxOrderAmount?: number | string;
  promotionType?: number;
  promotionTypeData?: PromotionStep[];
  isAvailable?: number;
  sortOrder?: number;
  rulesType?: number;
  unit?: number;
  promotionTypeName?: string;
  productStatus?: string;
  productTime?: string[];
  sendUserTarget?: unknown;
  memberAudience?: unknown;
}

/** 金额单位：旧版 config.config.amountUnit（映射自 dollarSignCn，缺省「元」） */
const AMOUNT_UNIT = '元';

/** 满减列表固定查满减(1)+满折(2)，与旧 activityTable defaultParams 一致 */
const LIST_QUERY = { promotionType: '1,2' };

/** 活动时间快捷项：value 对应旧 dateType（0=1天 1=7天 2=15天） */
const TIME_QUICK = [
  { value: 0, label: '1天', days: 1 },
  { value: 1, label: '7天', days: 7 },
  { value: 2, label: '15天', days: 15 },
];

/** 旧 utils/sendUserTarget.ts emptySendUserTarget() */
const EMPTY_SEND_USER_TARGET = {
  scope: 0,
  userIds: [],
  users: [],
  rankIds: [],
  tagIds: [],
  tagMatchMode: 0,
};

const pad2 = (value: number) => String(value).padStart(2, '0');

const fmtDateTime = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(
    date.getHours(),
  )}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;

const addDaysDate = (days: number) => new Date(Date.now() + days * 86400000);

const toDateTimeString = (value: unknown): string => {
  if (!value) return '';
  if (value instanceof Date) return fmtDateTime(value);
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(raw)) return raw.slice(0, 19);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw} 00:00:00`;
  return raw;
};

/** 时间差 → 快捷项 value（旧 getDaysBetweenDates：1/7/15 天高亮对应按钮，否则 -1 不亮） */
const dateDiffQuick = (start?: string, end?: string) => {
  if (!start || !end) return -1;
  const s = new Date(String(start).replace(/-/g, '/')).getTime();
  const e = new Date(String(end).replace(/-/g, '/')).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e)) return -1;
  const days = Math.round((e - s) / 86400000);
  const found = TIME_QUICK.find((item) => item.days === days);
  return found ? found.value : -1;
};

const statusColor = (text?: string) => {
  if (text === '活动进行中') return 'green';
  if (text === '活动未开始') return 'orange';
  return 'grey';
};

const isEmptyInput = (value: unknown) =>
  value === '' || value === undefined || value === null;

const buildDefaultForm = (): Record<string, any> => ({
  promotionType: 1,
  unit: 1,
  promotionName: '',
  startTime: fmtDateTime(new Date()),
  endTime: fmtDateTime(addDaysDate(1)),
  rulesType: 1,
  promotionTypeData: [{ minAmount: undefined, reduce: undefined }],
  range: 0,
  rangeData: [],
  limitUserRank: [],
  isAvailable: 1,
  sortOrder: 50,
});

function SortEditor({ row, onSaved }: { row: PromotionRow; onSaved: () => void }) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState<number>(Number(row.sortOrder ?? 50));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await apiPost('/promotion/productPromotion/updateField', {
        id: row.promotionId,
        field: 'sortOrder',
        val: Number(value ?? 50),
      });
      Toast.success({ content: t('修改成功') });
      setVisible(false);
      onSaved();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('修改失败') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover
      trigger="custom"
      visible={visible}
      onClickOutside={() => setVisible(false)}
      content={
        <div className="promo-sort-pop">
          <label>{t('排序')}</label>
          <InputNumber
            size="small"
            min={0}
            precision={0}
            style={{ width: 120 }}
            value={value}
            onChange={(next) => setValue(Number(next ?? 50))}
          />
          <div className="promo-sort-tip">{t('默认值为50，数值越小，排序越靠前')}</div>
          <Space>
            <Button size="small" onClick={() => setVisible(false)}>
              {t('取消')}
            </Button>
            <Button size="small" theme="solid" type="primary" loading={saving} onClick={submit}>
              {t('确定')}
            </Button>
          </Space>
        </div>
      }
    >
      <span className="promo-sort-edit" title={t('点击修改排序')} onClick={() => setVisible(true)}>
        {row.sortOrder ?? 50}
      </span>
    </Popover>
  );
}

/** 活动类型卡片（旧 RadioType：满N元减 元/折 与 满N件减 元/折） */
function UnitField({ formApi, values }: { formApi: any; values: Record<string, any> }) {
  const { t } = useI18n();
  return (
    <div className="promo-unit-options">
      <div
        className={`promo-unit-option${Number(values.unit) === 1 ? ' is-active' : ''}`}
        title={t('按金额满减/满折')}
        onClick={() => formApi?.setValue('unit', 1)}
      >
        <div className="promo-unit-title">
          {t('满N{unit}减 {unit}/折', { unit: t(AMOUNT_UNIT) })}
        </div>
        <div className="promo-unit-desc">
          {t('例：满100{unit}减10{unit}/满100{unit}打8折', { unit: t(AMOUNT_UNIT) })}
        </div>
      </div>
      <div
        className={`promo-unit-option${Number(values.unit) === 2 ? ' is-active' : ''}`}
        title={t('按件数满减/满折')}
        onClick={() => formApi?.setValue('unit', 2)}
      >
        <div className="promo-unit-title">{t('满N件减 {unit}/折', { unit: t(AMOUNT_UNIT) })}</div>
        <div className="promo-unit-desc">{t('例：满3件减10{unit}/满3件打8折', { unit: t(AMOUNT_UNIT) })}</div>
      </div>
    </div>
  );
}

/** 活动时间（旧 SelectTimeInterval + 1天/7天/15天 快捷按钮） */
function TimeRangeField({ formApi, values }: { formApi: any; values: Record<string, any> }) {
  const { t } = useI18n();
  return (
    <div className="promo-time-row">
      <DatePicker
        type="dateTime"
        format="yyyy-MM-dd HH:mm:ss"
        placeholder={t('开始时间')}
        style={{ width: 185 }}
        value={values.startTime || ''}
        onChange={(next: any) => formApi?.setValue('startTime', toDateTimeString(next))}
      />
      <span className="promo-time-sep">{t('至')}</span>
      <DatePicker
        type="dateTime"
        format="yyyy-MM-dd HH:mm:ss"
        placeholder={t('截止时间')}
        style={{ width: 185 }}
        value={values.endTime || ''}
        onChange={(next: any) => formApi?.setValue('endTime', toDateTimeString(next))}
      />
      <RadioGroup
        className="promo-time-quick"
        value={dateDiffQuick(values.startTime, values.endTime)}
        onChange={(event: any) => {
          const picked = TIME_QUICK.find((item) => item.value === Number(event.target.value));
          if (!picked) return;
          formApi?.setValue('startTime', fmtDateTime(new Date()));
          formApi?.setValue('endTime', fmtDateTime(addDaysDate(picked.days)));
        }}
      >
        {TIME_QUICK.map((item) => (
          <Radio key={item.value} value={item.value}>
            {t(item.label)}
          </Radio>
        ))}
      </RadioGroup>
    </div>
  );
}

/**
 * 满减阶梯（旧 stepTable.vue，满X减Y / 满X打Y折 多级设置）。
 * rulesType 1=阶梯优惠（可加到 5 级、可删除）0=循环优惠（单行、固定减价）。
 * promotionType 1=减价 2=折扣（折扣仅阶梯下可选；进行中的活动不可切换，旧版同口径）。
 * 旧组件的『送赠品/赠品数量』列（promotionType=3 满赠）属 rewardGift 页面，不在本页范围。
 */
function StepTableField({
  formApi,
  values,
  canChangeType,
}: {
  formApi: any;
  values: Record<string, any>;
  canChangeType: boolean;
}) {
  const { t } = useI18n();
  const rulesType = Number(values.rulesType ?? 1);
  const promotionType = Number(values.promotionType ?? 1);
  const unit = Number(values.unit ?? 1);
  const rows = (Array.isArray(values.promotionTypeData) ? values.promotionTypeData : []) as PromotionStep[];

  const setRows = (next: PromotionStep[]) => formApi?.setValue('promotionTypeData', next);
  const patchRow = (index: number, patch: Partial<PromotionStep>) =>
    setRows(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const addStep = () => {
    if (rows.length < 5) setRows([...rows, { minAmount: undefined, reduce: undefined }]);
  };
  const removeStep = (index: number) => setRows(rows.filter((_, i) => i !== index));

  const minPrecision = unit === 1 ? 2 : 0;
  const reduceDisabled = (row: PromotionStep) => !(Number(row.minAmount) > 0);

  return (
    <div className="promo-step-wrap">
      {rulesType === 1 ? (
        <Button
          type="primary"
          theme="borderless"
          icon={<IconPlus />}
          disabled={rows.length >= 5}
          onClick={addStep}
          title={t('最多添加5级优惠')}
        >
          {rows.length >= 5 ? t('多添加5级优惠') : t('添加下一级优惠')}
        </Button>
      ) : null}
      <div className="promo-step-table">
        <div className="promo-step-head">
          {rulesType === 1 ? <div className="promo-step-col promo-step-level">{t('层级')}</div> : null}
          <div className="promo-step-col promo-step-min">{t('门槛')}</div>
          <div className="promo-step-col promo-step-reduce">
            <Popover
              trigger="click"
              content={
                <div className="promo-step-type-pop">
                  <RadioGroup
                    value={promotionType}
                    onChange={(event: any) => formApi?.setValue('promotionType', Number(event.target.value))}
                  >
                    <Radio value={1}>{t('减价')}</Radio>
                    {rulesType === 1 ? <Radio value={2}>{t('折扣')}</Radio> : null}
                  </RadioGroup>
                </div>
              }
            >
              <Button
                size="small"
                theme="borderless"
                disabled={!canChangeType}
                title={canChangeType ? t('切换减价/折扣') : t('活动进行中不可切换')}
              >
                {t('{type}已选: ({current})', {
                  type: rulesType === 1 ? t('减价/折扣') : t('减价'),
                  current: promotionType === 1 ? t('减价') : t('折扣'),
                })}
                <IconChevronDown size="small" />
              </Button>
            </Popover>
          </div>
          {rulesType === 1 ? <div className="promo-step-col promo-step-op">{t('操作')}</div> : null}
        </div>
        {rows.map((row, index) => (
          <div className="promo-step-row" key={index}>
            {rulesType === 1 ? (
              <div className="promo-step-col promo-step-level">{index + 1}</div>
            ) : null}
            <div className="promo-step-col promo-step-min">
              <Space spacing={6}>
                <span>{rulesType === 1 ? t('满') : t('每满')}</span>
                <InputNumber
                  size="small"
                  min={0}
                  precision={minPrecision}
                  style={{ width: 96 }}
                  value={row.minAmount as number | undefined}
                  onChange={(next) => patchRow(index, { minAmount: isEmptyInput(next) ? '' : next })}
                />
                <span>{unit === 1 ? t(AMOUNT_UNIT) : t('件')}</span>
              </Space>
            </div>
            <div className="promo-step-col promo-step-reduce">
              {promotionType === 2 ? (
                <Space spacing={6}>
                  <span>{t('打')}</span>
                  <InputNumber
                    size="small"
                    min={0.1}
                    max={9.9}
                    precision={1}
                    style={{ width: 96 }}
                    disabled={reduceDisabled(row)}
                    value={row.reduce as number | undefined}
                    onChange={(next) => patchRow(index, { reduce: isEmptyInput(next) ? '' : next })}
                  />
                  <span>{t('折')}</span>
                </Space>
              ) : (
                <Space spacing={6}>
                  <span>{t('减')}</span>
                  <InputNumber
                    size="small"
                    min={0}
                    precision={2}
                    style={{ width: 96 }}
                    disabled={reduceDisabled(row)}
                    value={row.reduce as number | undefined}
                    onChange={(next) => patchRow(index, { reduce: isEmptyInput(next) ? '' : next })}
                  />
                  <span>{t(AMOUNT_UNIT)}</span>
                </Space>
              )}
            </div>
            {rulesType === 1 ? (
              <div className="promo-step-col promo-step-op">
                {index > 0 ? (
                  <Button theme="borderless" type="danger" size="small" onClick={() => removeStep(index)}>
                    {t('删除')}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProductPromotions() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [statusOptions, setStatusOptions] = useState<Array<{ label: string; value: number }>>([]);
  const [rankOptions, setRankOptions] = useState<Array<{ label: string; value: number }>>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [drawerInitial, setDrawerInitial] = useState<Record<string, any>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingRecord, setEditingRecord] = useState<PromotionRow | null>(null);
  const [editingStatus, setEditingStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [conflictVisible, setConflictVisible] = useState(false);
  const [conflictList, setConflictList] = useState<any[]>([]);

  useEffect(() => {
    apiGet<any>('/promotion/productPromotion/config')
      .then((result) => {
        const status = result?.promotionStatus || {};
        setStatusOptions(
          Object.keys(status).map((key) => ({ value: Number(key), label: String(status[key]) })),
        );
        const ranks = result?.rankList || [];
        setRankOptions(
          ranks.map((rank: any) => ({ label: rank.rankName, value: rank.rankId })),
        );
      })
      .catch(() => undefined);
  }, []);

  const reload = () => setReloadKey((key) => key + 1);

  const openCreate = () => {
    setDrawerMode('create');
    setEditingId(null);
    setEditingRecord(null);
    setEditingStatus('');
    setDrawerInitial(buildDefaultForm());
    setDrawerOpen(true);
  };

  const openEdit = async (row: PromotionRow) => {
    setDrawerMode('edit');
    setEditingId(row.promotionId);
    setEditingRecord(row);
    setEditingStatus(row.productStatus || '');
    let merged: Record<string, any> = { ...buildDefaultForm(), ...row };
    try {
      const detail = await apiGet<Record<string, any>>('/promotion/productPromotion/detail', {
        id: row.promotionId,
      });
      if (detail) {
        merged = { ...buildDefaultForm(), ...row, ...detail };
        setEditingRecord({ ...row, ...detail } as PromotionRow);
        setEditingStatus(String(detail.productStatus || row.productStatus || ''));
      }
    } catch {
      // 详情拉取失败时退回行数据（旧版 fetchActivity 的容错口径）
    }
    if (!Array.isArray(merged.promotionTypeData) || !merged.promotionTypeData.length) {
      merged.promotionTypeData = [{ minAmount: undefined, reduce: undefined }];
    }
    setDrawerInitial(merged);
    setDrawerOpen(true);
  };

  const updateField = async (row: PromotionRow, field: string, val: unknown) => {
    try {
      await apiPost('/promotion/productPromotion/updateField', {
        id: row.promotionId,
        field,
        val,
      });
      Toast.success({ content: t('修改成功') });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('修改失败') });
    } finally {
      reload();
    }
  };

  const deletePromotion = (row: PromotionRow) => {
    Modal.confirm({
      title: t('确认删除该优惠活动吗？'),
      content: t('启用中的活动需先停用后才能删除'),
      onOk: async () => {
        try {
          await apiPost('/promotion/productPromotion/del', { id: row.promotionId });
          Toast.success({ content: t('删除成功') });
          reload();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
        }
      },
    });
  };

  const fetchConflict = async (body: Record<string, any>) => {
    try {
      const result = await apiGet<{ records?: any[] }>('/promotion/productPromotion/conflict', {
        range: body.range,
        rangeData: (body.rangeData || []).join(','),
        startTime: body.startTime,
        endTime: body.endTime,
        promotionType: body.promotionType,
      });
      const records = result?.records || [];
      setConflictList(records);
      setConflictVisible(records.length > 0);
    } catch {
      setConflictList([]);
      setConflictVisible(false);
    }
  };

  /** 旧 stepTable 校验规则（minAmount/reduce）的提交前版本 */
  const validateSteps = (payload: Record<string, any>) => {
    const promotionType = Number(payload.promotionType);
    const unit = Number(payload.unit);
    const rows = (Array.isArray(payload.promotionTypeData)
      ? payload.promotionTypeData
      : []) as PromotionStep[];
    if (!rows.length) return t('请添加优惠规则');
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (isEmptyInput(row.minAmount)) return t('请输入门槛数值');
      const minAmount = Number(row.minAmount);
      if (minAmount < 0) return t('门槛数值必须为正数');
      if (promotionType === 2) {
        if (isEmptyInput(row.reduce)) return t('请输入折扣');
        const reduce = Number(row.reduce);
        if (reduce < 0.1 || reduce > 9.9) return t('折扣范围为0.1-9.9');
      } else if (unit === 1) {
        if (isEmptyInput(row.reduce)) return t('请输入金额数');
        const reduce = Number(row.reduce);
        if (reduce >= minAmount) return t('应小于门槛金额');
        if (reduce < 0.01 || reduce > 99999) return t('输入范围为0.01-99999');
      }
    }
    return '';
  };

  const savePromotion = async (payload: Record<string, any>) => {
    const name = String(payload.promotionName || '').trim();
    if (!name) {
      Toast.warning({ content: t('请输入活动名称') });
      return;
    }
    if (name.length > 50) {
      Toast.warning({ content: t('满减活动名称长度不能超过50') });
      return;
    }
    if (!payload.startTime || !payload.endTime) {
      Toast.warning({ content: t('请选择活动时间') });
      return;
    }
    const stepsError = validateSteps(payload);
    if (stepsError) {
      Toast.warning({ content: stepsError });
      return;
    }
    const range = Number(payload.range ?? 0);
    const rangeData = Array.isArray(payload.rangeData) ? payload.rangeData.map(Number) : [];
    if (range !== 0 && !rangeData.length) {
      Toast.warning({ content: t('请选择商品') });
      return;
    }
    const body: Record<string, any> = {
      promotionName: name,
      startTime: payload.startTime,
      endTime: payload.endTime,
      promotionType: Number(payload.promotionType ?? 1),
      unit: Number(payload.unit ?? 1),
      rulesType: Number(payload.rulesType ?? 1),
      promotionTypeData: ((payload.promotionTypeData || []) as PromotionStep[]).map((row) => ({
        minAmount: Number(row.minAmount ?? 0),
        reduce: String(row.reduce ?? ''),
      })),
      range,
      rangeData: range === 0 ? [] : rangeData,
      limitUserRank: Array.isArray(payload.limitUserRank) ? payload.limitUserRank.map(Number) : [],
      // 旧 Info.vue 提交口径：会员标记未启用，统一按全部会员处理
      memberRange: 0,
      memberMarks: [],
    };
    setSaving(true);
    try {
      if (drawerMode === 'edit' && editingId) {
        await apiPost('/promotion/productPromotion/update', {
          ...body,
          promotionId: editingId,
          isAvailable: Number(editingRecord?.isAvailable ?? 1),
          sortOrder: Number(editingRecord?.sortOrder ?? 50),
          ...(editingRecord?.sendUserTarget !== undefined && editingRecord?.sendUserTarget !== null
            ? { sendUserTarget: editingRecord.sendUserTarget }
            : {}),
          ...(editingRecord?.memberAudience !== undefined && editingRecord?.memberAudience !== null
            ? { memberAudience: editingRecord.memberAudience }
            : {}),
        });
      } else {
        await apiPost('/promotion/productPromotion/create', {
          ...body,
          isAvailable: 1,
          sortOrder: 50,
          sendUserTarget: EMPTY_SEND_USER_TARGET,
        });
      }
      Toast.success({ content: t('操作成功') });
      setDrawerOpen(false);
      reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('保存失败');
      Toast.error({ content: message });
      // 后端冲突码 5001（存在冲突活动，请重新设置活动）→ 弹冲突列表（旧 fetchProductConflict）
      if (message.includes('冲突')) {
        await fetchConflict(body);
      }
    } finally {
      setSaving(false);
    }
  };

  const drawerConfig = useMemo<FormDrawerConfig>(() => {
    return {
      title: drawerMode === 'create' ? '添加满减优惠活动' : '优惠活动',
      width: 1040,
      labelWidth: 130,
      createApi: '/promotion/productPromotion/create',
      updateApi: '/promotion/productPromotion/update',
      idField: 'promotionId',
      sections: [
        {
          key: 'basic',
          title: '基础信息',
          fields: [
            {
              field: 'unit',
              label: t('活动类型'),
              type: 'custom',
              render: ({ formApi, values }) => <UnitField formApi={formApi} values={values} />,
            },
            {
              field: 'promotionName',
              label: t('活动名称'),
              type: 'input',
              required: true,
              placeholder: t('请输入活动名称'),
              rules: [{ required: true, message: t('请输入活动名称') }],
            },
            {
              field: 'startTime',
              label: t('活动时间'),
              type: 'custom',
              // 旧 Info.vue 该 form-item 的 prop="sendType" 为遗留命名（复制自优惠券表单），
              // 实际载荷字段为 startTime / endTime，此处保持语义对应。
              render: ({ formApi, values }) => <TimeRangeField formApi={formApi} values={values} />,
            },
            {
              field: 'rulesType',
              label: t('优惠规则'),
              type: 'custom',
              render: ({ formApi, values }) => (
                <div className="promo-rules-wrap">
                  <RadioGroup
                    value={Number(values.rulesType ?? 1)}
                    onChange={(event: any) => {
                      // 旧 stepTable watch：切换规则类型时重置为单行，循环优惠固定减价
                      const next = Number(event.target.value);
                      formApi?.setValue('rulesType', next);
                      const currentType = Number(values.promotionType);
                      if (currentType === 1 || currentType === 2) {
                        if (next === 0) formApi?.setValue('promotionType', 1);
                        formApi?.setValue('promotionTypeData', [
                          { minAmount: undefined, reduce: undefined },
                        ]);
                      }
                    }}
                  >
                    <Radio value={1}>
                      {t('阶梯优惠（例：满1件减10{unit}）', { unit: t(AMOUNT_UNIT) })}
                    </Radio>
                    <Radio value={0}>
                      {t('循环优惠（例：每满1件减10{unit}）', { unit: t(AMOUNT_UNIT) })}
                    </Radio>
                  </RadioGroup>
                  <StepTableField
                    formApi={formApi}
                    values={values}
                    canChangeType={editingStatus !== '活动进行中'}
                  />
                </div>
              ),
            },
          ],
        },
        {
          key: 'scope',
          title: '适用范围',
          fields: [
            {
              field: 'range',
              label: t('适用商品'),
              type: 'custom',
              render: ({ formApi, values }) => (
                <div className="promo-range-wrap">
                  <RadioGroup
                    value={Number(values.range ?? 0)}
                    onChange={(event: any) => formApi?.setValue('range', Number(event.target.value))}
                  >
                    <Radio value={0}>{t('全部商品')}</Radio>
                    <Radio value={3}>{t('以下商品')}</Radio>
                    <Radio value={4}>{t('不含以下商品')}</Radio>
                  </RadioGroup>
                  {Number(values.range) !== 0 ? (
                    <ProductPicker
                      value={(values.rangeData as number[]) || []}
                      onChange={(ids) => formApi?.setValue('rangeData', ids)}
                      max={200}
                    />
                  ) : null}
                </div>
              ),
            },
            {
              field: 'limitUserRank',
              label: t('参与客户限制'),
              type: 'custom',
              render: ({ formApi, values }) => (
                <Select
                  placeholder={t('请选择')}
                  multiple
                  style={{ width: 300 }}
                  optionList={rankOptions}
                  value={(values.limitUserRank as number[]) || []}
                  onChange={(next) => formApi?.setValue('limitUserRank', (next as number[]) || [])}
                />
              ),
            },
            {
              field: 'sendUserTarget',
              label: t('适用会员'),
              type: 'custom',
              render: () => (
                <div
                  className="promo-member-target"
                  title={t('SendUserSelector 人群圈选未迁移：创建/编辑统一按全部会员提交')}
                >
                  {t('全部会员（人群圈选暂未迁移，按全部会员提交）')}
                </div>
              ),
            },
          ],
        },
      ],
    };
  }, [drawerMode, rankOptions, editingStatus, t]);

  const columns: ColumnConfig<PromotionRow>[] = [
    {
      title: '活动名称',
      dataIndex: 'promotionName',
      width: 200,
      render: (value: string) => <span>{value || '--'}</span>,
    },
    {
      title: '活动类型',
      dataIndex: 'promotionTypeName',
      width: 100,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    { title: '起始日期', dataIndex: 'startTime', width: 170 },
    { title: '截止日期', dataIndex: 'endTime', width: 170 },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      width: 100,
      render: (_: unknown, row: PromotionRow) => <SortEditor row={row} onSaved={reload} />,
    },
    {
      title: '状态',
      dataIndex: 'productStatus',
      width: 110,
      render: (value: string) => (
        <Tag color={statusColor(value) as never}>{value || '-'}</Tag>
      ),
    },
    {
      title: '是否启用',
      dataIndex: 'isAvailable',
      width: 100,
      render: (value: number, row: PromotionRow) => (
        <Switch
          checked={Number(value) === 1}
          onChange={(next) => updateField(row, 'isAvailable', next ? 1 : 0)}
        />
      ),
    },
  ];

  return (
    <div className="product-promotions-page">
      <ListPage<PromotionRow>
        key={reloadKey}
        api="/promotion/productPromotion/list"
        rowKey="promotionId"
        pageSize={10}
        selectable
        query={LIST_QUERY}
        actionWidth={110}
        filters={[
          {
            field: 'keyword',
            label: '活动名称',
            type: 'input',
            placeholder: '输入活动名称',
            width: 240,
          },
          ...(statusOptions.length
            ? [
                {
                  field: 'isGoing',
                  label: '活动状态',
                  type: 'select' as const,
                  options: statusOptions,
                  width: 160,
                },
              ]
            : []),
        ]}
        columns={columns}
        toolbarExtra={
          <Button theme="solid" type="primary" icon={<IconPlus />} onClick={openCreate}>
            {t('新增满减活动')}
          </Button>
        }
        batchActions={(rows, clear) => (
          <Button
            size="small"
            onClick={() => {
              Modal.confirm({
                title: t('您确认要批量删除所选数据吗？'),
                onOk: async () => {
                  try {
                    await apiPost('/promotion/productPromotion/batch', {
                      ids: rows.map((row) => row.promotionId),
                      type: 'del',
                    });
                    Toast.success({ content: t('批量删除成功') });
                    clear();
                    reload();
                  } catch (error) {
                    Toast.error({
                      content: error instanceof Error ? error.message : t('批量删除失败'),
                    });
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
            <Button theme="borderless" type="danger" size="small" onClick={() => deletePromotion(row)}>
              {t('删除')}
            </Button>
          </Space>
        )}
      />

      <FormDrawer
        visible={drawerOpen}
        mode={drawerMode}
        initialValues={drawerInitial}
        config={drawerConfig}
        saving={saving}
        onCancel={() => setDrawerOpen(false)}
        onSubmit={savePromotion}
      />

      <Modal
        title={t('冲突提示')}
        visible={conflictVisible}
        footer={null}
        onCancel={() => setConflictVisible(false)}
        width={620}
      >
        <Table
          size="small"
          pagination={false}
          rowKey="promotionId"
          dataSource={conflictList}
          columns={[
            { title: t('活动名称'), dataIndex: 'promotionName', width: 150 },
            {
              title: t('活动重合时间'),
              dataIndex: 'name',
              width: 300,
              render: (_: unknown, row: any) =>
                t('{start}至{end}', { start: row.startTime, end: row.endTime }),
            },
            { title: t('活动类型'), dataIndex: 'promotionTypeName' },
          ]}
        />
        {!conflictList.length ? <span className="promo-member-target">{t('暂无冲突活动')}</span> : null}
      </Modal>
    </div>
  );
}
