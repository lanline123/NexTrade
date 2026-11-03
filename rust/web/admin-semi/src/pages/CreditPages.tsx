import { useState } from 'react';
import {
  Button,
  Modal,
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

/** 授信客户：对应旧版 order/termPay/termMember/List.vue，接口 /credit/user/*。 */
export function CreditUsers() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);

  const reload = () => setReloadKey((key) => key + 1);

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
      width: 120,
      render: (_: unknown, row: CreditUserRow) => (
        <Button theme="borderless" type="danger" size="small" onClick={() => deleteCreditUser(row)}>
          {t('删除')}
        </Button>
      ),
    },
  ];

  return (
    <ListPage<CreditUserRow>
      key={reloadKey}
      api="/credit/user/list"
      rowKey={(row?: CreditUserRow) => String(row?.id ?? Math.random())}
      pageSize={10}
      actionWidth={160}
      columns={columns}
    />
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
