import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import { useI18n } from '../i18n';

interface StaffWalletLogRow {
  logId: number;
  staffId?: number;
  staffName?: string;
  amount?: number | string;
  balanceAfter?: number | string;
  businessType?: number;
  type?: number;
  remark?: string;
  createTime?: string;
}

const typeText: Record<number, string> = {
  1: '服务费入账',
  2: '提现打款',
  3: '扣减',
  4: '提现申请',
  5: '提现驳回',
};

function BusinessTypeText({ value }: { value: number }) {
  const { t } = useI18n();
  return <>{value === 2 ? t('服务员') : t('配送员')}</>;
}

function WalletTypeText({ value }: { value: number }) {
  const { t } = useI18n();
  return <>{typeText[value] ? t(typeText[value]) : String(value)}</>;
}

const columns: ColumnConfig<StaffWalletLogRow>[] = [
  { title: '流水ID', dataIndex: 'logId', width: 100 },
  {
    title: '员工',
    dataIndex: 'staffName',
    width: 150,
    render: (value: string, record) => value || record.staffId || '-',
  },
  {
    title: '金额',
    dataIndex: 'amount',
    width: 150,
    render: (value: number | string) => (
      <span style={{ color: Number(value) > 0 ? '#fa8c16' : '#333' }}>{value}</span>
    ),
  },
  { title: '变动后余额', dataIndex: 'balanceAfter', width: 140 },
  {
    title: '业务类型',
    dataIndex: 'businessType',
    width: 130,
    render: (value: number) => <BusinessTypeText value={value} />,
  },
  {
    title: '类型',
    dataIndex: 'type',
    width: 140,
    render: (value: number) => <WalletTypeText value={value} />,
  },
  { title: '备注', dataIndex: 'remark', render: (value: string) => value || '-' },
  { title: '时间', dataIndex: 'createTime', width: 180, render: (value: string) => value || '-' },
];

export default function StaffWalletLogs() {
  return (
    <ListPage<StaffWalletLogRow>
      api="/finance/staffFundWalletLog/list"
      rowKey="logId"
      pageSize={10}
      filters={[
        {
          field: 'businessType',
          label: '业务类型',
          type: 'select',
          width: 160,
          options: [
            { label: '配送服务费', value: 1 },
            { label: '服务员服务费', value: 2 },
          ],
        },
      ]}
      columns={columns}
    />
  );
}
