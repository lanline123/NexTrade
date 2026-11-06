'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Modal, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

interface AccountCard {
  accountId: number;
  accountType: number;
  accountName?: string;
  identity?: string;
  accountNo?: string;
  bankName?: string;
}

const TYPE_LABELS: Record<number, string> = { 1: '银行卡', 2: '支付宝', 3: '微信' };

function mask(value?: string): string {
  if (!value) return '-';
  if (value.length < 7) return value;
  return `${value.slice(0, 2)}${'*'.repeat(value.length - 6)}${value.slice(-4)}`;
}

export default function CardManagementClient() {
  const [type, setType] = useState(1);
  const [rows, setRows] = useState<AccountCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ accountName: '', accountNo: '', bankName: '', identity: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    apiGet<{ records?: AccountCard[] }>('user/withdrawApply/list', { page: 1, accountType: type })
      .then((result) => setRows(Array.isArray(result?.records) ? result.records : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [type]);

  const add = async () => {
    if (!form.accountName.trim() || !form.accountNo.trim()) return Toast.error({ content: '请输入姓名和账号' });
    setSaving(true);
    try {
      await apiPost('user/withdrawApply/createAccount', {
        accountType: type,
        accountName: form.accountName.trim(),
        accountNo: form.accountNo.trim(),
        identity: form.identity.trim() || undefined,
        bankName: type === 1 ? form.bankName.trim() : '',
      });
      Toast.success({ content: '添加成功' });
      setOpen(false);
      setForm({ accountName: '', accountNo: '', bankName: '', identity: '' });
      load();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '添加失败' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: AccountCard) => {
    if (!window.confirm('确认删除这张卡吗？')) return;
    try {
      await apiPost('user/withdrawApply/delAccount', { accountId: item.accountId });
      Toast.success({ content: '已删除' });
      load();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '删除失败' });
    }
  };

  return (
    <Card className="member-card" loading={loading}>
      <div className="card-tabs">
        {[1, 2, 3].map((value) => (
          <button key={value} type="button" className={type === value ? 'is-active' : ''} onClick={() => setType(value)}>{TYPE_LABELS[value]}</button>
        ))}
        <Button theme="solid" type="primary" onClick={() => setOpen(true)}>添加新卡</Button>
      </div>
      <table className="account-table">
        <thead><tr><th>真实姓名</th><th>身份证号码</th><th>账户号码</th>{type === 1 ? <th>银行卡详情</th> : null}<th>操作</th></tr></thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.accountId}>
              <td>{item.accountName || '-'}</td>
              <td>{mask(item.identity)}</td>
              <td>{mask(item.accountNo)}</td>
              {type === 1 ? <td>{item.bankName || '-'}</td> : null}
              <td><button type="button" className="link-danger" onClick={() => void remove(item)}>删除</button></td>
            </tr>
          ))}
          {!rows.length ? <tr><td colSpan={type === 1 ? 5 : 4} className="account-empty">暂无卡片</td></tr> : null}
        </tbody>
      </table>

      <Modal title="添加新卡" visible={open} onCancel={() => setOpen(false)} onOk={() => void add()} confirmLoading={saving} okText="保存">
        <div className="security-form">
          <label>真实姓名</label>
          <input value={form.accountName} onChange={(event) => setForm({ ...form, accountName: event.target.value })} placeholder="请输入真实姓名" />
          <label>{TYPE_LABELS[type]}账号</label>
          <input value={form.accountNo} onChange={(event) => setForm({ ...form, accountNo: event.target.value })} placeholder={`请输入${TYPE_LABELS[type]}账号`} />
          <label>身份证号（选填）</label>
          <input value={form.identity} onChange={(event) => setForm({ ...form, identity: event.target.value })} placeholder="请输入身份证号" />
          {type === 1 ? (
            <>
              <label>银行卡详情</label>
              <input value={form.bankName} onChange={(event) => setForm({ ...form, bankName: event.target.value })} placeholder="请输入开户行等银行卡详情" />
            </>
          ) : null}
        </div>
      </Modal>
    </Card>
  );
}
