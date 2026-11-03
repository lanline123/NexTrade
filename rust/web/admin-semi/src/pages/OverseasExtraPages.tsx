/**
 * 跨境版（java-b2b2c-overseas v5.8.61）对齐新增页面集合。
 *
 * 1. ShopTipManage             标签管理        shop/tip/*（list / tipConfig / create|update / del / batch / updateField）
 * 2. ShopGroupManage           店铺分组        merchant/shopGroup/*（list / detail / shopList / create|update / del）
 * 3. OfflinePaymentClaimManage 线下收款审核    order/offlinePaymentClaim/*（list / detail / audit）
 * 4. ImageSearchManage         图像搜索        setting/imageSearch/*（regions / detail / save / check / build / task / retry）
 * 5. VendorAccountManage       资金概览        vendor/adminVendorAccount/index + listFund + order/order/list
 * 6. VendorFundsManage         供应商资金      vendor/adminVendorAccount/listFund
 * 7. VendorFinancialLogManage  资金日志        vendor/adminVendorAccount/logList
 *
 * 说明：Rust 后端暂未提供以上接口，页面按原版契约编写，运行时接口报错属预期。
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Image,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Radio,
  RadioGroup,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
  TextArea,
  Toast,
  Tooltip,
  Typography,
} from '@douyinfe/semi-ui';
import { IconPlus, IconSearch } from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import FormDrawer from '../framework/FormDrawer';
import type { ColumnConfig, FormDrawerConfig, OptionItem } from '../framework/types';

const { Text } = Typography;

type Translate = (key: string, params?: Record<string, string | number>) => string;

/* ============================== 通用工具 ============================== */

const money = (value: unknown) => `¥${Number(value || 0).toFixed(2)}`;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 秒/毫秒级时间戳转 yyyy-MM-dd HH:mm:ss（原版 utils/time.formatTimestamp 以秒处理）。 */
const formatTimestamp = (value: unknown) => {
  const num = Number(value);
  if (!value || !Number.isFinite(num) || num <= 0) return '--';
  const date = new Date(num < 1e12 ? num * 1000 : num);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
};

/** 转账/申请时间：可能是时间戳，也可能已是字符串，按需格式化。 */
const formatTimeValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '--';
  if (typeof value === 'number' || /^\d+$/.test(String(value))) return formatTimestamp(value);
  return String(value);
};

const todayText = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

const toastError = (error: unknown, fallback: string) => {
  Toast.error({ content: error instanceof Error ? error.message : fallback });
};

const formatDate = (date?: Date) => (date ? date.toISOString().split('T')[0] : '');

/** 供应商状态（1 在供 / 2 断供）。 */
const renderVendorStatus = (value: unknown, t: Translate) => {
  const status = Number(value);
  if (status === 1) return <Tag color="green">{t('在供')}</Tag>;
  if (status === 2) return <Tag color="red">{t('断供')}</Tag>;
  return <span>--</span>;
};

const SectionTitle = ({ children, extra }: { children: ReactNode; extra?: ReactNode }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderLeft: '3px solid var(--semi-color-primary)',
      paddingLeft: 10,
      fontSize: 14,
      fontWeight: 500,
      margin: '20px 0 12px',
    }}
  >
    <span>{children}</span>
    {extra}
  </div>
);

/* ============================== 1. 标签管理 ============================== */

interface TipRow {
  tipId: number;
  tipName?: string;
  status?: number;
  addTime?: string;
  createTime?: string;
}

/**
 * 标签管理：对应原版 views/shop/shopTipManage/List.vue + Info.vue。
 * - 列表 GET shop/tip/list（page/size/keyword/status）
 * - 状态筛选项 GET shop/tip/tipConfig（[{status, description}]）
 * - 新增 POST shop/tip/create、编辑 POST shop/tip/update（operation 拼接，body {id, tipName, status}）
 * - 详情 GET shop/tip/detail?id=、删除 POST shop/tip/del {id}、批量 POST shop/tip/batch {type, ids}
 * - 状态开关 POST shop/tip/updateField {id, field: 'status', val}
 */
