'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

interface AccountItem {
  accountId: number;
  accountType: number;
  accountName?: string;
  accountNo?: string;
  bankName?: string;
}

const TYPE_LABELS: Record<number, string> = { 1: '银行卡', 2: '支付宝', 3: '微信' };

function mask(value?: string): string {
  if (!value) return '-';
  if (value.length < 7) return value;
  return `${value.slice(0, 2)}${'*'.repeat(value.length - 6)}${value.slice(-4)}`;
}

export default function WithdrawClient() {
  const [type, setType] = useState(1);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [selected, setSelected] = useState<AccountItem | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    apiGet<{ balance?: number | string }>('user/user/memberCenter')
      .then((result) => setBalance(Number(result?.balance || 0)))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoading(true);
    apiGet<{ records?: AccountItem[] }>('user/withdrawApply/list', { page: 1, accountType: type })
      .then((result) => {
        const list = Array.isArray(result?.records) ? result.records : [];
        setAccounts(list);
        setSelected(list[0] || null);
      })
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false));
  }, [type]);

  const submit = async () => {
    if (!selected) return Toast.error({ content: '请先添加并选择提现账户' });
    if (!amount || Number(amount) <= 0) return Toast.error({ content: '请输入提现金额' });
    setSubmitting(true);
    try {
      await apiPost('user/withdrawApply/apply', {
        accountData: {
          accountType: selected.accountType,
          accountNo: selected.accountNo,
          accountName: selected.accountName,
          bankName: selected.bankName,
        },
        amount: Number(amount),
      });
      Toast.success({ content: '提现申请已提交' });
      setAmount('');
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '提现申请失败' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="member-card withdraw-card" loading={loading}>
      <div className="withdraw-balance" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '12px 16px', borderRadius: 12, background: '#fff' }}>
        <span>可提现余额</span>
        <b style={{ color: '#e1251b', fontSize: 20 }}>¥ {balance.toFixed(2)}</b>
      </div>
      <div className="withdraw-types">
        {[1, 2, 3].map((value) => (
          <button key={value} type="button" className={type === value ? 'is-active' : ''} onClick={() => setType(value)}>{TYPE_LABELS[value]}</button>
        ))}
      </div>

      {accounts.length ? (
        <div className="withdraw-accounts">
          {accounts.map((account) => (
            <button
              key={account.accountId}
              type="button"
              className={`withdraw-account${selected?.accountId === account.accountId ? ' is-active' : ''}`}
              onClick={() => setSelected(account)}
            >
              <b>{account.accountName || TYPE_LABELS[account.accountType]}</b>
              <span>{mask(account.accountNo)}</span>
              {account.bankName ? <small>{account.bankName}</small> : null}
            </button>
          ))}
        </div>
      ) : (
        <div className="withdraw-empty">暂无{TYPE_LABELS[type]}账户，请先在卡管理中绑定。</div>
      )}

      <div className="security-form withdraw-form">
        <label>提现金额</label>
        <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="请输入提现金额" inputMode="decimal" />
        <div style={{ display: 'flex', gap: 10 }}>
          <Button theme="solid" type="primary" disabled={!accounts.length} loading={submitting} onClick={() => void submit()}>提交提现申请</Button>
          <Button onClick={() => setAmount(balance > 0 ? balance.toFixed(2) : '')}>全部提现</Button>
        </div>
      </div>
    </Card>
  );
}
