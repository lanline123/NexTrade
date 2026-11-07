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
  Switch,
  Table,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import { useI18n } from '../i18n';

const { Text } = Typography;

interface CreditOrderRow {
  orderId?: number;
  orderSn?: string;
  orderTime?: string;
  orderStatusText?: string;
  username?: string;
  companyName?: string;
  totalAmount?: number | string;
  settlementStatusText?: string;
  settlementOrderSn?: string;
}

interface CreditUserRow {
  id?: number;
  userId?: number;
  username?: string;
  creditAmount?: number | string;
  availableAmount?: number | string;
  usedAmount?: number | string;
  settlementTypeText?: string;
  settlementType?: number;
  status?: number;
  remainDays?: number;
  adviceText?: string;
}

interface PendingOrderRow {
  orderId?: number;
  orderSn?: string;
  totalAmount?: number | string;
}

const money = (value: unknown) => `¥${Number(value || 0).toFixed(2)}`;

/** 账期支付订单：对应旧版 order/termPay/termOrder/List.vue，接口 GET /credit/order/list。 */
export function CreditOrders() {
  const columns: ColumnConfig<CreditOrderRow>[] = [
    {
      title: '订单编号',
      dataIndex: 'orderSn',
      width: 150,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    { title: '下单时间', dataIndex: 'orderTime', width: 170 },
    {
      title: '订单状态',
      dataIndex: 'orderStatusText',
      width: 110,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      title: '会员名称',
      dataIndex: 'username',
      width: 130,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      title: '公司名称',
      dataIndex: 'companyName',
      width: 180,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      title: '订单总额',
      dataIndex: 'totalAmount',
      width: 130,
      render: (value: unknown) => <span>{money(value)}</span>,
    },
    {
      title: '结算状态',
      dataIndex: 'settlementStatusText',
      width: 110,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      title: '回款流水单号',
      dataIndex: 'settlementOrderSn',
      width: 180,
      render: (value: string) => <span>{value || '-'}</span>,
    },
  ];

  return (
    <ListPage<CreditOrderRow>
      api="/credit/order/list"
      rowKey={(row?: CreditOrderRow) => String(row?.orderId ?? Math.random())}
      pageSize={10}
      filters={[
        { field: 'keyword', label: '订单编号', type: 'input', placeholder: '订单编号/会员', width: 220 },
      ]}
      columns={columns}
    />
  );
}

/** 授信客户：对应旧版 order/termPay/termMember/List.vue，接口 /credit/user/*。
 * 已补齐新增/编辑表单（旧版跳转独立编辑页：会员/授信额度/结算账期/状态）。 */
export function CreditUsers() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editMode, setEditMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{
    username: string;
    userId?: number;
    creditLimit: number;
    settlementType: number;
    status: number;
  }>({ username: '', creditLimit: 0, settlementType: 1, status: 1 });
  const [userRows, setUserRows] = useState<Array<{ userId: number; username?: string; nickname?: string; mobile?: string }>>([]);
  const [userKeyword, setUserKeyword] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = () => setReloadKey((key) => key + 1);

  const openCreate = () => {
    setEditMode('create');
    setEditingId(null);
    setEditForm({ username: '', creditLimit: 0, settlementType: 1, status: 1 });
    setUserRows([]);
    setUserKeyword('');
    setEditOpen(true);
  };

  const openEdit = async (row: CreditUserRow) => {
    setEditMode('edit');
    setEditingId(row.id ?? null);
    try {
      const detail = await apiGet<any>('/credit/user/detail', { id: row.id });
      setEditForm({
        username: detail?.username || row.username || '',
        userId: Number(detail?.userId ?? row.userId ?? 0),
        creditLimit: Number(detail?.creditAmount ?? detail?.creditLimit ?? 0),
        settlementType: Number(detail?.settlementType ?? 1),
        status: Number(detail?.status ?? 1),
      });
    } catch {
      setEditForm({
        username: row.username || '',
        userId: Number(row.userId ?? 0),
        creditLimit: Number(row.creditAmount ?? 0),
        settlementType: Number(row.settlementType ?? 1),
        status: Number(row.status ?? 1),
      });
    }
    setEditOpen(true);
  };

  const searchUsers = (keyword = '') => {
    apiGet<any>('/proxyShopping/user/list', { page: 1, size: 20, keyword })
      .then((result) => setUserRows(result.records || result.list || []))
      .catch((error) => Toast.error({ content: error?.message || t('加载会员失败') }));
  };

  const save = async () => {
    if (editMode === 'create' && !editForm.userId) {
      Toast.warning({ content: t('请选择会员') });
      return;
    }
    if (Number(editForm.creditLimit) <= 0) {
      Toast.warning({ content: t('授信额度必须大于0') });
      return;
    }
    setSaving(true);
    try {
      const body = {
        userId: editForm.userId,
        creditLimit: Number(editForm.creditLimit),
        settlementType: Number(editForm.settlementType),
        status: Number(editForm.status),
      };
      if (editMode === 'edit' && editingId) {
        await apiPost('/credit/user/update', { ...body, creditUserId: editingId, id: editingId });
      } else {
        await apiPost('/credit/user/create', body);
      }
      Toast.success({ content: editMode === 'edit' ? t('更新成功') : t('创建成功') });
      setEditOpen(false);
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (row: CreditUserRow, next: number) => {
    try {
      await apiPost('/credit/user/updateField', { id: row.id, field: 'status', value: next });
      Toast.success({ content: t('修改成功') });
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('修改失败') });
    }
  };

  const deleteCreditUser = (row: CreditUserRow) => {
    Modal.confirm({
      title: t('确认删除该授信客户吗？'),
      onOk: async () => {
        try {
          await apiPost('/credit/user/delete', { id: row.id });
          Toast.success({ content: t('删除成功') });
          reload();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
        }
      },
    });
  };

  const columns: ColumnConfig<CreditUserRow>[] = [
    {
      title: '会员名称',
      dataIndex: 'username',
      width: 200,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      title: '授信额度',
      dataIndex: 'creditAmount',
      width: 130,
      render: (value: unknown) => <span>{money(value)}</span>,
    },
    {
      title: '可用额度',
      dataIndex: 'availableAmount',
      width: 130,
      render: (value: unknown) => <span>{money(value)}</span>,
    },
    {
      title: '已使用额度',
      dataIndex: 'usedAmount',
      width: 130,
      render: (value: unknown) => <span>{money(value)}</span>,
    },
    {
      title: '结算账期',
      dataIndex: 'settlementTypeText',
      width: 110,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: number, row: CreditUserRow) => (
        <SwitchLike checked={Number(value) === 1} row={row} onToggle={toggleStatus} />
      ),
    },
    {
      title: '操作',
      width: 160,
      render: (_: unknown, row: CreditUserRow) => (
        <Space spacing={2}>
          <Button theme="borderless" size="small" onClick={() => openEdit(row)}>
            {t('编辑')}
          </Button>
          <Button theme="borderless" type="danger" size="small" onClick={() => deleteCreditUser(row)}>
            {t('删除')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPage<CreditUserRow>
        key={reloadKey}
        api="/credit/user/list"
        rowKey={(row?: CreditUserRow) => String(row?.id ?? Math.random())}
        pageSize={10}
        actionWidth={160}
        columns={columns}
        toolbarExtra={
          <Button theme="solid" type="primary" onClick={openCreate}>
            {t('添加授信客户')}
          </Button>
        }
      />

      <Modal
        title={editMode === 'create' ? t('添加授信客户') : t('编辑授信客户')}
        visible={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={save}
        okButtonProps={{ loading: saving }}
        okText={t('保存')}
        cancelText={t('取消')}
        width={560}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          {editMode === 'create' ? (
            <>
              <span>{t('会员')}</span>
              <Space wrap>
                <Input
                  style={{ width: 200 }}
                  placeholder={t('会员名称/手机号')}
                  value={userKeyword}
                  onChange={setUserKeyword}
                  onEnterPress={() => searchUsers(userKeyword)}
                />
                <Button onClick={() => searchUsers(userKeyword)}>{t('搜索')}</Button>
              </Space>
              <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--semi-color-border)', borderRadius: 6 }}>
                {userRows.map((item) => (
                  <div
                    key={item.userId}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      background: editForm.userId === item.userId ? 'var(--semi-color-primary-light-default)' : undefined,
                    }}
                    onClick={() => {
                      setEditForm((current) => ({ ...current, userId: item.userId, username: item.nickname || item.username || '' }));
                    }}
                  >
                    {item.nickname || item.username || `#${item.userId}`}
                    {item.mobile ? ` · ${item.mobile}` : ''}
                  </div>
                ))}
                {!userRows.length && (
                  <div style={{ padding: 12 }}>
                    <Text type="tertiary" size="small">{t('搜索并选择会员')}</Text>
                  </div>
                )}
              </div>
            </>
          ) : (
            <span>
              {t('会员')}：{editForm.username || editForm.userId || '-'}
            </span>
          )}
          <span>{t('授信额度')}</span>
          <InputNumber
            style={{ width: 220 }}
            min={0.01}
            precision={2}
            value={editForm.creditLimit}
            onChange={(next: any) => setEditForm((c) => ({ ...c, creditLimit: Number(next ?? 0) }))}
          />
          <span>{t('结算账期')}</span>
          <RadioGroup
            value={editForm.settlementType}
            onChange={(event) => setEditForm((c) => ({ ...c, settlementType: Number(event.target.value) }))}
          >
            <Radio value={1}>{t('月结')}</Radio>
            <Radio value={2}>{t('季结')}</Radio>
          </RadioGroup>
          <span>{t('状态')}</span>
          <RadioGroup
            value={editForm.status}
            onChange={(event) => setEditForm((c) => ({ ...c, status: Number(event.target.value) }))}
          >
            <Radio value={1}>{t('启用')}</Radio>
            <Radio value={0}>{t('禁用')}</Radio>
          </RadioGroup>
        </div>
      </Modal>
    </>
  );
}

