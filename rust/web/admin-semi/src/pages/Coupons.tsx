import { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  Input,
  InputNumber,
  Modal,
  Radio,
  RadioGroup,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  TextArea,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import FormDrawer from '../framework/FormDrawer';
import type { ColumnConfig, FormDrawerConfig } from '../framework/types';
import ProductPicker from '../components/ProductPicker';
import SendUserSelector from '../components/SendUserSelector';

const { Text } = Typography;

interface CouponRow {
  couponId: number;
  couponName?: string;
  couponType?: number;
  isNewUser?: number;
  couponMoney?: number;
  couponDiscount?: number;
  reduceType?: number;
  couponUnit?: number;
  minOrderAmount?: number;
  isShow?: number;
  sendType?: number;
  delayDay?: number;
  useDay?: number;
  useStartDate?: string;
  useEndDate?: string;
  status?: number;
  limitUserRank?: number[];
}

interface CouponUser {
  userId: number;
  username?: string;
  nickname?: string;
  mobile?: string;
}

const money = (value: unknown) => `${Number(value || 0)}`;

const couponStatusText = (status?: number) => {
  if (status === 2) return '未开始';
  if (status === 3) return '过期';
  return '进行中';
};

const isCouponExpired = (row: CouponRow) =>
  row.useEndDate ? new Date(row.useEndDate).getTime() < Date.now() : false;

const QUICK_CARDS = [
  { title: '满减券', desc: '例：满100元减20元，便于合理控制活动成本', preset: { couponType: 1, isNewUser: 0 } },
  { title: '折扣券', desc: '例：满100元打9折，提高店铺销量和客单价', preset: { couponType: 2, isNewUser: 0 } },
  { title: '新人专享券', desc: '仅店铺新客可领，提高新客首单转化', preset: { couponType: 1, isNewUser: 1 } },
  { title: '会员专享券', desc: '限会员可领的优惠券，丰富会员权益，凸显会员身份价值', preset: { couponType: 1, isNewUser: 2 } },
];

const DEFAULT_FORM = {
  couponType: 1,
  isNewUser: 0,
  couponName: '',
  couponUnit: 1,
  reduceType: 1,
  minOrderAmount: 100,
  couponMoney: 20,
  couponDiscount: 8,
  maxOrderAmount: 0,
  sendType: 1,
  useStartDate: '',
  useEndDate: '',
  delayDay: 0,
  useDay: 30,
  sendNum: 1000,
  limitNum: 0,
  limitUserRank: [] as number[],
  sendUserTarget: { scope: 0, userIds: [], users: [], rankIds: [], tagIds: [], tagMatchMode: 0 },
  sendRange: 0,
  sendRangeData: [] as number[],
  isShow: 1,
  couponDesc: '',
};

export default function Coupons() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [drawerInitial, setDrawerInitial] = useState<Record<string, any>>({ ...DEFAULT_FORM });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [rankOptions, setRankOptions] = useState<Array<{ label: string; value: number }>>([]);
  const [issueTarget, setIssueTarget] = useState<CouponRow | null>(null);
  const [issueType, setIssueType] = useState<'USER' | 'RANK'>('USER');
  const [issueUserKeyword, setIssueUserKeyword] = useState('');
  const [issueUsers, setIssueUsers] = useState<CouponUser[]>([]);
  const [issueUserIds, setIssueUserIds] = useState<number[]>([]);
  const [issueRankIds, setIssueRankIds] = useState<number[]>([]);
  const [issueSubmitting, setIssueSubmitting] = useState(false);
  const [logTarget, setLogTarget] = useState<CouponRow | null>(null);
  const [logRows, setLogRows] = useState<any[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  useEffect(() => {
    apiGet<any>('/promotion/coupon/config')
      .then((result) => {
        const ranks = result?.rankList || [];
        setRankOptions(ranks.map((rank: any) => ({ label: rank.rankName, value: rank.rankId })));
      })
      .catch(() => undefined);
  }, []);

  const reload = () => setReloadKey((key) => key + 1);

  const openCreate = (preset: Record<string, any>) => {
    setDrawerMode('create');
    setEditingId(null);
    setDrawerInitial({ ...DEFAULT_FORM, ...preset, limitNum: preset.isNewUser === 1 ? 1 : 0 });
    setDrawerOpen(true);
  };

  const openEdit = async (row: CouponRow) => {
    setDrawerMode('edit');
    setEditingId(row.couponId);
    try {
      const detail = await apiGet<Record<string, any>>('/promotion/coupon/detail', { id: row.couponId });
      setDrawerInitial({ ...DEFAULT_FORM, ...(detail || row) });
    } catch {
      setDrawerInitial({ ...DEFAULT_FORM, ...row });
    }
    setDrawerOpen(true);
  };

  const drawerConfig: FormDrawerConfig = {
      title: drawerMode === 'create' ? '添加优惠券' : '编辑优惠券',
      width: 760,
      labelWidth: 130,
      createApi: '/promotion/coupon/create',
      updateApi: '/promotion/coupon/update',
      idField: 'couponId',
      sections: [
        {
          key: 'basic',
          title: '基础信息',
          fields: [
            {
              field: 'couponType',
              label: t('优惠券类型'),
              type: 'radio',
              options: [
                { label: t('满减券（例：满100减20）'), value: 1 },
                { label: t('折扣券（例：满100打8折）'), value: 2 },
              ],
            },
            { field: 'couponName', label: t('优惠券名称'), type: 'input', required: true, placeholder: t('请输入优惠券名称') },
            {
              field: 'reduceType',
              label: t('优惠内容'),
              type: 'custom',
              render: ({ formApi, values }) => (
                <div className="coupon-form-content">
                  <Space>
                    <Radio
                      checked={Number(values.reduceType) === 1}
                      onChange={() => formApi?.setValue('reduceType', 1)}
                    >
                      {t('满')}
                    </Radio>
                    <InputNumber
                      size="small"
                      min={0}
                      style={{ width: 130 }}
                      disabled={Number(values.reduceType) === 2}
                      value={Number(values.minOrderAmount ?? 0)}
                      onChange={(next) => formApi?.setValue('minOrderAmount', Number(next ?? 0))}
                    />
                    <Select
                      size="small"
                      style={{ width: 90 }}
                      disabled={Number(values.reduceType) === 2}
                      value={Number(values.couponUnit ?? 1)}
                      optionList={[
                        { label: t('元'), value: 1 },
                        { label: t('件'), value: 2 },
                      ]}
                      onChange={(next) => formApi?.setValue('couponUnit', Number(next))}
                    />
                    <Text>{Number(values.couponType) === 1 ? t('减') : t('打')}</Text>
                    {Number(values.couponType) === 1 ? (
                      <InputNumber
                        size="small"
                        min={0}
                        style={{ width: 130 }}
                        disabled={Number(values.reduceType) === 2}
                        value={Number(values.couponMoney ?? 0)}
                        onChange={(next) => formApi?.setValue('couponMoney', Number(next ?? 0))}
                      />
                    ) : (
                      <InputNumber
                        size="small"
                        min={0}
                        max={9.9}
                        precision={1}
                        style={{ width: 130 }}
                        disabled={Number(values.reduceType) === 2}
                        value={Number(values.couponDiscount ?? 0)}
                        onChange={(next) => formApi?.setValue('couponDiscount', Number(next ?? 0))}
                      />
                    )}
                    {Number(values.couponType) === 1 ? <Text>{t('元')}</Text> : <Text>{t('折')}</Text>}
                  </Space>
                  <Space>
                    <Radio
                      checked={Number(values.reduceType) === 2}
                      onChange={() => formApi?.setValue('reduceType', 2)}
                    >
                      {t('无门槛，')}{Number(values.couponType) === 1 ? t('减') : t('打')}
                    </Radio>
                    {Number(values.couponType) === 1 ? (
                      <InputNumber
                        size="small"
                        min={0}
                        style={{ width: 130 }}
                        disabled={Number(values.reduceType) === 1}
                        value={Number(values.couponMoney ?? 0)}
                        onChange={(next) => formApi?.setValue('couponMoney', Number(next ?? 0))}
                      />
                    ) : (
                      <InputNumber
                        size="small"
                        min={0}
                        max={9.9}
                        precision={1}
                        style={{ width: 130 }}
                        disabled={Number(values.reduceType) === 1}
                        value={Number(values.couponDiscount ?? 0)}
                        onChange={(next) => formApi?.setValue('couponDiscount', Number(next ?? 0))}
                      />
                    )}
                    {Number(values.couponType) === 1 ? <Text>{t('元')}</Text> : <Text>{t('折')}</Text>}
                  </Space>
                </div>
              ),
            },
            {
              field: 'maxOrderAmount',
              label: t('优惠上限'),
              type: 'custom',
              render: ({ formApi, values }) =>
                Number(values.couponType) === 2 ? (
                  <div className="coupon-form-content">
                    <InputNumber
                      style={{ width: 180 }}
                      min={0}
                      value={Number(values.maxOrderAmount ?? 0)}
                      onChange={(next) => formApi?.setValue('maxOrderAmount', Number(next ?? 0))}
                    />
                    <Text type="tertiary" size="small">
                      {t('最多可打折的金额, 默认 0 表示无限制')}
                    </Text>
                  </div>
                ) : null,
            },
            {
              field: 'sendType',
              label: t('用券时间'),
              type: 'custom',
              render: ({ formApi, values }) => (
                <div className="coupon-form-content">
                  <Space>
                    <Radio
                      checked={Number(values.sendType) === 1}
                      onChange={() => formApi?.setValue('sendType', 1)}
                    >
                      {t('固定时间段')}
                    </Radio>
                    <Input
                      size="small"
                      style={{ width: 180 }}
                      placeholder={t('开始时间 YYYY-MM-DD HH:mm:ss')}
                      disabled={Number(values.sendType) === 0}
                      value={values.useStartDate || ''}
                      onChange={(next) => formApi?.setValue('useStartDate', next)}
                    />
                    <Input
                      size="small"
                      style={{ width: 180 }}
                      placeholder={t('结束时间 YYYY-MM-DD HH:mm:ss')}
                      disabled={Number(values.sendType) === 0}
                      value={values.useEndDate || ''}
                      onChange={(next) => formApi?.setValue('useEndDate', next)}
                    />
                  </Space>
                  <Space>
                    <Radio
                      checked={Number(values.sendType) === 0}
                      onChange={() => formApi?.setValue('sendType', 0)}
                    >
                      {t('领券后')}
                    </Radio>
                    <InputNumber
                      size="small"
                      min={0}
                      precision={0}
                      style={{ width: 100 }}
                      disabled={Number(values.sendType) === 1}
                      value={Number(values.delayDay ?? 0)}
                      onChange={(next) => formApi?.setValue('delayDay', Number(next ?? 0))}
                    />
                    <Text>{t('天生效，有效期')}</Text>
                    <InputNumber
                      size="small"
                      min={0}
                      precision={0}
                      style={{ width: 120 }}
                      disabled={Number(values.sendType) === 1}
                      value={Number(values.useDay ?? 0)}
                      onChange={(next) => formApi?.setValue('useDay', Number(next ?? 0))}
                    />
                    <Text>{t('天')}</Text>
                  </Space>
                  <Text type="tertiary" size="small">
                    {t('领券后默认0天生效, 表示立即生效')}
                  </Text>
                </div>
              ),
            },
            {
              field: 'sendNum',
              label: t('发放总量'),
              type: 'number',
              initValue: 1000,
              extraText: t('修改优惠券总量时只能增加不能减少，请谨慎设置。'),
            },
            {
              field: 'limitNum',
              label: t('领取次数限制'),
              type: 'number',
              initValue: 0,
              extraText: t('限制每个用户最多可领次数, 默认 0 表示无领取限制（新人专享券仅限领取一次）'),
            },
            {
              field: 'isNewUser',
              label: t('领取客户限制'),
              type: 'radio',
              options: [
                { label: t('无限制'), value: 0 },
                { label: t('新人专享'), value: 1 },
                { label: t('会员专享'), value: 2 },
              ],
            },
            {
              field: 'limitUserRank',
              label: t('会员等级'),
              type: 'custom',
              render: ({ formApi, values }) =>
                Number(values.isNewUser) === 2 ? (
                  <Select
                    placeholder={t('请选择')}
                    multiple
                    style={{ width: 300 }}
                    optionList={rankOptions}
                    value={(values.limitUserRank as number[]) || []}
                    onChange={(next) => formApi?.setValue('limitUserRank', (next as number[]) || [])}
                  />
                ) : null,
            },
            {
              field: 'sendRange',
              label: t('适用商品'),
              type: 'custom',
              render: ({ formApi, values }) => (
                <div className="coupon-form-content">
                  <RadioGroup
                    value={Number(values.sendRange ?? 0)}
                    onChange={(event) => formApi?.setValue('sendRange', Number(event.target.value))}
                  >
                    <Radio value={0}>{t('全部商品')}</Radio>
                    <Radio value={1}>{t('指定商品')}</Radio>
                  </RadioGroup>
                  {Number(values.sendRange) === 1 ? (
                    <ProductPicker
                      value={(values.sendRangeData as number[]) || []}
                      onChange={(ids) => formApi?.setValue('sendRangeData', ids)}
                      max={200}
                    />
                  ) : null}
                </div>
              ),
            },
            {
              field: 'isShow',
              label: t('是否公开展示'),
              type: 'radio',
              options: [
                { label: t('是'), value: 1 },
                { label: t('否'), value: 0 },
              ],
            },
            { field: 'couponDesc', label: t('券使用说明'), type: 'textarea' },
            {
              field: 'sendUserTarget',
              label: t('领取人群'),
              type: 'custom',
              render: ({ formApi, values }) => (
                <SendUserSelector
                  value={values.sendUserTarget}
                  onChange={(next) => formApi?.setValue('sendUserTarget', next)}
                />
              ),
            },
          ],
        },
      ],
};

  const saveCoupon = async (payload: Record<string, any>) => {
    setSaving(true);
    try {
      const body = {
        ...payload,
        couponType: Number(payload.couponType),
        isNewUser: Number(payload.isNewUser || 0),
        reduceType: Number(payload.reduceType),
        couponUnit: Number(payload.couponUnit || 1),
        minOrderAmount: Number(payload.minOrderAmount ?? 0),
        couponMoney: Number(payload.couponMoney ?? 0),
        couponDiscount: Number(payload.couponDiscount ?? 0),
        maxOrderAmount: Number(payload.maxOrderAmount ?? 0),
        sendType: Number(payload.sendType),
        sendNum: Number(payload.sendNum ?? 0),
        limitNum: Number(payload.isNewUser) === 1 ? 1 : Number(payload.limitNum ?? 0),
        isShow: Number(payload.isShow ?? 1),
        sendRange: Number(payload.sendRange ?? 0),
        sendRangeData: Number(payload.sendRange) === 1 ? payload.sendRangeData || [] : [],
        limitUserRank: Number(payload.isNewUser) === 2 ? payload.limitUserRank || [] : [],
        // 领取人群（对齐旧版 SendUserSelector → memberRange/memberMarks/sendUserTarget）
        sendUserTarget: payload.sendUserTarget || { scope: 0, userIds: [], users: [], rankIds: [], tagIds: [], tagMatchMode: 0 },
        memberRange: payload.sendUserTarget?.scope === 1 ? 1 : 0,
        memberMarks: payload.sendUserTarget?.scope === 1 ? payload.sendUserTarget?.tagIds || [] : [],
      };
      if (drawerMode === 'edit' && editingId) {
        await apiPost('/promotion/coupon/update', { ...body, couponId: editingId });
      } else {
        await apiPost('/promotion/coupon/create', body);
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

  const updateField = async (row: CouponRow, field: string, value: unknown) => {
    try {
      await apiPost('/promotion/coupon/updateField', { id: row.couponId, field, value });
      Toast.success({ content: t('修改成功') });
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('修改失败') });
    }
  };

  const deleteCoupon = (row: CouponRow) => {
    Modal.confirm({
      title: t('确认删除该优惠券吗？'),
      onOk: async () => {
        try {
          await apiPost('/promotion/coupon/del', { id: row.couponId });
          Toast.success({ content: t('删除成功') });
          reload();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
        }
      },
    });
  };

  const openIssue = (row: CouponRow) => {
    setIssueType('USER');
    setIssueUserIds([]);
    setIssueRankIds([]);
    setIssueUserKeyword('');
    setIssueUsers([]);
    setIssueTarget(row);
  };

  const searchIssueUsers = (keyword = '') => {
    apiGet<{ records?: CouponUser[] }>('/user/user/list', { page: 1, size: 20, keyword })
      .then((result) => setIssueUsers(result.records || []))
      .catch(() => undefined);
  };

  const submitIssue = async () => {
    if (!issueTarget) return;
    const payload: Record<string, any> = { couponId: issueTarget.couponId, issueType };
    if (issueType === 'USER') {
      if (!issueUserIds.length) {
        Toast.warning({ content: t('请选择发放会员') });
        return;
      }
      payload.userIds = issueUserIds;
    } else {
      if (!issueRankIds.length) {
        Toast.warning({ content: t('请选择会员等级') });
        return;
      }
      payload.rankIds = issueRankIds;
    }
    setIssueSubmitting(true);
    try {
      const preview = await apiPost<any>('/promotion/coupon/issue/preview', payload);
      Modal.confirm({
        title: t('确认发放'),
        content: preview?.failCount
          ? t('优惠券发放总量总计：{count} 张，预计失败 {fail} 张。请确认是否发放？', { count: preview?.couponCount ?? '?', fail: preview.failCount })
          : t('优惠券发放总量总计：{count} 张。请确认是否发放？', { count: preview?.couponCount ?? '?' }),
        onOk: async () => {
          try {
            const result = await apiPost<any>('/promotion/coupon/issue/send', payload);
            if (result?.failCount > 0) {
              Toast.warning({
                content: t('优惠券发放完成，成功 {success} 张，失败 {fail} 张', { success: result.successCount, fail: result.failCount }),
              });
            } else {
              Toast.success({ content: t('发放成功') });
            }
            setIssueTarget(null);
            reload();
          } catch (error) {
            Toast.error({ content: error instanceof Error ? error.message : t('发放失败') });
          }
        },
      });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('预览失败') });
    } finally {
      setIssueSubmitting(false);
    }
  };

  const openLog = (row: CouponRow) => {
    setLogTarget(row);
    setLogLoading(true);
    apiGet<any>('/promotion/coupon/issue/log', { couponId: row.couponId, page: 1, size: 50 })
      .then((result) => setLogRows(result?.records || result?.list || []))
      .catch(() => setLogRows([]))
      .finally(() => setLogLoading(false));
  };

  const columns: ColumnConfig<CouponRow>[] = [
    {
      title: '优惠券名称',
      dataIndex: 'couponName',
      width: 200,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      title: '发放类型',
      dataIndex: 'couponType',
      width: 140,
      render: (_: unknown, row: CouponRow) => (
        <span>
          {Number(row.couponType) === 1 ? t('满减券') : t('折扣券')}
          {Number(row.isNewUser) === 1 ? <span className="coupon-tag-green">{t('（新人专享）')}</span> : null}
          {(row.limitUserRank || []).length ? <span className="coupon-tag-green">{t('（会员专享）')}</span> : null}
        </span>
      ),
    },
    {
      title: '优惠券金额(折扣)',
      dataIndex: 'couponMoney',
      width: 150,
      render: (_: unknown, row: CouponRow) =>
        Number(row.couponType) === 1 ? (
          <span title={t('优惠券金额')}>{row.couponMoney || 0}</span>
        ) : (
          <span title={t('优惠券折扣')}>{row.couponDiscount || 0}{t('折')}</span>
        ),
    },
    {
      title: '优惠门槛',
      dataIndex: 'minOrderAmount',
      width: 130,
      render: (_: unknown, row: CouponRow) =>
        Number(row.reduceType) === 1 ? (
          <span>
            {row.minOrderAmount || 0}
            {Number(row.couponUnit) === 1 ? t('元') : t('件')}
          </span>
        ) : (
          <span>{t('无门槛券')}</span>
        ),
    },
    {
      title: '是否公开展示',
      dataIndex: 'isShow',
      width: 120,
      render: (value: number, row: CouponRow) => (
        <Switch
          checked={Number(value) === 1}
          onChange={(next) => updateField(row, 'isShow', next ? 1 : 0)}
        />
      ),
    },
    {
      title: '活动时间',
      dataIndex: 'time',
      width: 240,
      render: (_: unknown, row: CouponRow) =>
        Number(row.sendType) === 0 ? (
          <span>
            {(row.delayDay ?? 0) === 0
              ? t('领券后立即生效，有效期{day}天', { day: row.useDay ?? 0 })
              : t('领券后{delay}天生效，有效期{day}天', { delay: row.delayDay ?? 0, day: row.useDay ?? 0 })}
          </span>
        ) : (
          <span>
            {row.useStartDate} - {row.useEndDate}
          </span>
        ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: number) => {
        const text = t(couponStatusText(value));
        const color = value === 2 ? 'orange' : value === 3 ? 'grey' : 'green';
        return <Tag color={color as never}>{text}</Tag>;
      },
    },
  ];

  return (
    <div className="coupons-page">
      <Card>
        <Text strong>{t('按使用场景快速创建')}</Text>
        <div className="coupon-quick-cards">
          {QUICK_CARDS.map((card) => (
            <div className="coupon-quick-card" key={card.title}>
              <div>
                <div className="coupon-quick-title">{t(card.title)}</div>
                <div className="coupon-quick-desc">{t(card.desc)}</div>
              </div>
              <Button type="primary" onClick={() => openCreate(card.preset)}>
                {t('立即新建')}
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <ListPage<CouponRow>
        key={reloadKey}
        api="/promotion/coupon/list"
        rowKey="couponId"
        pageSize={10}
        selectable
        actionWidth={230}
        filters={[
          { field: 'keyword', label: '优惠券名称', type: 'input', placeholder: '输入优惠券名称', width: 240 },
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
                    await apiPost('/promotion/coupon/batch', { ids: rows.map((row) => row.couponId), type: 'del' });
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
            {!isCouponExpired(row) ? (
              <Button theme="borderless" size="small" onClick={() => openIssue(row)}>
                {t('发放')}
              </Button>
            ) : null}
            <Button theme="borderless" size="small" onClick={() => openLog(row)}>
              {t('发放记录')}
            </Button>
            <Button theme="borderless" type="danger" size="small" onClick={() => deleteCoupon(row)}>
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
        onSubmit={saveCoupon}
      />

      <Modal
        title={issueTarget ? `${t('优惠券发放')}：${issueTarget.couponName || ''}` : t('优惠券发放')}
        visible={Boolean(issueTarget)}
        confirmLoading={issueSubmitting}
        onOk={submitIssue}
        onCancel={() => setIssueTarget(null)}
        width={620}
      >
        <div className="coupon-issue-form">
          <label>{t('发放对象')}</label>
          <RadioGroup
            value={issueType}
            onChange={(event) => setIssueType(event.target.value as 'USER' | 'RANK')}
          >
            <Radio value="USER">{t('指定会员')}</Radio>
            <Radio value="RANK">{t('会员等级')}</Radio>
          </RadioGroup>
          {issueType === 'USER' ? (
            <>
              <Space>
                <Input
                  placeholder={t('会员名称/手机号')}
                  value={issueUserKeyword}
                  onChange={setIssueUserKeyword}
                  onEnterPress={() => searchIssueUsers(issueUserKeyword)}
                  style={{ width: 240 }}
                />
                <Button onClick={() => searchIssueUsers(issueUserKeyword)}>{t('搜索')}</Button>
              </Space>
              <div className="coupon-issue-users">
                {issueUsers.map((user) => (
                  <label key={user.userId} className="coupon-issue-user">
                    <Checkbox
                      checked={issueUserIds.includes(user.userId)}
                      onChange={(event) =>
                        setIssueUserIds((current) =>
                          event.target.checked
                            ? [...current, user.userId]
                            : current.filter((id) => id !== user.userId),
                        )
                      }
                    />
                    <Avatar size="small">
                      {(user.nickname || user.username || '?').slice(0, 1)}
                    </Avatar>
                    <span>{user.nickname || user.username || '-'}</span>
                    <Text type="tertiary" size="small">
                      {user.mobile || ''}
                    </Text>
                  </label>
                ))}
                {!issueUsers.length ? <Text type="tertiary">{t('输入关键词搜索会员')}</Text> : null}
              </div>
              <Text type="tertiary" size="small">
                {t('已选 {count} 位会员', { count: issueUserIds.length })}
              </Text>
            </>
          ) : (
            <Select
              placeholder={t('请选择会员等级')}
              multiple
              optionList={rankOptions}
              value={issueRankIds}
              onChange={(next) => setIssueRankIds((next as number[]) || [])}
              style={{ width: 320 }}
            />
          )}
        </div>
      </Modal>

      <Modal
        title={logTarget ? `${t('发放记录')}：${logTarget.couponName || ''}` : t('发放记录')}
        visible={Boolean(logTarget)}
        footer={null}
        onCancel={() => setLogTarget(null)}
        width={640}
      >
        <Spin spinning={logLoading}>
          <Table
            size="small"
            pagination={false}
            rowKey={(record: any) => String(record.logId ?? record.id ?? record.userId)}
            dataSource={logRows}
            columns={[
              { title: t('会员'), dataIndex: 'nickname', render: (v: any, r: any) => v || r.username || r.userId },
              { title: t('手机号'), dataIndex: 'mobile' },
              { title: t('发放时间'), dataIndex: 'createTime', render: (v: any, r: any) => v || r.sendTime || '-' },
              { title: t('状态'), dataIndex: 'statusText', render: (v: any, r: any) => v || r.status || '-' },
            ]}
          />
          {!logRows.length && !logLoading ? <Text type="tertiary">{t('暂无发放记录')}</Text> : null}
        </Spin>
      </Modal>
    </div>
  );
}
