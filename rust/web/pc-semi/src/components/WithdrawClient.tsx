'use client';

/**
 * 余额提现（/member/account/raplytocard）
 *
 * 源码对照：view/pc/pages/member/account/Raplytocard.vue
 * 类名逐条照抄旧版模板，全部落在 `.mp-account-raplyto` 包裹层下（本页 <style scoped> 已被
 * scripts/gen-member-pages-scss.mjs 抽进 app/member-pages.scss）。
 *
 *   .info-row.mp-account-raplyto
 *     > .title-or-tabs > .tag-and-input > .tig-tabs（MemberTopMenu 五项）
 *     > .account-raplytocard-content > .form-container > .el-form.form-body
 *         .el-form-item × N：可用余额 / 提现方式(.card.selected) / 提现至(el-select) /
 *         InfoCard 的 .tips / 提现姓名 / 银行卡详情 / 提现金额 / 提现说明(.withdraw-desc) / 提交
 *
 * 请求层保持原样（config/base、memberCenter、withdrawApply/list、withdrawApply/apply 都未改）。
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';
import FormatPrice from './FormatPrice';
import MemberAccountTabs from './MemberAccountTabs';

import { useTranslation } from 'react-i18next';

interface AccountItem {
  accountId: number;
  accountType: number;
  accountName?: string;
  accountNo?: string;
  bankName?: string;
}

const TYPE_LABELS: Record<number, string> = { 1: '银行卡', 2: '支付宝', 3: '微信' };

/** 旧版 Raplytocard.vue：提现金额上限 12300 */
const MAX_WITHDRAW_AMOUNT = 12300;

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
        // 旧版 commonStore.memberWithdrawalReceiptMethod（Java SettingsEnum 同名，
        // Rust config_client.rs::member_withdrawal_receipt_method 同源）
        const rawMethods = config.memberWithdrawalReceiptMethod ?? config.memberWithdrawalMethod;
        if (rawMethods) {
          const list = Array.isArray(rawMethods)
            ? rawMethods.map((item: unknown) => Number(item))
            : String(rawMethods)
                .replace(/^\[|\]$/g, '')
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
    if (!selected) return Toast.error({ content: t('请先添加并选择提现账户') });
    // 旧版 Raplytocard.vue amountRules：必填 + 0-12300 两位小数 + 不高于可用余额
    const amountText = amount.trim();
    if (!amountText) return Toast.error({ content: t('请输入提现金额') });
    if (!/^(0|\d{0,9})(\.\d{1,2})?$/.test(amountText)) {
      return Toast.error({ content: t('提现金额必须大于0，且最多保留两位小数') });
    }
    const amountValue = Number(amountText);
    if (amountValue <= 0) return Toast.error({ content: t('提现金额必须大于0，且最多保留两位小数') });
    if (amountValue > MAX_WITHDRAW_AMOUNT) {
      return Toast.error({ content: t('提现金额不能高于可用余额') });
    }
    if (amountValue > Number(balance || 0)) {
      return Toast.error({ content: t('提现金额不能高于可用余额') });
    }
    setSubmitting(true);
    try {
      await apiPost('user/withdrawApply/apply', {
        accountData: {
          accountType: selected.accountType,
          accountNo: selected.accountNo,
          accountName: selected.accountName,
          bankName: selected.bankName,
        },
        amount: amountValue,
      });
      Toast.success({ content: t('提现申请已提交') });
      setAmount('');
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('提现申请失败') });
    } finally {
      setSubmitting(false);
    }
  };

  const accountPlaceholder = TYPE_LABELS[type] || t('提现');

  return (
    <div className="info-row mp-account-raplyto">
      <MemberAccountTabs current="/member/account/raplytocard" />

      <div className="account-raplytocard-content">
        <div className="form-container">
          {!withdrawalEnabled ? (
            <div className="empty-method">
              {t('会员余额提现功能已关闭')}
              <Link className="font-color ml10" href="/member/account/detail">{t('返回账户明细')}</Link>
            </div>
          ) : (
            <div className="el-form form-body">
              <div className="el-form-item">
                <label className="el-form-item__label">{t('可用余额')}：</label>
                <div className="el-form-item__content">
                  <FormatPrice value={balance} fontSize="16px" className="mp-withdraw-balance" />
                </div>
              </div>

              <div className="el-form-item">
                <label className="el-form-item__label">{t('提现方式')}：</label>
                <div className="el-form-item__content">
                  {methods.length ? (
                    <div style={{ display: 'flex', gap: 10 }}>
                      {methods.map((value) => (
                        <div
                          key={value}
                          className={`card${type === value ? ' selected' : ''}`}
                          onClick={() => setType(value)}
                        >
                          <div>{t(TYPE_LABELS[value] || '提现')}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-method">{t('暂无可用提现方式，请联系客服')}</div>
                  )}
                </div>
              </div>

              <div className="el-form-item">
                <label className="el-form-item__label">{t('提现至')}：</label>
                <div className="el-form-item__content">
                  <div className="el-select">
                    <select
                      className="el-select__wrapper"
                      value={selected?.accountNo || ''}
                      onChange={(event) => {
                        const next = accounts.find((item) => item.accountNo === event.target.value) || null;
                        setSelected(next);
                      }}
                      aria-label={`${t('请选择')}${accountPlaceholder}${t('账号')}`}
                    >
                      <option value="">{`${t('请选择')}${accountPlaceholder}${t('账号')}`}</option>
                      {accounts.map((item) => (
                        <option key={item.accountId} value={item.accountNo || ''}>
                          {mask(item.accountNo)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="el-form-item">
                <label className="el-form-item__label" />
                <div className="el-form-item__content">
                  <div className="tips">
                    {`${t('当前')}${accountPlaceholder}${t('账号已不用')}`}？
                    <Link className="font-color" href="/member/account/cardmanagement" style={{ cursor: 'pointer' }}>
                      {t('点击这里，去添加新的')}
                    </Link>
                    {accountPlaceholder}{t('账号')}。
                  </div>
                </div>
              </div>

              <div className="el-form-item">
                <label className="el-form-item__label">{t('提现姓名')}：</label>
                <div className="el-form-item__content">
                  <input
                    className="el-input__inner"
                    value={selected?.accountName || ''}
                    readOnly
                    placeholder={`${t('请选择')}${accountPlaceholder}${t('账号')}`}
                  />
                </div>
              </div>

              {type === 1 ? (
                <div className="el-form-item">
                  <label className="el-form-item__label">{t('银行卡详情')}：</label>
                  <div className="el-form-item__content">
                    <textarea
                      className="el-textarea__inner"
                      value={selected?.bankName || ''}
                      readOnly
                      rows={4}
                      placeholder={t('银行卡详情')}
                    />
                  </div>
                </div>
              ) : null}

              <div className="el-form-item">
                <label className="el-form-item__label">{t('提现金额')}：</label>
                <div className="el-form-item__content">
                  <input
                    className="el-input__inner"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder={t('提现金额')}
                    inputMode="decimal"
                  />
                </div>
              </div>

              {description ? (
                <div className="el-form-item withdraw-desc-item">
                  <label className="el-form-item__label">{t('提现说明')}：</label>
                  <div className="el-form-item__content">
                    <div className="withdraw-desc" dangerouslySetInnerHTML={{ __html: description }} />
                  </div>
                </div>
              ) : null}

              <div className="el-form-item">
                <label className="el-form-item__label" />
                <div className="el-form-item__content">
                  <button
                    type="button"
                    className="mp-el-button mp-el-button--primary mp-el-button--large"
                    disabled={!accounts.length || submitting || loading}
                    onClick={() => void submit()}
                  >
                    {t('提交')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
