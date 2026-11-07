'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card } from '@douyinfe/semi-ui';
import { apiGet } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
interface AccountLog {
  logId?: number;
  amount?: string;
  type?: string;
  postscript?: string;
  statusType?: string;
  addTime?: string;
  beforeBalance?: number;
  afterBalance?: number;
  changeTypeName?: string;
  changeDesc?: string;
}

export default function BalanceClient() {
    const { t } = useTranslation();
  const [balance, setBalance] = useState(0);
  const [rows, setRows] = useState<AccountLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);

  useEffect(() => {
    Promise.all([
      apiGet<{ balance?: number }>('user/user/detail'),
      apiGet<{ records?: AccountLog[] }>('user/account/list', { page: 1, size: 30 }),
    ])
      .then(([profile, logs]) => {
        setBalance(Number(profile.balance || 0));
        setRows(logs.records || []);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : '';
        setNeedLogin(message.includes('登录') || message.includes('401'));
      })
      .finally(() => setLoading(false));
  }, []);

  if (needLogin) {
    return <Card className="cart-state"><h2>{t('登录后查看余额')}</h2><Link href="/login?redirect=/member/balance"><Button theme="solid" type="primary" size="large">{t('去登录')}</Button></Link></Card>;
  }

  return (
    <div className="member-balance">
      <Card className="member-points__summary">
        <span>{t('账户余额')}</span>
        <b>¥ {balance.toFixed(2)}</b>
      </Card>
      <Card className="member-card" title={t('余额明细')}>
        {loading ? (
          <p>{t('余额记录加载中...')}</p>
        ) : rows.length ? (
          <div className="member-points__list">
            {rows.map((row, index) => (
              <div key={row.logId || index} className="member-points__row">
                <div>
                  <b>{row.type || row.changeTypeName || row.changeDesc || t('余额变动')}</b>
                  <span>{row.addTime} {row.postscript ? `· ${row.postscript}` : ''}</span>
                </div>
                <b className={Number(row.amount) >= 0 ? 'is-plus' : 'is-minus'}>
                  {Number(row.amount) >= 0 ? '+' : ''}¥ {Number(row.amount || 0).toFixed(2)}
                </b>
              </div>
            ))}
          </div>
        ) : (
          <p>{t('暂无余额记录')}</p>
        )}
      </Card>
    </div>
  );
}
