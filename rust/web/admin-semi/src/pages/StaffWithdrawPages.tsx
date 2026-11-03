import { useState } from 'react';
import {
  Badge,
  Button,
  Input,
  Modal,
  Radio,
  RadioGroup,
  Space,
  TextArea,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { apiPost } from '../api';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import { useI18n } from '../i18n';

const { Text } = Typography;

interface StaffWithdrawRow {
  withdrawId: number;
  withdrawSn: string;
  staffId: number;
  staffName: string;
  staffPhone: string;
  businessType?: number;
  amount: string | number;
  status: 0 | 1 | 2;
  accountId?: number;
  accountType?: number;
  accountName: string;
  accountNo: string;
  bankName?: string;
  adminRemark?: string;
  paymentVoucher?: string;
  rejectReason?: string;
  applyTime: string | number;
  auditTime?: string | number;
}

const statusMap: Record<number, { text: string; type: 'warning' | 'success' | 'danger' }> = {
  0: { text: '待审核', type: 'warning' },
  1: { text: '已打款', type: 'success' },
  2: { text: '已驳回', type: 'danger' },
};

function formatTime(ts: string | number | undefined) {
  if (!ts) return '-';
  const num = Number(ts);
  if (!Number.isNaN(num) && num > 1000000000 && num < 10000000000) {
    return new Date(num * 1000).toLocaleString();
  }
  return String(ts);
}

function StaffWithdrawTable({
  type,
}: {
  type: 'delivery' | 'server';
}) {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [auditVisible, setAuditVisible] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [currentRow, setCurrentRow] = useState<StaffWithdrawRow | null>(null);
  const [auditForm, setAuditForm] = useState({
    status: 1 as 1 | 2,
    paymentVoucher: '',
    rejectReason: '',
    adminRemark: '',
  });

  const apiPrefix = type === 'delivery' ? '/finance/deliveryStaffWithdraw' : '/finance/serverStaffWithdraw';

  const openAudit = (row: StaffWithdrawRow) => {
    setCurrentRow(row);
    setAuditForm({
      status: 1,
      paymentVoucher: '',
      rejectReason: '',
      adminRemark: '',
    });
    setAuditVisible(true);
  };

  const handleAuditSubmit = async () => {
    if (!currentRow) return;
    setAuditLoading(true);
    try {
      await apiPost(`${apiPrefix}/audit`, {
        withdrawId: currentRow.withdrawId,
        status: auditForm.status,
        paymentVoucher: auditForm.paymentVoucher,
        rejectReason: auditForm.rejectReason,
        adminRemark: auditForm.adminRemark,
      });
      Toast.success({ content: t('审核成功') });
      setAuditVisible(false);
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('审核失败') });
    } finally {
      setAuditLoading(false);
    }
  };

  const columns: ColumnConfig[] = [
    {
      title: '提现单号',
      dataIndex: 'withdrawSn',
      width: 200,
    },
    {
      title: '员工',
      dataIndex: 'staffName',
      width: 140,
    },
    {
      title: '手机号',
      dataIndex: 'staffPhone',
      width: 140,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 120,
      render: (v: unknown) => <Text style={{ color: 'var(--semi-color-danger)' }}>¥{String(v ?? '0.00')}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (v: unknown) => {
        const item = statusMap[Number(v)];
        return (
          <Space>
            <Badge dot type={item?.type ?? 'warning'} />
            <span>{item ? t(item.text) : String(v ?? '-')}</span>
          </Space>
        );
      },
    },
    {
      title: '收款人',
      dataIndex: 'accountName',
      width: 140,
      render: (v: unknown) => <span>{String(v || '--')}</span>,
    },
    {
      title: '收款账号',
      dataIndex: 'accountNo',
      width: 180,
      render: (v: unknown) => <span>{String(v || '--')}</span>,
    },
    {
      title: '申请时间',
      dataIndex: 'applyTime',
      width: 180,
      render: (v: unknown) => <span>{formatTime(v as string | number)}</span>,
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 120,
      render: (_: unknown, row: unknown) => {
        const record = row as StaffWithdrawRow;
        if (Number(record.status) === 0) {
          return (
            <Button
              theme="borderless"
              type="primary"
              size="small"
              onClick={() => openAudit(record)}
            >
              {t('审核')}
            </Button>
          );
        }
        return <Text type="tertiary">-</Text>;
      },
    },
  ];

  return (
    <div>
      <ListPage
        key={reloadKey}
        api={`${apiPrefix}/list`}
        rowKey="withdrawId"
        columns={columns}
        filters={[
          {
            field: 'keyword',
            label: '提现单号/员工姓名',
            type: 'input',
            placeholder: '提现单号/员工姓名',
          },
          {
            field: 'status',
            label: '状态',
            type: 'select',
            placeholder: '状态',
            options: [
              { label: '待审核', value: 0 },
              { label: '已打款', value: 1 },
              { label: '已驳回', value: 2 },
            ],
          },
        ]}
      />

      <Modal
        title={t('提现审核')}
        visible={auditVisible}
        onCancel={() => setAuditVisible(false)}
        onOk={handleAuditSubmit}
        confirmLoading={auditLoading}
        width={480}
        okText={t('确认')}
        cancelText={t('取消')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('结果')}</div>
            <RadioGroup
              value={auditForm.status}
              onChange={(e) => setAuditForm({ ...auditForm, status: e.target.value })}
            >
              <Radio value={1}>{t('已打款')}</Radio>
              <Radio value={2}>{t('已驳回')}</Radio>
            </RadioGroup>
          </div>
          {auditForm.status === 1 ? (
            <div>
              <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('打款凭证')}</div>
              <Input
                placeholder={t('凭证图片 URL')}
                value={auditForm.paymentVoucher}
                onChange={(val) => setAuditForm({ ...auditForm, paymentVoucher: val })}
              />
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('驳回原因')}</div>
              <TextArea
                rows={3}
                value={auditForm.rejectReason}
                onChange={(val) => setAuditForm({ ...auditForm, rejectReason: val })}
              />
            </div>
          )}
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('备注')}</div>
            <TextArea
              rows={3}
              value={auditForm.adminRemark}
              onChange={(val) => setAuditForm({ ...auditForm, adminRemark: val })}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function DeliveryStaffWithdraw() {
  return <StaffWithdrawTable type="delivery" />;
}

export function ServerStaffWithdraw() {
  return <StaffWithdrawTable type="server" />;
}
