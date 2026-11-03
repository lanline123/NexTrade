import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import { useI18n } from '../i18n';

interface BalanceLogRow {
  logId: number;
  changeTime?: string;
  username?: string;
  changeDesc?: string;
  balance?: number | string;
  changeType?: number;
  afterBalance?: number | string;
  frozenBalance?: number | string;
  afterFrozenBalance?: number | string;
}

function Amount({
  value,
  type,
  after,
}: {
  value?: number | string;
  type?: number;
  after?: number | string;
}) {
  const { t } = useI18n();
  const color = type === 1 ? '#1677ff' : type === 2 ? '#f5222d' : undefined;
  const prefix = type === 1 ? '+' : type === 2 ? '-' : '';
  return (
    <div>
      <span style={{ color }}>{prefix}{value ?? 0}</span>
      {after !== undefined && (
        <div className="text-muted" style={{ fontSize: 12 }}>
          {t('变更后：')}{after}
        </div>
      )}
    </div>
  );
}

const columns: ColumnConfig<BalanceLogRow>[] = [
  { title: '账户变动时间', dataIndex: 'changeTime', width: 180 },
  { title: '会员用户名', dataIndex: 'username', width: 150 },
  { title: '账户变动原因', dataIndex: 'changeDesc', render: (value: string) => value || '-' },
  {
    title: '变动资金账户',
    dataIndex: 'balance',
    width: 200,
    render: (value: number | string, record) => (
      <Amount value={value} type={record.changeType} after={record.afterBalance} />
    ),
  },
  {
    title: '冻结资金账户',
    dataIndex: 'frozenBalance',
    width: 200,
    render: (value: number | string, record) => (
      <Amount value={value} type={record.changeType} after={record.afterFrozenBalance} />
    ),
  },
];

export default function BalanceLogs() {
  return (
    <ListPage<BalanceLogRow>
      api="/finance/userBalanceLog/list"
      rowKey="logId"
      pageSize={10}
      filters={[
        {
          field: 'keyword',
          label: '变动原因',
          type: 'input',
          placeholder: '输入账户变动原因',
          width: 240,
        },
        {
          field: 'username',
          label: '会员',
          type: 'input',
          placeholder: '输入会员用户名',
          width: 200,
        },
      ]}
      columns={columns}
    />
  );
}