function SwitchLike({
  checked,
  row,
  onToggle,
}: {
  checked: boolean;
  row: CreditUserRow;
  onToggle: (row: CreditUserRow, next: number) => void;
}) {
  return <Switch checked={checked} onChange={(next: boolean) => onToggle(row, next ? 1 : 0)} />;
}

/** 账期结算：对应旧版 order/termPay/termPay/List.vue + WaitPay.vue，接口 /credit/settlement/*。 */
export function CreditSettlements() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [settleTarget, setSettleTarget] = useState<CreditUserRow | null>(null);
  const [pendingRows, setPendingRows] = useState<PendingOrderRow[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const reload = () => setReloadKey((key) => key + 1);

  const openSettle = async (row: CreditUserRow) => {
    setSettleTarget(row);
    setSelectedOrderIds([]);
    setPendingLoading(true);
    try {
      const result = await apiGet<any>('/credit/settlement/pendingOrders', {
        userId: row.userId ?? row.id,
        page: 1,
        size: 50,
      });
      setPendingRows(result?.records || result?.list || []);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载失败') });
    } finally {
      setPendingLoading(false);
    }
  };

  const submitSettlement = async () => {
    if (!settleTarget) return;
    if (!selectedOrderIds.length) {
      Toast.error({ content: t('请选择待结算订单') });
      return;
    }
    setSubmitting(true);
    try {
      await apiPost('/credit/settlement/submit', {
        userId: settleTarget.userId ?? settleTarget.id,
        orderIds: selectedOrderIds,
      });
      Toast.success({ content: t('结算提交成功') });
      setSettleTarget(null);
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('结算失败') });
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnConfig<CreditUserRow>[] = [
    {
      title: '客户名称',
      dataIndex: 'username',
      width: 180,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      title: '授信额度',
      dataIndex: 'creditAmount',
      width: 130,
      render: (value: unknown) => <span>{money(value)}</span>,
    },
    {
      title: '可用额度',
      dataIndex: 'availableAmount',
      width: 130,
      render: (value: unknown) => <span>{money(value)}</span>,
    },
    {
      title: '已使用额度',
      dataIndex: 'usedAmount',
      width: 130,
      render: (value: unknown) => <span>{money(value)}</span>,
    },
    {
      title: '结算账期',
      dataIndex: 'settlementTypeText',
      width: 110,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      title: '剩余账期天数',
      dataIndex: 'remainDays',
      width: 120,
      render: (value: number) => <span>{value ?? '-'}</span>,
    },
    {
      title: '结算建议',
      dataIndex: 'adviceText',
      render: (value: string) => <span>{value || '-'}</span>,
    },
  ];

  return (
    <>
      <ListPage<CreditUserRow>
        key={reloadKey}
        api="/credit/settlement/userList"
        rowKey={(row?: CreditUserRow) => String(row?.id ?? Math.random())}
        pageSize={10}
        actionWidth={140}
        filters={[
          { field: 'keyword', label: '客户名称', type: 'input', placeholder: '客户名称', width: 200 },
          { field: 'settlementSn', label: '结算单号', type: 'input', placeholder: '结算单号', width: 200 },
        ]}
        columns={columns}
        rowActions={(row) => (
          <Button theme="borderless" type="danger" size="small" onClick={() => openSettle(row)}>
            {t('去结算')}
          </Button>
        )}
      />

      <Modal
        title={
          settleTarget
            ? t('账期结算：{name}', { name: settleTarget.username || '' })
            : t('账期结算')
        }
        visible={Boolean(settleTarget)}
        width={820}
        footer={null}
        onCancel={() => setSettleTarget(null)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Text type="tertiary" size="small">
            {t('勾选待结算订单后提交；接口 /credit/settlement/pendingOrders + submit。')}
          </Text>
          <SpinLike loading={pendingLoading}>
            <Table
              size="small"
              pagination={false}
              rowKey="orderId"
              dataSource={pendingRows}
              rowSelection={{
                selectedRowKeys: selectedOrderIds,
                onChange: (keys: any) => setSelectedOrderIds((keys as number[]).map(Number)),
              }}
              columns={[
                { title: t('订单编号'), dataIndex: 'orderSn' },
                {
                  title: t('订单金额'),
                  dataIndex: 'totalAmount',
                  render: (value: unknown) => <span>{money(value)}</span>,
                },
              ]}
            />
          </SpinLike>
          <Space>
            <Button
              theme="solid"
              type="primary"
              loading={submitting}
              disabled={!selectedOrderIds.length}
              onClick={submitSettlement}
            >
              {t('提交结算（已选 {count} 单）', { count: selectedOrderIds.length })}
            </Button>
          </Space>
        </div>
      </Modal>
    </>
  );
}

function SpinLike({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return <Spin spinning={loading}>{children}</Spin>;
}