export function ShopTipManage() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [statusOptions, setStatusOptions] = useState<OptionItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [drawerInitial, setDrawerInitial] = useState<Record<string, any>>({});
  const [editingTipId, setEditingTipId] = useState(0);
  const [saving, setSaving] = useState(false);

  const reload = () => setReloadKey((key) => key + 1);

  useEffect(() => {
    apiGet<any>('/shop/tip/tipConfig')
      .then((result) => {
        const list = Array.isArray(result) ? result : [];
        setStatusOptions(
          list.map((item: any) => ({
            label: String(item.description ?? item.status ?? ''),
            value: Number(item.status),
          })),
        );
      })
      .catch(() => setStatusOptions([]));
  }, []);

  const openCreate = () => {
    setDrawerMode('create');
    setEditingTipId(0);
    setDrawerInitial({ tipName: '', status: 1 });
    setDrawerOpen(true);
  };

  const openEdit = async (row: TipRow) => {
    setDrawerMode('edit');
    setEditingTipId(Number(row.tipId));
    setDrawerInitial({ tipId: row.tipId, tipName: row.tipName || '', status: Number(row.status ?? 1) });
    setDrawerOpen(true);
    try {
      const detail = await apiGet<any>('/shop/tip/detail', { id: row.tipId });
      if (detail) {
        setDrawerInitial((prev) => ({
          ...prev,
          tipName: detail.tipName ?? prev.tipName,
          status: Number(detail.status ?? prev.status ?? 1),
        }));
      }
    } catch {
      // 详情接口失败时保留行数据继续编辑
    }
  };

  const submit = async (payload: Record<string, any>) => {
    setSaving(true);
    try {
      await apiPost(
        drawerMode === 'create' ? '/shop/tip/create' : '/shop/tip/update',
        {
          id: drawerMode === 'create' ? 0 : Number(editingTipId),
          tipName: String(payload.tipName || '').trim(),
          status: Number(payload.status ?? 1),
        },
      );
      Toast.success({ content: t('操作成功') });
      setDrawerOpen(false);
      reload();
    } catch (error) {
      toastError(error, t('保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (row: TipRow, next: number) => {
    try {
      await apiPost('/shop/tip/updateField', { id: row.tipId, field: 'status', val: next });
      Toast.success({ content: t('操作成功') });
      reload();
    } catch (error) {
      toastError(error, t('更新状态失败'));
    }
  };

  const deleteTip = async (row: TipRow) => {
    try {
      await apiPost('/shop/tip/del', { id: row.tipId });
      Toast.success({ content: t('删除成功') });
      reload();
    } catch (error) {
      toastError(error, t('删除失败'));
    }
  };

  const batchDelete = async (rows: TipRow[], clear: () => void) => {
    try {
      await apiPost('/shop/tip/batch', { type: 'del', ids: rows.map((row) => row.tipId) });
      Toast.success({ content: t('操作成功') });
      clear();
      reload();
    } catch (error) {
      toastError(error, t('批量删除失败'));
    }
  };

  const drawerConfig: FormDrawerConfig = {
    title: '标签',
    width: 600,
    labelWidth: 110,
    createApi: '/shop/tip/create',
    updateApi: '/shop/tip/update',
    sections: [
      {
        key: 'base',
        title: '基本信息',
        fields: [
          {
            field: 'tipName',
            label: t('标签名称'),
            type: 'input',
            required: true,
            placeholder: t('输入标签名称（最多 8 字）'),
            width: 320,
          },
          {
            field: 'status',
            label: t('状态'),
            type: 'radio',
            required: true,
            initValue: 1,
            options: [
              { label: t('启用'), value: 1 },
              { label: t('禁用'), value: 0 },
            ],
          },
        ],
      },
    ],
  };

  const columns: ColumnConfig<TipRow>[] = [
    {
      title: '序号',
      dataIndex: 'tipId',
      width: 80,
      render: (_value: unknown, _row: TipRow, index: number) => <span>{index + 1}</span>,
    },
    {
      title: '标签名称',
      dataIndex: 'tipName',
      width: 220,
      render: (value: string) => <span>{value || '--'}</span>,
    },
    {
      title: '创建时间',
      dataIndex: 'addTime',
      width: 180,
      render: (value: string, row: TipRow) => <span>{value || row.createTime || '--'}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (value: number, row: TipRow) => (
        <Switch
          checked={Number(value) === 1}
          onChange={(next: boolean) => toggleStatus(row, next ? 1 : 0)}
        />
      ),
    },
  ];

  return (
    <div>
      <ListPage<TipRow>
        key={reloadKey}
        api="/shop/tip/list"
        rowKey="tipId"
        pageSize={10}
        actionWidth={140}
        selectable
        filters={[
          { field: 'keyword', label: '标签名称', type: 'input', placeholder: '输入标签名称', width: 220 },
          {
            field: 'status',
            label: t('状态'),
            type: 'select',
            options: statusOptions,
            placeholder: '状态',
            width: 160,
          },
        ]}
        columns={columns}
        rowActions={(row) => (
          <>
            <Button theme="borderless" size="small" onClick={() => openEdit(row)}>
              {t('编辑')}
            </Button>
            <Popconfirm title={t('确定删除该标签吗？')} onConfirm={() => deleteTip(row)}>
              <Button theme="borderless" type="danger" size="small">
                {t('删除')}
              </Button>
            </Popconfirm>
          </>
        )}
        batchActions={(rows, clear) => (
          <Popconfirm title={t('您确认要批量删除所选标签吗？')} onConfirm={() => batchDelete(rows, clear)}>
            <Button type="danger">{t('批量删除')}</Button>
          </Popconfirm>
        )}
        toolbarExtra={
          <Button theme="solid" type="primary" icon={<IconPlus />} onClick={openCreate}>
            {t('新增标签')}
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
        onSubmit={submit}
      />
    </div>
  );
}

/* ============================== 2. 店铺分组 ============================== */

interface GroupRow {
  groupId: number;
  groupName?: string;
  shopCount?: number;
  remark?: string;
  createTime?: number | string;
}

interface ShopLite {
  shopId: number;
  shopTitle?: string;
}

type GroupModalMode = 'create' | 'edit' | 'detail';

/**
 * 店铺分组编辑弹窗：对应原版 views/shop/shopGroup/Info.vue（800px）。
 * - 详情 GET merchant/shopGroup/detail（groupId + shopType=1）
 * - 成员 GET merchant/shopGroup/shopList（用于回显成员名称）
 * - 店铺选择器 GET merchant/shop/list（status=1&shopType=1&includeSelfOperated=1）
 * - 保存 POST merchant/shopGroup/create | update（body {groupId?, shopType, groupName, remark, shopIds}）
 */
function ShopGroupFormModal({
  visible,
  mode,
  groupId,
  onCancel,
  onSaved,
}: {
  visible: boolean;
  mode: GroupModalMode;
  groupId?: number;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const readonly = mode === 'detail';
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [remark, setRemark] = useState('');
  const [picked, setPicked] = useState<ShopLite[]>([]);

  // 店铺选择器（新建/编辑时）
  const [pickKeyword, setPickKeyword] = useState('');
  const [pickApplied, setPickApplied] = useState('');
  const [pickPage, setPickPage] = useState(1);
  const [pickRows, setPickRows] = useState<ShopLite[]>([]);
  const [pickTotal, setPickTotal] = useState(0);
  const [pickLoading, setPickLoading] = useState(false);

  const loadDetail = async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const detail = await apiGet<any>('/merchant/shopGroup/detail', { groupId, shopType: 1 });
      setGroupName(detail?.groupName || '');
      setRemark(detail?.remark || '');
      const ids: number[] = Array.isArray(detail?.shopIds) ? detail.shopIds.map(Number) : [];
      const members = new Map<number, ShopLite>();
      // 成员名称按 100/页逐页补齐（与原版 useGroupForm 一致，最多 5 页防御性截断）
      for (let current = 1; current <= 5 && ids.length > 0 && members.size < ids.length; current++) {
        const page = await apiGet<any>('/merchant/shopGroup/shopList', {
          groupId,
          shopType: 1,
          page: current,
          size: 100,
        });
        const records: any[] = page?.records || [];
        records.forEach((row) =>
          members.set(Number(row.shopId), { shopId: Number(row.shopId), shopTitle: row.shopTitle }),
        );
        if (!records.length) break;
      }
      setPicked(ids.map((id) => members.get(id) || { shopId: id, shopTitle: t('店铺#{id}', { id }) }));
    } catch (error) {
      toastError(error, t('加载分组详情失败'));
    } finally {
      setLoading(false);
    }
  };

  const loadPick = async () => {
    setPickLoading(true);
    try {
      const result = await apiGet<any>('/merchant/shop/list', {
        keyword: pickApplied || undefined,
        page: pickPage,
        size: 15,
        status: 1,
        shopType: 1,
        includeSelfOperated: 1,
      });
      const records: any[] = result?.records || [];
      setPickRows(records.map((row) => ({ shopId: Number(row.shopId), shopTitle: row.shopTitle })));
      setPickTotal(Number(result?.total || 0));
    } catch (error) {
      toastError(error, t('加载店铺列表失败'));
    } finally {
      setPickLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    setPickKeyword('');
    setPickApplied('');
    setPickPage(1);
    if (mode === 'create') {
      setGroupName('');
      setRemark('');
      setPicked([]);
    } else {
      void loadDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mode, groupId]);

  useEffect(() => {
    if (!visible || readonly) return;
    void loadPick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, pickPage, pickApplied, readonly]);

  const pickedIds = useMemo(() => new Set(picked.map((item) => item.shopId)), [picked]);

  const togglePick = (row: ShopLite, checked: boolean) => {
    setPicked((prev) => {
      const next = prev.filter((item) => item.shopId !== row.shopId);
      if (checked) next.push({ shopId: row.shopId, shopTitle: row.shopTitle });
      return next;
    });
  };

  const save = async () => {
    if (!groupName.trim()) {
      Toast.error({ content: t('请输入分组名称') });
      return;
    }
    if (Array.from(groupName.trim()).length > 20) {
      Toast.error({ content: t('分组名称最多20个字符') });
      return;
    }
    if (!picked.length) {
      Toast.error({ content: t('请选择店铺') });
      return;
    }
    setSaving(true);
    try {
      await apiPost(
        mode === 'create' ? '/merchant/shopGroup/create' : '/merchant/shopGroup/update',
        {
          ...(mode === 'edit' && groupId ? { groupId } : {}),
          shopType: 1,
          groupName: groupName.trim(),
          remark,
          shopIds: picked.map((item) => Number(item.shopId)),
        },
      );
      Toast.success({ content: t('操作成功') });
      onSaved();
    } catch (error) {
      toastError(error, t('保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const pickerColumns: ColumnConfig<ShopLite>[] = [
    {
      title: '',
      dataIndex: 'pick',
      width: 50,
      render: (_value: unknown, row: ShopLite) => (
        <Checkbox
          checked={pickedIds.has(row.shopId)}
          disabled={readonly}
          onChange={(event) => togglePick(row, Boolean((event.target as HTMLInputElement).checked))}
        />
      ),
    },
    { title: t('店铺ID'), dataIndex: 'shopId', width: 110 },
    {
      title: t('店铺名称'),
      dataIndex: 'shopTitle',
      render: (value: string) => <span>{value || '--'}</span>,
    },
  ];

  return (
    <Modal
      title={mode === 'create' ? t('新增店铺分组') : mode === 'edit' ? t('编辑分组') : t('分组详情')}
      visible={visible}
      width={800}
      onCancel={onCancel}
      footer={
        readonly ? (
          <Button onClick={onCancel}>{t('关闭')}</Button>
        ) : (
          <Space>
            <Button onClick={onCancel}>{t('取消')}</Button>
            <Button theme="solid" type="primary" loading={saving} onClick={save}>
              {t('保存')}
            </Button>
          </Space>
        )
      }
    >
      <Spin spinning={loading}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex' }}>
            <span style={{ width: 90, textAlign: 'right', paddingRight: 12, paddingTop: 6, flexShrink: 0 }}>
              <span style={{ color: 'var(--semi-color-danger)' }}>{readonly ? '' : '* '}</span>{t('分组名称')}
            </span>
            <Input
              style={{ width: 360 }}
              value={groupName}
              disabled={readonly}
              placeholder={t('请输入分组名称')}
              onChange={(value) => setGroupName(value)}
            />
          </div>
          <div style={{ display: 'flex' }}>
            <span style={{ width: 90, textAlign: 'right', paddingRight: 12, paddingTop: 6, flexShrink: 0 }}>{t('备注')}</span>
            <TextArea
              style={{ width: 560 }}
              rows={4}
              value={remark}
              disabled={readonly}
              placeholder={t('请输入分组备注')}
              onChange={(value) => setRemark(value)}
            />
          </div>
          <div style={{ display: 'flex' }}>
            <span style={{ width: 90, textAlign: 'right', paddingRight: 12, paddingTop: 6, flexShrink: 0 }}>
              <span style={{ color: 'var(--semi-color-danger)' }}>{readonly ? '' : '* '}</span>{t('分组店铺')}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {!readonly && (
                <Space style={{ marginBottom: 10 }}>
                  <Input
                    prefix={<IconSearch />}
                    style={{ width: 220 }}
                    placeholder={t('请输入店铺名称')}
                    value={pickKeyword}
                    showClear
                    onChange={(value) => setPickKeyword(value)}
                    onEnterPress={() => {
                      setPickPage(1);
                      setPickApplied(pickKeyword);
                    }}
                  />
                  <Button
                    onClick={() => {
                      setPickPage(1);
                      setPickApplied(pickKeyword);
                    }}
                  >
                    {t('搜索')}
                  </Button>
                  <Button disabled={!picked.length} onClick={() => setPicked([])}>
                    {t('清空')}
                  </Button>
                </Space>
              )}
              <div style={{ marginBottom: 8 }}>
                {t('已选择')} <b>{picked.length}</b> {t('家店铺')}
              </div>
              <Table<ShopLite>
                size="small"
                loading={pickLoading}
                dataSource={readonly ? picked : pickRows}
                rowKey="shopId"
                pagination={
                  readonly
                    ? false
                    : {
                        currentPage: pickPage,
                        pageSize: 15,
                        total: pickTotal,
                        onChange: (next: number) => setPickPage(next),
                      }
                }
                columns={pickerColumns as any}
              />
            </div>
          </div>
        </div>
      </Spin>
    </Modal>
  );
}

/**
 * 店铺分组：对应原版 views/shop/shopGroup/List.vue（shopType=1，接口前缀 merchant/shopGroup）。
 */
export function ShopGroupManage() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<GroupModalMode>('create');
  const [currentGroupId, setCurrentGroupId] = useState<number | undefined>(undefined);

  const reload = () => setReloadKey((key) => key + 1);

  const openModal = (mode: GroupModalMode, row?: GroupRow) => {
    setModalMode(mode);
    setCurrentGroupId(row ? Number(row.groupId) : undefined);
    setModalOpen(true);
  };

  const removeGroup = (row: GroupRow) => {
    Modal.confirm({
      title: t('确认删除该分组？'),
      content: t('删除后仅解除分组关联，不会删除店铺或门店。'),
      onOk: async () => {
        try {
          await apiPost('/merchant/shopGroup/del', { groupId: row.groupId, shopType: 1 });
          Toast.success({ content: t('删除成功') });
          reload();
        } catch (error) {
          toastError(error, t('删除失败'));
        }
      },
    });
  };

  const columns: ColumnConfig<GroupRow>[] = [
    { title: '分组ID', dataIndex: 'groupId', width: 100 },
    {
      title: '分组名称',
      dataIndex: 'groupName',
      width: 180,
      render: (value: string) => <span>{value || '--'}</span>,
    },
    {
      title: '店铺数量',
      dataIndex: 'shopCount',
      width: 110,
      render: (value: number) => <span>{value ?? 0}</span>,
    },
    {
      title: '备注',
      dataIndex: 'remark',
      width: 240,
      render: (value: string) => <span>{value || '--'}</span>,
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      width: 180,
      render: (value: number | string) => <span>{formatTimestamp(value)}</span>,
    },
  ];

  return (
    <div>
      <ListPage<GroupRow>
        key={reloadKey}
        api="/merchant/shopGroup/list"
        query={{ shopType: 1 }}
        rowKey="groupId"
        pageSize={15}
        actionWidth={190}
        filters={[
          { field: 'keyword', label: '分组名称', type: 'input', placeholder: '请输入分组名称', width: 220 },
        ]}
        columns={columns}
        rowActions={(row) => (
          <>
            <Button theme="borderless" size="small" onClick={() => openModal('edit', row)}>
              {t('编辑')}
            </Button>
            <Button theme="borderless" size="small" onClick={() => openModal('detail', row)}>
              {t('详情')}
            </Button>
            <Button theme="borderless" type="danger" size="small" onClick={() => removeGroup(row)}>
              {t('删除')}
            </Button>
          </>
        )}
        toolbarExtra={
          <Button theme="solid" type="primary" icon={<IconPlus />} onClick={() => openModal('create')}>
            {t('新增分组')}
          </Button>
        }
      />

      <ShopGroupFormModal
        visible={modalOpen}
        mode={modalMode}
        groupId={currentGroupId}
        onCancel={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false);
          reload();
        }}
      />
    </div>
  );
}

/* ============================== 3. 线下收款审核 ============================== */

interface ClaimInfo {
  claimId?: number;
  orderId?: number;
  orderSn?: string;
  claimedAmount?: number | string;
  transferTime?: string | number;
  payerName?: string;
  payerAccount?: string;
  bankSerialNo?: string;
  voucherUrls?: string[];
  status?: number;
  statusName?: string;
  auditRemark?: string | null;
  rejectReason?: string | null;
  reviewTime?: string | number;
  addTime?: string | number;
}

interface ClaimOrderRow {
  orderId?: number;
  orderSn?: string;
  totalAmount?: number | string;
  username?: string;
  user?: { username?: string };
  addTime?: string;
  offlinePaymentClaimStatus?: number | null;
  offlinePaymentClaimStatusName?: string;
  offlinePaymentClaim?: ClaimInfo[] | ClaimInfo | null;
  offlinePaymentClaimId?: number;
}

const CLAIM_STATUS_OPTIONS: OptionItem[] = [
  { value: 0, label: '待审核' },
  { value: 1, label: '审核通过' },
  { value: 2, label: '审核驳回' },
];

/** 订单上可能挂多笔认款申报，取 claimId 最大的一笔（与原版 latestOfflineClaim 一致）。 */
const latestClaim = (row: ClaimOrderRow): ClaimInfo | null => {
  const value: any = row?.offlinePaymentClaim ?? (row as any)?.paymentClaim;
  if (Array.isArray(value)) {
    return (
      value
        .filter((item) => item && Number(item.claimId || 0) > 0)
        .sort((a, b) => Number(b.claimId) - Number(a.claimId))[0] || null
    );
  }
  return value || null;
};

const claimIdOf = (row: ClaimOrderRow) =>
  Number(latestClaim(row)?.claimId || (row as any)?.offlinePaymentClaimId || 0);

const renderClaimStatus = (row: ClaimOrderRow, t: Translate) => {
  const status = Number(row.offlinePaymentClaimStatus);
  const label = row.offlinePaymentClaimStatusName || CLAIM_STATUS_OPTIONS.find((item) => item.value === status)?.label;
  if (status === 0) return <Tag color="orange">{t(label || '待审核')}</Tag>;
  if (status === 1) return <Tag color="green">{t(label || '审核通过')}</Tag>;
  if (status === 2) return <Tag color="red">{t(label || '审核驳回')}</Tag>;
  return <span>--</span>;
};

/**
 * 审核弹窗：对应原版 views/order/order/src/OfflinePaymentAudit.vue（去掉入账轮询，审核成功后由上层刷新）。
 * - 详情 GET order/offlinePaymentClaim/detail（claimId）
 * - 提交 POST order/offlinePaymentClaim/audit（{claimId, pass, rejectReason?, auditRemark?}）
 */
function OfflineClaimAuditModal({
  claimId,
  readonly,
  onClose,
  onSaved,
}: {
  claimId: number;
  readonly: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [claim, setClaim] = useState<ClaimInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<1 | 2>(1);
  const [rejectReason, setRejectReason] = useState('');
  const [auditRemark, setAuditRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiGet<any>('/order/offlinePaymentClaim/detail', { claimId })
      .then((data) => {
        if (alive) setClaim(data || null);
      })
      .catch((error) => toastError(error, t('获取认款信息失败')))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [claimId]);

  const submit = async () => {
    const pass = result === 1;
    if (!pass && !rejectReason.trim()) {
      Toast.error({ content: t('请填写驳回原因') });
      return;
    }
    setSubmitting(true);
    try {
      await apiPost('/order/offlinePaymentClaim/audit', {
        claimId,
        pass,
        ...(pass
          ? { auditRemark: auditRemark.trim() || undefined }
          : { rejectReason: rejectReason.trim() }),
      });
      Toast.success({ content: pass ? t('审核通过') : t('已驳回') });
      onSaved();
    } catch (error) {
      toastError(error, t('操作失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const infoRows: Array<{ label: string; value: ReactNode }> = claim
    ? [
        { label: t('订单号'), value: claim.orderSn || '--' },
        { label: t('认款状态'), value: claim.statusName || t('待确认收款') },
        { label: t('付款金额'), value: money(claim.claimedAmount) },
        { label: t('转账时间'), value: formatTimeValue(claim.transferTime) },
        {
          label: t('付款人姓名/账号'),
          value: `${claim.payerName || '--'}${claim.payerAccount ? ` / ${claim.payerAccount}` : ''}`,
        },
        { label: t('转账流水号'), value: claim.bankSerialNo || '--' },
        {
          label: t('付款凭证'),
          value: (claim.voucherUrls || []).length ? (
            <Space spacing={8} wrap>
              {(claim.voucherUrls || []).map((url) => (
                <Image
                  key={url}
                  src={url}
                  width={72}
                  height={72}
                  style={{ objectFit: 'cover', borderRadius: 4 }}
                />
              ))}
            </Space>
          ) : (
            '--'
          ),
        },
        ...(claim.rejectReason
          ? [{ label: t('驳回原因'), value: <span style={{ color: 'var(--semi-color-danger)' }}>{claim.rejectReason}</span> }]
          : []),
      ]
    : [];

  return (
    <Modal
      title={readonly ? t('付款申报详情') : t('审核线下收款')}
      visible
      width={620}
      onCancel={onClose}
      footer={
        readonly ? (
          <Button onClick={onClose}>{t('关闭')}</Button>
        ) : (
          <Space>
            <Button onClick={onClose}>{t('取消')}</Button>
            <Button theme="solid" type="primary" loading={submitting} onClick={submit}>
              {t('提交')}
            </Button>
          </Space>
        )
      }
    >
      <Spin spinning={loading}>
        {claim ? (
          <div
            style={{
              background: 'var(--semi-color-fill-0)',
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {infoRows.map((row) => (
              <div key={row.label} style={{ display: 'flex' }}>
                <span style={{ width: 130, flexShrink: 0, color: 'var(--semi-color-text-2)' }}>{row.label}：</span>
                <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-all' }}>{row.value}</span>
              </div>
            ))}
          </div>
        ) : (
          !loading && <Text type="tertiary">{t('未获取到认款信息')}</Text>
        )}

        {!readonly && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex' }}>
              <span style={{ width: 90, textAlign: 'right', paddingRight: 12, paddingTop: 6, flexShrink: 0 }}>
                <span style={{ color: 'var(--semi-color-danger)' }}>* </span>{t('审核结果')}
              </span>
              <RadioGroup
                value={result}
                onChange={(event: any) => setResult(Number(event.target.value) === 2 ? 2 : 1)}
              >
                <Radio value={1}>{t('通过')}</Radio>
                <Radio value={2}>{t('驳回')}</Radio>
              </RadioGroup>
            </div>
            {result === 1 ? (
              <div style={{ display: 'flex' }}>
                <span style={{ width: 90, textAlign: 'right', paddingRight: 12, paddingTop: 6, flexShrink: 0 }}>{t('备注')}</span>
                <TextArea
                  rows={4}
                  maxCount={200}
                  placeholder={t('请输入备注（选填）')}
                  value={auditRemark}
                  onChange={(value) => setAuditRemark(value)}
                />
              </div>
            ) : (
              <div style={{ display: 'flex' }}>
                <span style={{ width: 90, textAlign: 'right', paddingRight: 12, paddingTop: 6, flexShrink: 0 }}>
                  <span style={{ color: 'var(--semi-color-danger)' }}>* </span>{t('驳回原因')}
                </span>
                <TextArea
                  rows={4}
                  maxCount={200}
                  placeholder={t('请输入驳回原因')}
                  value={rejectReason}
                  onChange={(value) => setRejectReason(value)}
                />
              </div>
            )}
          </div>
        )}
      </Spin>
    </Modal>
  );
}

/**
 * 线下收款审核：对应原版订单列表「线下收款审核」视图（order/offlinePaymentClaim/list）。
 * 列表展示含线下认款申报的订单，行操作「审核」调 detail + audit。
 */
export function OfflinePaymentClaimManage() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [auditTarget, setAuditTarget] = useState<{ claimId: number; readonly: boolean } | null>(null);

  const reload = () => setReloadKey((key) => key + 1);

  const columns: ColumnConfig<ClaimOrderRow>[] = [
    {
      title: '订单号',
      dataIndex: 'orderSn',
      width: 190,
      render: (value: string) => <span>{value || '--'}</span>,
    },
    {
      title: '订单金额',
      dataIndex: 'totalAmount',
      width: 120,
      render: (value: unknown) => <span>{money(value)}</span>,
    },
    {
      title: '会员',
      dataIndex: 'username',
      width: 130,
      render: (value: string, row: ClaimOrderRow) => <span>{value || row.user?.username || '--'}</span>,
    },
    {
      title: '申请时间',
      dataIndex: 'addTime',
      width: 170,
      render: (value: string) => <span>{value || '--'}</span>,
    },
    {
      title: '付款凭证',
      dataIndex: 'voucher',
      width: 90,
      render: (_value: unknown, row: ClaimOrderRow) => {
        const url = latestClaim(row)?.voucherUrls?.[0];
        return url ? (
          <Image src={url} width={44} height={44} style={{ objectFit: 'cover', borderRadius: 4 }} />
        ) : (
          <span>--</span>
        );
      },
    },
    {
      title: '审核状态',
      dataIndex: 'offlinePaymentClaimStatus',
      width: 110,
      render: (_value: unknown, row: ClaimOrderRow) => renderClaimStatus(row, t),
    },
  ];

  return (
    <div>
      <ListPage<ClaimOrderRow>
        key={reloadKey}
        api="/order/offlinePaymentClaim/list"
        rowKey={(row) => String(row.orderId ?? Math.random())}
        pageSize={10}
        actionWidth={130}
        filters={[
          { field: 'orderSn', label: '订单号', type: 'input', placeholder: '请输入订单号', width: 220 },
          {
            field: 'offlinePaymentClaimStatus',
            label: '审核状态',
            type: 'select',
            options: CLAIM_STATUS_OPTIONS,
            placeholder: '审核状态',
            width: 160,
          },
        ]}
        columns={columns}
        rowActions={(row) => {
          const claimId = claimIdOf(row);
          if (!claimId) return <span>--</span>;
          const pending = Number(row.offlinePaymentClaimStatus) === 0;
          return (
            <>
              {pending && (
                <Button
                  theme="borderless"
                  type="primary"
                  size="small"
                  onClick={() => setAuditTarget({ claimId, readonly: false })}
                >
                  {t('审核')}
                </Button>
              )}
              <Button
                theme="borderless"
                size="small"
                onClick={() => setAuditTarget({ claimId, readonly: true })}
              >
                {t('详情')}
              </Button>
            </>
          );
        }}
      />

      {auditTarget && (
        <OfflineClaimAuditModal
          claimId={auditTarget.claimId}
          readonly={auditTarget.readonly}
          onClose={() => setAuditTarget(null)}
          onSaved={() => {
            setAuditTarget(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

/* ============================== 4. 图像搜索 ============================== */

interface ImageSearchAliyun {
  regionId: string;
  accessKeyId: string | null;
  accessKeySecret: string | null;
  securityToken: string | null;
  vpc: boolean;
  connectTimeoutMillis: number;
  readTimeoutMillis: number;
}

interface ImageSearchSettings {
  enabled: boolean;
  h5Enabled: boolean;
  pcEnabled: boolean;
  appEnabled: boolean;
  shopEnabled: boolean;
  provider: string;
  indexName: string;
  similarityPercent: number;
  maxResults: number;
  aliyun: ImageSearchAliyun;
}

interface ImageSearchJob {
  id: number;
  state?: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  indexName?: string;
  kind?: string;
  cursorId?: number;
  maxProductId?: number;
  scanned?: number;
  added?: number;
  skipped?: number;
  deleted?: number;
  attempts?: number;
  lastError?: string;
}

interface ImageSearchDetail {
  version: number;
  settings: ImageSearchSettings;
  accessKeyConfigured?: boolean;
  secretConfigured?: boolean;
  buildJob?: ImageSearchJob | null;
}

const MAX_RESULTS_LIMIT = 500;
const INDEX_NAME_PATTERN = /^[A-Za-z0-9_-]{1,20}$/;
const POLL_INTERVAL_MS = 3000;

const emptySettings = (): ImageSearchSettings => ({
  enabled: false,
  h5Enabled: false,
  pcEnabled: false,
  appEnabled: false,
  // 后端默认开启，旧版本未返回该字段时按开启处理
  shopEnabled: true,
  provider: 'aliyun',
  indexName: '',
  similarityPercent: 0,
  maxResults: MAX_RESULTS_LIMIT,
  aliyun: {
    regionId: '',
    accessKeyId: '',
    accessKeySecret: '',
    securityToken: null,
    vpc: false,
    connectTimeoutMillis: 2000,
    readTimeoutMillis: 5000,
  },
});

const JOB_STATE_MAP: Record<string, { label: string; color: 'orange' | 'blue' | 'green' | 'red' }> = {
  PENDING: { label: '排队中', color: 'orange' },
  RUNNING: { label: '构建中', color: 'blue' },
  COMPLETED: { label: '已完成', color: 'green' },
  FAILED: { label: '失败', color: 'red' },
};

const FieldRow = ({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) => (
  <div style={{ display: 'flex', marginBottom: 18 }}>
    <span style={{ width: 140, textAlign: 'right', paddingRight: 16, paddingTop: 6, flexShrink: 0 }}>
      {required && <span style={{ color: 'var(--semi-color-danger)' }}>* </span>}
      {label}
    </span>
    <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
  </div>
);

/**
 * 图像搜索设置：对应原版 views/setting/imageSearch/Index.vue。
 * 上半配置表单（detail 回显 / regions / save / check），下半图库构建（build / task 轮询 / retry）。
 */
export function ImageSearchManage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [building, setBuilding] = useState(false);
  const [detail, setDetail] = useState<ImageSearchDetail>({ version: 0, settings: emptySettings() });
  const [form, setForm] = useState<ImageSearchSettings>(emptySettings());
  const [regions, setRegions] = useState<{ label: string; value: string }[]>([]);
  const [job, setJob] = useState<ImageSearchJob | null>(null);
  const [tipVisible, setTipVisible] = useState(true);
  const [secretField, setSecretField] = useState<'accessKeyId' | 'accessKeySecret' | null>(null);
  const [secretValue, setSecretValue] = useState('');

  // 检测、建库要求后端已保存的总开关为开启（与表单里未保存的开关无关）
  const savedEnabledRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disposedRef = useRef(false);

  const jobActive = Boolean(job && (job.state === 'PENDING' || job.state === 'RUNNING'));

  const watchJob = (next: ImageSearchJob | null) => {
    if (disposedRef.current) return;
    setJob(next);
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
    // 任务未结束且后端开关开启时继续轮询
    if (next && (next.state === 'PENDING' || next.state === 'RUNNING') && savedEnabledRef.current) {
      pollRef.current = setTimeout(() => {
        void refreshJob(next.id);
      }, POLL_INTERVAL_MS);
    }
  };

  const refreshJob = async (taskId: number) => {
    try {
      const next = await apiGet<ImageSearchJob>('/setting/imageSearch/task', { taskId });
      watchJob(next ?? null);
    } catch {
      // 查询失败即停止轮询，避免反复报错
      if (pollRef.current) {
        clearTimeout(pollRef.current);
        pollRef.current = null;
      }
    }
  };

  const applyDetail = (data: ImageSearchDetail) => {
    const settings: ImageSearchSettings = { ...emptySettings(), ...(data.settings || {}) };
    settings.maxResults = data.settings?.maxResults ?? MAX_RESULTS_LIMIT;
    const aliyun = data.settings?.aliyun;
    settings.aliyun = {
      ...emptySettings().aliyun,
      ...(aliyun || {}),
      accessKeyId: aliyun?.accessKeyId ?? '',
      accessKeySecret: aliyun?.accessKeySecret ?? '',
      securityToken: null,
    };
    savedEnabledRef.current = settings.enabled === true;
    setDetail({ ...data, settings });
    setForm({ ...settings, aliyun: { ...settings.aliyun } });
    watchJob(data.buildJob ?? null);
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await apiGet<ImageSearchDetail>('/setting/imageSearch/detail');
      if (!disposedRef.current) {
        applyDetail(data);
        setLoadFailed(false);
      }
    } catch (error) {
      if (!disposedRef.current) {
        setLoadFailed(true);
        toastError(error, t('读取图像搜索配置失败'));
      }
    } finally {
      if (!disposedRef.current) setLoading(false);
    }
  };

  const loadRegions = async () => {
    try {
      const list = await apiGet<any>('/setting/imageSearch/regions', { provider: 'aliyun' });
      if (!disposedRef.current) {
        setRegions(Array.isArray(list) ? list : []);
      }
    } catch {
      if (!disposedRef.current) setRegions([]);
    }
  };

  useEffect(() => {
    disposedRef.current = false;
    void loadSettings();
    void loadRegions();
    return () => {
      disposedRef.current = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (patch: Partial<ImageSearchSettings>) => setForm((prev) => ({ ...prev, ...patch }));
  const updateAliyun = (patch: Partial<ImageSearchAliyun>) =>
    setForm((prev) => ({ ...prev, aliyun: { ...prev.aliyun, ...patch } }));

  const saveSettings = (settings: ImageSearchSettings, version: number) =>
    apiPost('/setting/imageSearch/save', {
      version,
      clearSecurityToken: false,
      settings: {
        ...settings,
        similarityPercent: Number(settings.similarityPercent) || 0,
        maxResults: Number(settings.maxResults) || MAX_RESULTS_LIMIT,
        aliyun: {
          ...settings.aliyun,
          // 原样提交掩码值或留空，后端都保留原值；securityToken 页面不维护，始终保留
          accessKeyId: settings.aliyun.accessKeyId || null,
          accessKeySecret: settings.aliyun.accessKeySecret || null,
          securityToken: null,
        },
      },
    });

  /** 已开启时是否在更换地域、账号或实例：需先用旧目标保存关闭，再保存新目标。 */
  const isChangingTarget = () => {
    const saved = detail.settings;
    if (!saved.enabled) return false;
    return (
      form.aliyun.regionId !== saved.aliyun.regionId ||
      form.indexName !== saved.indexName ||
      form.aliyun.accessKeyId !== saved.aliyun.accessKeyId
    );
  };

  const validateForm = () => {
    if (!form.enabled) return '';
    if (!String(form.aliyun.accessKeyId || '').trim()) return t('请输入AccessKey ID');
    if (!String(form.aliyun.accessKeySecret || '').trim()) return t('请输入AccessKey Secret');
    if (!form.indexName?.trim()) return t('请输入实例名称');
    if (!INDEX_NAME_PATTERN.test(form.indexName.trim())) {
      return t('实例名称只能是 1～20 位字母、数字、下划线或短横线');
    }
    if (!form.aliyun.regionId) return t('请选择实例地域');
    return '';
  };

  const submit = async () => {
    const err = validateForm();
    if (err) {
      Toast.error({ content: err });
      return;
    }
    if (loadFailed) return;
    setSaving(true);
    let version = detail.version;
    let disabledOld = false;
    try {
      if (savedEnabledRef.current && isChangingTarget()) {
        // 先用旧目标保存关闭，再取新版本号保存新配置
        await saveSettings({ ...detail.settings, enabled: false, aliyun: { ...detail.settings.aliyun } }, version);
        const latest = await apiGet<ImageSearchDetail>('/setting/imageSearch/detail');
        version = latest.version;
        disabledOld = true;
      }
      await saveSettings(form, version);
      Toast.success({ content: t('保存成功') });
      // 保存不返回新版本号，重新读取后才能继续编辑
      await loadSettings();
    } catch (error) {
      toastError(error, t('保存失败'));
      if (disabledOld) {
        Toast.warning({
          content: t('原配置已关闭，新配置保存失败，图像搜索当前处于关闭状态。请检查新配置后重新提交'),
          duration: 5,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const ensureSavedEnabled = () => {
    if (savedEnabledRef.current) return true;
    Toast.warning({ content: t('请先开启图像搜索并点击提交保存') });
    return false;
  };

  const onCheck = async () => {
    if (!ensureSavedEnabled()) return;
    setChecking(true);
    try {
      const result = await apiPost<{ reachable: boolean }>('/setting/imageSearch/check');
      if (result?.reachable) Toast.success({ content: t('连接正常') });
      else Toast.error({ content: t('连接失败') });
    } catch (error) {
      toastError(error, t('连接失败'));
    } finally {
      setChecking(false);
    }
  };

  const onBuild = () => {
    if (!ensureSavedEnabled()) return;
    Modal.confirm({
      title: t('构建图库'),
      content: t('构建会按当前商品重新对账图库，可能新增、更新并删除图库中的图片，确定开始吗？'),
      onOk: async () => {
        setBuilding(true);
        try {
          const next = await apiPost<ImageSearchJob>('/setting/imageSearch/build');
          watchJob(next ?? null);
        } catch (error) {
          toastError(error, t('构建任务发起失败'));
        } finally {
          setBuilding(false);
        }
      },
    });
  };

  const onRetry = async () => {
    if (!job?.id) return;
    try {
      // 原版 retry 以 query 参数传 taskId
      await apiPost(`/setting/imageSearch/retry?taskId=${job.id}`);
      Toast.success({ content: t('已重新发起构建') });
      void refreshJob(job.id);
    } catch (error) {
      toastError(error, t('重试失败'));
    }
  };

  const applySecret = () => {
    if (!secretField) return;
    updateAliyun({ [secretField]: secretValue.trim() } as Partial<ImageSearchAliyun>);
    setSecretField(null);
    setSecretValue('');
  };

  const jobProgress =
    job && job.maxProductId
      ? Math.min(100, Math.round(((job.cursorId || 0) / job.maxProductId) * 100))
      : 0;

  return (
    <div style={{ padding: 20 }}>
      {tipVisible && (
        <Banner
          type="warning"
          closeIcon={null}
          style={{ marginBottom: 16 }}
          description={t('保存配置不会自动构建图库。首次启用或更换实例后，请按顺序操作：保存并开启图像搜索 → 连接检测 → 构建图库至完成 → 勾选终端并保存')}
        />
      )}
      {loadFailed && (
        <Banner
          type="danger"
          closeIcon={null}
          style={{ marginBottom: 16 }}
          description={t('读取图像搜索配置失败，请刷新页面重试')}
        />
      )}

      <Spin spinning={loading}>
        <Card
          title={t('图像搜索')}
          style={{ marginBottom: 16 }}
          headerExtraContent={
            <Space>
              <Switch checked={form.enabled} onChange={(checked: boolean) => update({ enabled: checked })} />
              <Text type="tertiary">{form.enabled ? t('已开启') : t('已关闭')}</Text>
            </Space>
          }
        >
          <Text type="tertiary" size="small">
            {t('开启后，用户可通过拍照或上传图片搜索相似商品。关闭不会清空已保存的配置')}
          </Text>
        </Card>

        {form.enabled && (
          <>
            <Card title={t('连接配置')} style={{ marginBottom: 16 }}>
              <FieldRow label={t('接口服务')}>
                <RadioGroup
                  value={form.provider}
                  onChange={(event: any) => update({ provider: String(event.target.value) })}
                >
                  <Radio value="aliyun">{t('阿里云')}</Radio>
                </RadioGroup>
              </FieldRow>

              <FieldRow label={t('开启终端')}>
                <div>
                  <Space>
                    <Checkbox
                      checked={form.h5Enabled}
                      onChange={(event) =>
                        update({ h5Enabled: Boolean((event.target as HTMLInputElement).checked) })
                      }
                    >
                      {t('H5 / 小程序')}
                    </Checkbox>
                    <Checkbox
                      checked={form.appEnabled}
                      onChange={(event) =>
                        update({ appEnabled: Boolean((event.target as HTMLInputElement).checked) })
                      }
                    >
                      App
                    </Checkbox>
                    <Checkbox
                      checked={form.pcEnabled}
                      onChange={(event) =>
                        update({ pcEnabled: Boolean((event.target as HTMLInputElement).checked) })
                      }
                    >
                      PC
                    </Checkbox>
                  </Space>
                  <div style={{ marginTop: 6 }}>
                    <Text type="tertiary" size="small">
                      {t('首次启用时可先不勾选终端，待连接检测通过并完成图库构建后再勾选')}
                    </Text>
                  </div>
                </div>
              </FieldRow>

              <FieldRow label="AccessKey ID">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Text style={{ maxWidth: 380 }} ellipsis={{ showTooltip: true }}>
                    {form.aliyun.accessKeyId || '--'}
                  </Text>
                  <Button
                    size="small"
                    onClick={() => {
                      setSecretField('accessKeyId');
                      setSecretValue('');
                    }}
                  >
                    {t('编辑')}
                  </Button>
                </div>
                <div style={{ marginTop: 4 }}>
                  <Text type="tertiary" size="small">
                    {t('编辑完成后，点击下方提交按钮确认修改，请确保填写正确的AccessKeyId')}
                  </Text>
                </div>
              </FieldRow>

              <FieldRow label="AccessKey Secret">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Text style={{ maxWidth: 380 }} ellipsis={{ showTooltip: true }}>
                    {form.aliyun.accessKeySecret || '--'}
                  </Text>
                  <Button
                    size="small"
                    onClick={() => {
                      setSecretField('accessKeySecret');
                      setSecretValue('');
                    }}
                  >
                    {t('编辑')}
                  </Button>
                </div>
                <div style={{ marginTop: 4 }}>
                  <Text type="tertiary" size="small">
                    {t('编辑完成后，点击下方提交按钮确认修改，请确保填写正确的AccessKeySecret')}
                  </Text>
                </div>
              </FieldRow>

              <FieldRow label={t('实例名称')} required>
                <div>
                  <Input
                    style={{ width: 400 }}
                    value={form.indexName}
                    placeholder={t('请输入实例名称')}
                    onChange={(value) => update({ indexName: value })}
                  />
                  <div style={{ marginTop: 4 }}>
                    <Text type="tertiary" size="small">
                      {t('请填写阿里云后台图片搜索的实例名称（1～20 位字母、数字、下划线或短横线）')}
                    </Text>
                  </div>
                </div>
              </FieldRow>

              <FieldRow label={t('实例地域')} required>
                <div>
                  <Select
                    style={{ width: 400 }}
                    placeholder={t('请选择实例地域')}
                    filter
                    showClear
                    optionList={regions.map((item) => ({ label: item.label, value: item.value }))}
                    value={form.aliyun.regionId || undefined}
                    onChange={(value) => updateAliyun({ regionId: String(value || '') })}
                  />
                  <div style={{ marginTop: 4 }}>
                    <Text type="tertiary" size="small">
                      {t('选择阿里云商品图片搜索实例所在地域，实例地域不可变更，地域不一致将调用失败。')}
                    </Text>
                  </div>
                </div>
              </FieldRow>

              <FieldRow label={t('相似度阈值')}>
                <div>
                  <InputNumber
                    style={{ width: 160 }}
                    min={0}
                    max={100}
                    precision={0}
                    value={form.similarityPercent}
                    onChange={(value: number | string) => update({ similarityPercent: Number(value) || 0 })}
                    addonAfter="%"
                  />
                  <div style={{ marginTop: 4 }}>
                    <Text type="tertiary" size="small">
                      {t('填写相似度分数阈值后，只返回图片相似度分数大于等于阈值的图片信息，不填默认为0%。')}
                    </Text>
                  </div>
                </div>
              </FieldRow>

              <FieldRow label={t('查询结果')}>
                <div>
                  <InputNumber
                    style={{ width: 160 }}
                    min={1}
                    max={MAX_RESULTS_LIMIT}
                    precision={0}
                    value={form.maxResults}
                    onChange={(value: number | string) =>
                      update({ maxResults: Number(value) || MAX_RESULTS_LIMIT })
                    }
                    addonAfter={t('条')}
                  />
                  <div style={{ marginTop: 4 }}>
                    <Text type="tertiary" size="small">
                      {t('图片搜索结果最大支持500条数据，考虑系统性能压力，建议调小查询结果数量')}
                    </Text>
                  </div>
                </div>
              </FieldRow>

              <Button theme="solid" type="primary" loading={saving} onClick={submit}>
                {t('提 交')}
              </Button>
            </Card>

            <Card title={t('图库')} style={{ marginBottom: 16 }}>
              <FieldRow label={t('连接检测')}>
                <div>
                  <Button loading={checking} onClick={onCheck}>
                    {t('检测')}
                  </Button>
                  <div style={{ marginTop: 4 }}>
                    <Text type="tertiary" size="small">
                      {t('检测通过只代表可以访问服务，不代表图库已构建完成')}
                    </Text>
                  </div>
                </div>
              </FieldRow>

              <FieldRow label={t('构建图库')}>
                <div>
                  <Button
                    theme="solid"
                    type="primary"
                    loading={building}
                    disabled={jobActive}
                    onClick={onBuild}
                    icon={<IconPlus />}
                  >
                    {jobActive ? t('构建中') : t('开始构建')}
                  </Button>
                  <div style={{ marginTop: 4 }}>
                    <Text type="tertiary" size="small">
                      {t('按当前商品重新对账图库，会新增、更新并删除已不需要的图片，商品较多时耗时较长')}
                    </Text>
                  </div>
                </div>
              </FieldRow>

              {job && (
                <div
                  style={{
                    background: 'var(--semi-color-fill-0)',
                    borderRadius: 6,
                    padding: 16,
                    marginTop: 8,
                  }}
                >
                  <Space style={{ marginBottom: 10 }}>
                    <Tag color={JOB_STATE_MAP[job.state || '']?.color || 'grey'}>
                      {t(JOB_STATE_MAP[job.state || '']?.label || job.state || '未知')}
                    </Tag>
                    <Text type="tertiary" size="small">
                      {t('任务')} #{job.id} {job.indexName ? `· ${job.indexName}` : ''}
                    </Text>
                    {job.state === 'FAILED' && (
                      <Button size="small" onClick={onRetry}>
                        {t('重试')}
                      </Button>
                    )}
                  </Space>
                  {jobActive && (
                    <Progress percent={jobProgress} style={{ marginBottom: 10 }} showInfo />
                  )}
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    <Text type="secondary" size="small">
                      {t('扫描商品：')}{job.scanned ?? 0}
                    </Text>
                    <Text type="secondary" size="small">
                      {t('新增图片：')}{job.added ?? 0}
                    </Text>
                    <Text type="secondary" size="small">
                      {t('跳过图片：')}{job.skipped ?? 0}
                    </Text>
                    <Text type="secondary" size="small">
                      {t('删除图片：')}{job.deleted ?? 0}
                    </Text>
                    {Number(job.attempts) > 0 && job.state === 'PENDING' && (
                      <Text type="warning" size="small">
                        {t('连续失败 {count} 次，自动重试中', { count: Number(job.attempts) })}
                      </Text>
                    )}
                  </div>
                  {job.lastError && (
                    <div style={{ marginTop: 8 }}>
                      <Text type="danger" size="small">
                        {job.lastError}
                      </Text>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </>
        )}
      </Spin>

      <Modal
        title={secretField === 'accessKeyId' ? 'AccessKey ID' : 'AccessKey Secret'}
        visible={Boolean(secretField)}
        onOk={applySecret}
        onCancel={() => setSecretField(null)}
      >
        <Input
          value={secretValue}
          placeholder={t('输入新值，留空表示保留原值')}
          onChange={(value) => setSecretValue(value)}
        />
      </Modal>
    </div>
  );
}

/* ============================== 5. 资金概览 ============================== */

interface VendorAccountInfo {
  vendorMoney?: number | string;
  unSettlementMoney?: number | string;
  frozenMoney?: number | string;
}

interface VendorRankRow {
  vendorId?: number;
  vendorName?: string;
  vendorLogo?: string;
  vendorMoney?: number | string;
  status?: number;
}

interface VendorOrderRow {
  orderId?: number;
  orderSn?: string;
  addTime?: string;
  totalAmount?: number | string;
  orderStatusName?: string;
  user?: { username?: string };
}

const ORDER_TABS = [
  { itemKey: 'all', tab: '全部', params: { orderStatus: -1 } },
  { itemKey: 'ongoing', tab: '进行中', params: { orderStatus: '0,1,2' } },
  { itemKey: 'unsettled', tab: '待结算', params: { orderStatus: -1, isSettlement: 0 } },
  { itemKey: 'refund', tab: '退款', params: { orderStatus: -1, payStatus: 3 } },
  { itemKey: 'success', tab: '交易成功', params: { orderStatus: 5 } },
  { itemKey: 'closed', tab: '交易关闭', params: { orderStatus: '3,4,-2' } },
];

/**
 * 供应商资金概览：对应原版 views/vendor/adminFunds/account/List.vue + Ranking.vue + TransactionRecord.vue。
 * - 总览 GET vendor/adminVendorAccount/index（vendorMoney / unSettlementMoney / frozenMoney）
 * - 余额排行 GET vendor/adminVendorAccount/listFund（sortField=vendorMoney&sortOrder=desc）
 * - 最近交易记录 GET order/order/list（vendorId=-2，按 tab 切 orderStatus/isSettlement/payStatus）
 */
export function VendorAccountManage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<VendorAccountInfo>({});
  const [orderTab, setOrderTab] = useState('all');
  const [capturedAt, setCapturedAt] = useState('');

  useEffect(() => {
    setCapturedAt(todayText());
    apiGet<any>('/vendor/adminVendorAccount/index')
      .then((data) => setAccount(data || {}))
      .catch((error) => toastError(error, t('加载资金概览失败')))
      .finally(() => setLoading(false));
  }, []);

  const orderQuery = useMemo(() => {
    const tab = ORDER_TABS.find((item) => item.itemKey === orderTab) || ORDER_TABS[0];
    return { vendorId: -2, isSettlement: -1, ...tab.params };
  }, [orderTab]);

  const rankColumns: ColumnConfig<VendorRankRow>[] = [
    {
      title: '供应商名称',
      dataIndex: 'vendorName',
      width: 200,
      render: (value: string) => <span>{value || '--'}</span>,
    },
    {
      title: '供应商LOGO',
      dataIndex: 'vendorLogo',
      width: 120,
      render: (value: string) =>
        value ? (
          <Image src={value} width={60} height={25} style={{ objectFit: 'contain' }} />
        ) : (
          <span>--</span>
        ),
    },
    {
      title: '供应商余额',
      dataIndex: 'vendorMoney',
      width: 140,
      render: (value: unknown) => <span>{money(value)}</span>,
    },
    {
      title: '供应商状态',
      dataIndex: 'status',
      width: 110,
      render: (value: number) => renderVendorStatus(value, t),
    },
  ];

  const orderColumns: ColumnConfig<VendorOrderRow>[] = [
    {
      title: '时间',
      dataIndex: 'addTime',
      width: 170,
      render: (value: string) => <span>{value || '--'}</span>,
    },
    {
      title: '购买用户',
      dataIndex: 'username',
      width: 150,
      render: (value: string, row: VendorOrderRow) => <span>{value || row.user?.username || '--'}</span>,
    },
    {
      title: '订单编号',
      dataIndex: 'orderSn',
      width: 200,
      render: (value: string) => <span>{value || '--'}</span>,
    },
    {
      title: '金额',
      dataIndex: 'totalAmount',
      width: 130,
      render: (value: unknown) => <span>{money(value)}</span>,
    },
    {
      title: '状态',
      dataIndex: 'orderStatusName',
      width: 120,
      render: (value: string) => <span>{value || '--'}</span>,
    },
  ];

  return (
    <div style={{ padding: 20 }}>
      <Spin spinning={loading}>
        <SectionTitle>{t('所有供应商总余额: 截止时间:')} [{capturedAt || '--'}]</SectionTitle>
        <Card style={{ marginBottom: 8 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Tooltip content={t('可用供应商余额=供应商余额-不可用供应商余额')}>
                <div style={{ background: 'var(--semi-color-fill-0)', padding: 20, borderRadius: 6 }}>
                  <Text type="secondary">{t('余额总结余')}</Text>
                  <div
                    style={{
                      fontSize: 26,
                      fontWeight: 600,
                      marginTop: 8,
                      color: 'var(--semi-color-primary)',
                    }}
                  >
                    {money(account.vendorMoney)}
                  </div>
                </div>
              </Tooltip>
            </Col>
            <Col span={8}>
              <Tooltip content={t('交易未完成的订单总额，消费者确认收货后将自动转入供应商余额')}>
                <div style={{ background: 'var(--semi-color-fill-0)', padding: 20, borderRadius: 6 }}>
                  <Text type="secondary">{t('待结算总额')}</Text>
                  <div
                    style={{
                      fontSize: 26,
                      fontWeight: 600,
                      marginTop: 8,
                      color: 'var(--semi-color-warning)',
                    }}
                  >
                    {money(account.unSettlementMoney)}
                  </div>
                </div>
              </Tooltip>
            </Col>
            <Col span={8}>
              <Tooltip content={t('提现中或者退款中的冻结供应商余额')}>
                <div style={{ background: 'var(--semi-color-fill-0)', padding: 20, borderRadius: 6 }}>
                  <Text type="secondary">{t('不可用余额')}</Text>
                  <div
                    style={{
                      fontSize: 26,
                      fontWeight: 600,
                      marginTop: 8,
                      color: 'var(--semi-color-danger)',
                    }}
                  >
                    {money(account.frozenMoney)}
                  </div>
                </div>
              </Tooltip>
            </Col>
          </Row>
        </Card>
      </Spin>

      <SectionTitle>{t('供应商余额排行')}</SectionTitle>
      <ListPage<VendorRankRow>
        api="/vendor/adminVendorAccount/listFund"
        query={{ sortField: 'vendorMoney', sortOrder: 'desc' }}
        rowKey={(row) => String(row.vendorId ?? Math.random())}
        pageSize={10}
        showEdit={false}
        columns={rankColumns}
      />

      <SectionTitle>{t('最近交易记录')}</SectionTitle>
      <Tabs
        type="card"
        activeKey={orderTab}
        onChange={(key) => setOrderTab(key as string)}
        tabList={ORDER_TABS.map((tab) => ({ itemKey: tab.itemKey, tab: t(tab.tab) }))}
        style={{ marginBottom: 8 }}
      />
      <ListPage<VendorOrderRow>
        api="/order/order/list"
        query={orderQuery}
        rowKey={(row) => String(row.orderId ?? Math.random())}
        pageSize={10}
        showEdit={false}
        columns={orderColumns}
      />
    </div>
  );
}

/* ============================== 6/7. 供应商资金 + 资金日志 ============================== */

interface VendorFundRow extends VendorRankRow {
  unSettlementMoney?: number | string;
  frozenMoney?: number | string;
  addTime?: string;
}

interface VendorFundLogRow {
  logId?: number;
  vendorId?: number;
  vendorName?: string;
  vendorMoney?: number | string;
  newVendorMoney?: number | string;
  frozenMoney?: number | string;
  newFrozenMoney?: number | string;
  changeReasons?: string;
  addTime?: string;
}

/** 变动资金列：after-before 差值着色，附变更后金额（与原版 financialLog/List.vue 一致）。 */
const renderMoneyChange = (before: unknown, after: unknown, t: Translate) => {
  const diff = Number(after || 0) - Number(before || 0);
  const color =
    diff > 0 ? 'var(--semi-color-info)' : diff < 0 ? 'var(--semi-color-danger)' : undefined;
  const text = diff > 0 ? `+${diff.toFixed(2)}` : diff < 0 ? `-${Math.abs(diff).toFixed(2)}` : '0';
  return (
    <span>
      <span style={{ color }}>{text}</span>
      {Number(after) ? (
        <span style={{ color: 'var(--semi-color-text-2)', fontSize: 12 }}>
          {t('（变更后金额:{amount}）', { amount: Number(after).toFixed(2) })}
        </span>
      ) : null}
    </span>
  );
};

/**
 * 资金日志表（GET vendor/adminVendorAccount/logList）。
 * vendorId 传入时按该供应商过滤（供应商资金列表行操作弹窗复用）。
 */
export function VendorFundLogTable({ vendorId }: { vendorId?: number }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<VendorFundLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [dates, setDates] = useState<[Date | undefined, Date | undefined]>([undefined, undefined]);
  const [applied, setApplied] = useState<{ keyword: string; startTime: string; endTime: string }>({
    keyword: '',
    startTime: '',
    endTime: '',
  });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiGet<any>('/vendor/adminVendorAccount/logList', {
      page,
      size: 10,
      keyword: applied.keyword || undefined,
      vendorId: vendorId ?? undefined,
      startTime: applied.startTime || undefined,
      endTime: applied.endTime || undefined,
    })
      .then((result) => {
        if (!alive) return;
        setRows(result?.records || []);
        setTotal(Number(result?.total || 0));
      })
      .catch((error) => {
        if (alive) toastError(error, t('加载资金日志失败'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [page, applied, vendorId]);

  const search = () => {
    setPage(1);
    setApplied({
      keyword: keyword.trim(),
      startTime: formatDate(dates[0]),
      endTime: formatDate(dates[1]),
    });
  };

  const reset = () => {
    setKeyword('');
    setDates([undefined, undefined]);
    setPage(1);
    setApplied({ keyword: '', startTime: '', endTime: '' });
  };

  const columns: ColumnConfig<VendorFundLogRow>[] = [
    {
      title: t('账户变动时间'),
      dataIndex: 'addTime',
      width: 170,
      render: (value: string) => <span>{value || '--'}</span>,
    },
    {
      title: t('供应商名称'),
      dataIndex: 'vendorName',
      width: 160,
      render: (value: string) => <span>{value || '--'}</span>,
    },
    {
      title: t('变动资金账户'),
      dataIndex: 'newVendorMoney',
      width: 240,
      render: (_value: unknown, row: VendorFundLogRow) =>
        renderMoneyChange(row.vendorMoney, row.newVendorMoney, t),
    },
    {
      title: t('冻结资金账户'),
      dataIndex: 'newFrozenMoney',
      width: 250,
      render: (_value: unknown, row: VendorFundLogRow) =>
        renderMoneyChange(row.frozenMoney, row.newFrozenMoney, t),
    },
    {
      title: t('变动原因'),
      dataIndex: 'changeReasons',
      render: (value: string) => <span>{value || '--'}</span>,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input
            prefix={<IconSearch />}
            style={{ width: 200 }}
            placeholder={t('输入供应商名称')}
            value={keyword}
            showClear
            onChange={(value) => setKeyword(value)}
            onEnterPress={search}
          />
          <DatePicker
            type="dateRange"
            placeholder={[t('开始日期'), t('结束日期')]}
            value={dates as any}
            onChange={(value: any) =>
              setDates([value?.[0] as Date | undefined, value?.[1] as Date | undefined])
            }
            style={{ width: 260 }}
          />
          <Button theme="solid" type="primary" icon={<IconSearch />} onClick={search}>
            {t('搜索')}
          </Button>
          <Button onClick={reset}>{t('重置')}</Button>
        </Space>
      </div>
      <Table<VendorFundLogRow>
        loading={loading}
        dataSource={rows}
        rowKey={(record?: VendorFundLogRow, index?: number) =>
          String(record?.logId ?? `${record?.vendorId ?? 'log'}-${index ?? 0}`)
        }
        pagination={{
          currentPage: page,
          pageSize: 10,
          total,
          onChange: (next: number) => setPage(next),
        }}
        columns={columns as any}
      />
    </div>
  );
}

/**
 * 供应商资金：对应原版 views/vendor/adminFunds/shopFunds/List.vue。
 * GET vendor/adminVendorAccount/listFund（keyword/status 筛选），行操作「查看资金日志」打开 logList 弹窗。
 */
export function VendorFundsManage() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [logTarget, setLogTarget] = useState<VendorFundRow | null>(null);

  const columns: ColumnConfig<VendorFundRow>[] = [
    {
      title: '供应商名称',
      dataIndex: 'vendorName',
      width: 220,
      render: (value: string, row: VendorFundRow) => (
        <Space>
          {row.vendorLogo ? (
            <Image src={row.vendorLogo} width={40} height={40} style={{ objectFit: 'contain', borderRadius: 4 }} />
          ) : null}
          <span>{value || '--'}</span>
        </Space>
      ),
    },
    {
      title: '供应商状态',
      dataIndex: 'status',
      width: 110,
      render: (value: number) => renderVendorStatus(value, t),
    },
    {
      title: '供应商资金',
      dataIndex: 'vendorMoney',
      width: 130,
      render: (value: unknown) => <span>{money(value)}</span>,
    },
    {
      title: '待结算金额',
      dataIndex: 'unSettlementMoney',
      width: 130,
      render: (value: unknown) => <span>{money(value)}</span>,
    },
    {
      title: '不可用资金',
      dataIndex: 'frozenMoney',
      width: 130,
      render: (value: unknown) => <span>{money(value)}</span>,
    },
    {
      title: '开店时间',
      dataIndex: 'addTime',
      width: 170,
      render: (value: string) => <span>{value || '--'}</span>,
    },
  ];

  return (
    <div>
      <ListPage<VendorFundRow>
        key={reloadKey}
        api="/vendor/adminVendorAccount/listFund"
        rowKey={(row) => String(row.vendorId ?? Math.random())}
        pageSize={10}
        actionWidth={130}
        filters={[
          { field: 'keyword', label: '供应商名称', type: 'input', placeholder: '输入供应商名称', width: 220 },
          {
            field: 'status',
            label: '供应商状态',
            type: 'select',
            options: [
              { value: 0, label: '全部' },
              { value: 1, label: '在供' },
              { value: 2, label: '断供' },
            ],
            placeholder: '供应商状态',
            width: 160,
          },
        ]}
        columns={columns}
        rowActions={(row) => (
          <Button theme="borderless" size="small" onClick={() => setLogTarget(row)}>
            {t('查看资金日志')}
          </Button>
        )}
      />

      <Modal
        title={`${t('资金日志')} - ${logTarget?.vendorName || ''}`}
        visible={Boolean(logTarget)}
        width={920}
        footer={null}
        onCancel={() => setLogTarget(null)}
      >
        {logTarget && <VendorFundLogTable vendorId={Number(logTarget.vendorId)} />}
      </Modal>
    </div>
  );
}

/**
 * 资金日志：对应原版 views/vendor/adminFunds/financialLog/List.vue（平台端）。
 * GET vendor/adminVendorAccount/logList（keyword / startTime / endTime 筛选）。
 */
export function VendorFinancialLogManage() {
  const { t } = useI18n();
  return (
    <div style={{ padding: 20 }}>
      <Card title={t('资金日志')}>
        <VendorFundLogTable />
      </Card>
    </div>
  );
}
