'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
  const [type, setType] = useState(1);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [selected, setSelected] = useState<AccountItem | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [balance, setBalance] = useState(0);
  /** 源码读取 config/base：会员提现开关、可用提现方式、提现说明（富文本） */
  const [withdrawalEnabled, setWithdrawalEnabled] = useState(true);
  const [methods, setMethods] = useState<number[]>([1, 2, 3]);
  const [description, setDescription] = useState('');

  useEffect(() => {
    fetch('/api/common/config/base')
      .then((response) => response.json())
      .then((json) => {
        const config = json?.data || json || {};
        if (config.memberWithdrawalEnabled !== undefined) {
          setWithdrawalEnabled(Number(config.memberWithdrawalEnabled) === 1);
        }
        const rawMethods = config.memberWithdrawalMethod ?? config.memberWithdrawalMethods;
        if (rawMethods) {
          const list = String(rawMethods)
            .split(',')
            .map((item) => Number(String(item).trim()))
            .filter((item) => [1, 2, 3].includes(item));
          if (list.length) {
            setMethods(list);
            setType((current) => (list.includes(current) ? current : list[0]));
          }
        }
        const html = String(config.memberWithdrawalDescription || '');
        if (html) setDescription(html);
      })
      .catch(() => undefined);
  }, []);

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
      {!withdrawalEnabled ? (
        <div className="withdraw-disabled">
          <p>{t('会员余额提现功能已关闭。')}</p>
          <a href="/member/account/detail">{t('返回账户余额')}</a>
        </div>
      ) : null}
      <div className="withdraw-balance" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '12px 16px', borderRadius: 12, background: '#fff' }}>
        <span>{t('可提现余额')}</span>
        <b style={{ color: 'var(--price)', fontSize: 20 }}>¥ {balance.toFixed(2)}</b>
      </div>
      <div className="withdraw-types">
        {methods.map((value) => (
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
        <label>{t('提现金额')}</label>
        <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={t('请输入提现金额')} inputMode="decimal" />
        {description ? (
          <div className="withdraw-desc" dangerouslySetInnerHTML={{ __html: description }} />
        ) : null}
        <div style={{ display: 'flex', gap: 10 }}>
          <Button theme="solid" type="primary" disabled={!accounts.length || !withdrawalEnabled} loading={submitting} onClick={() => void submit()}>{t('提交提现申请')}</Button>
          <Button onClick={() => setAmount(balance > 0 ? balance.toFixed(2) : '')}>{t('全部提现')}</Button>
          <Button onClick={() => { window.location.href = '/member/account/cardManagement'; }}>{t('管理提现账户')}</Button>
        </div>
      </div>
    </Card>
  );
}
