import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Empty,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  TextArea,
  Toast,
} from '@douyinfe/semi-ui';
import { IconPlus } from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '../../api';
import { useI18n } from '../../i18n';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';

/**
 * 商户端 / 供应商端 自助资金页（26 个资金页 + 孤儿域资金部分）。
 *
 * 旧版两端口径完全对称（java view/admin api/merchant/capitalfund 与 api/vendor/finance），
 * Rust 端点也已全量迁移：
 * - 商户：merchant/shopAccount/index|logList、merchant/shopWithdraw/config|create|list|dualBalance|detail、
 *   merchant/account/*、deposit/shop/*、deposit/recharge|refund/apply
 * - 供应商：vendor/vendorAccount/*（无 create/update，账户只读+删）、vendor/vendorWithdraw/*、
 *   vendor/adminVendorAccount/index|listFund|logList、deposit/vendor/*
 * 因此用参数化工厂组件，一套实现挂两端。
 */

const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? `¥${n.toFixed(2)}` : '--';
};

/* ------------------------------- 资产总览（dashboard） ------------------------------ */

export function makeCapitalOverview(config: { indexApi: string; logApi: string; titleKey: string }) {
  return function CapitalOverview() {
    const { t } = useI18n();
    const [summary, setSummary] = useState<Record<string, any> | null>(null);
    const [rows, setRows] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      apiGet<Record<string, any>>(config.indexApi, {})
        .then(setSummary)
        .catch(() => setSummary(null));
    }, [config.indexApi]);

    const load = (p = 1) => {
      setLoading(true);
      apiGet<{ records: any[]; total: number }>(config.logApi, { page: p, size: 10 })
        .then((res) => {
          setRows(res.records || []);
          setTotal(res.total || 0);
        })
        .catch((e) => Toast.error({ content: e.message }))
        .finally(() => setLoading(false));
    };

    useEffect(() => {
      load(1);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config.logApi]);

    const cards: Array<{ label: string; value: string; color?: string }> = [
      { label: t('可用余额'), value: money(summary?.balance ?? summary?.shopMoney ?? summary?.shop_money), color: 'var(--semi-color-primary)' },
      { label: t('冻结金额'), value: money(summary?.frozenMoney ?? summary?.frozen_money) },
      { label: t('累计提现'), value: money(summary?.withdrawnAmount ?? summary?.withdrawn_amount) },
      { label: t('提现中'), value: money(summary?.pendingWithdrawAmount ?? summary?.pending_withdraw_amount) },
    ];

    return (
      <div style={{ padding: 20 }}>
        <Row gutter={16} style={{ marginBottom: 20 }}>
          {cards.map((c) => (
            <Col span={6} key={c.label}>
              <Card>
                <span style={{ color: 'var(--semi-color-text-2)' }}>{c.label}</span>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 8, color: c.color }}>{c.value}</div>
              </Card>
            </Col>
          ))}
        </Row>
        <Table
          loading={loading}
          dataSource={rows}
          rowKey={(r?: any) => String(r.logId ?? r.id ?? Math.random())}
          empty={<Empty description={t('暂无流水')} />}
          pagination={{ currentPage: page, pageSize: 10, total, onPageChange: (p) => { setPage(p); load(p); } }}
          columns={[
            { title: t('变动说明'), dataIndex: 'changeDesc' },
            { title: t('变动类型'), dataIndex: 'changeType', width: 110, render: (v: any) => <Tag color={Number(v) === 1 ? 'green' : 'red'}>{Number(v) === 1 ? t('收入') : t('支出')}</Tag> },
            { title: t('变动前'), dataIndex: 'beforeBalance', width: 120, render: money },
            { title: t('变动金额'), dataIndex: 'balance', width: 120, render: money },
            { title: t('变动后'), dataIndex: 'afterBalance', width: 120, render: money },
            { title: t('时间'), dataIndex: 'changeTime', width: 170 },
          ] as ColumnProps<any>[]}
        />
      </div>
    );
  };
}

/* ------------------------------- 余额明细（balance） ------------------------------ */

export function makeBalanceLogPage(config: { logApi: string; filters?: boolean }) {
  return function BalanceLogPage() {
    const { t } = useI18n();
    const [rows, setRows] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [keyword, setKeyword] = useState('');
    const [walletType, setWalletType] = useState<string>();

    const load = (p = 1) => {
      setLoading(true);
      apiGet<{ records: any[]; total: number }>(config.logApi, {
        page: p,
        size: 15,
        keyword: keyword || undefined,
        walletType: walletType || undefined,
      })
        .then((res) => {
          setRows(res.records || []);
          setTotal(res.total || 0);
        })
        .catch((e) => Toast.error({ content: e.message }))
        .finally(() => setLoading(false));
    };

    return (
      <div style={{ padding: 20 }}>
        <Space style={{ marginBottom: 16 }}>
          <Input style={{ width: 200 }} value={keyword} onChange={setKeyword} placeholder={t('关键词')} />
          {config.filters && (
            <Select style={{ width: 160 }} value={walletType} showClear placeholder={t('钱包类型')}
              optionList={[
                { value: '1', label: t('余额') },
                { value: '2', label: t('积分') },
              ]}
              onChange={(v) => setWalletType(v as string)}
            />
          )}
          <Button type="primary" onClick={() => { setPage(1); load(1); }}>{t('搜索')}</Button>
        </Space>
        <Table
          loading={loading}
          dataSource={rows}
          rowKey={(r?: any) => String(r.logId ?? r.id ?? Math.random())}
          empty={<Empty description={t('暂无数据')} />}
          pagination={{ currentPage: page, pageSize: 15, total, onPageChange: (p) => { setPage(p); load(p); } }}
          columns={[
            { title: t('变动说明'), dataIndex: 'changeDesc' },
            { title: t('变动类型'), dataIndex: 'changeType', width: 100, render: (v: any) => <Tag color={Number(v) === 1 ? 'green' : 'red'}>{Number(v) === 1 ? t('收入') : t('支出')}</Tag> },
            { title: t('变动金额'), dataIndex: 'balance', width: 130, render: money },
            { title: t('变动后余额'), dataIndex: 'afterBalance', width: 130, render: money },
            { title: t('时间'), dataIndex: 'changeTime', width: 170 },
          ] as ColumnProps<any>[]}
        />
      </div>
    );
  };
}

/* ------------------------------- 收款账户（account list） ------------------------------ */

export interface AccountPageConfig {
  listApi: string;
  detailApi?: string;
  createApi?: string;
  updateApi?: string;
  delApi?: string;
  configApi?: string;
}

export function makeAccountListPage(config: AccountPageConfig) {
  return function AccountListPage() {
    const { t } = useI18n();
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<any | null>(null);
    const [creating, setCreating] = useState(false);
    const [detail, setDetail] = useState<any | null>(null);
    const [form, setForm] = useState<Record<string, any>>({});
    const readOnly = !config.createApi;

    const load = () => {
      setLoading(true);
      apiGet<{ records?: any[] } | any[]>(config.listApi, {})
        .then((res) => setRows(Array.isArray(res) ? res : res.records || []))
        .catch((e) => Toast.error({ content: e.message }))
        .finally(() => setLoading(false));
    };

    useEffect(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config.listApi]);

    const openEdit = async (row: any) => {
      if (config.detailApi) {
        try {
          const d = await apiGet<any>(config.detailApi, { id: row.id ?? row.accountId ?? row.vendorAccountId ?? row.shopAccountId });
          setEditing(d);
          setForm({ ...d });
        } catch {
          setEditing(row);
          setForm({ ...row });
        }
      } else {
        setEditing(row);
        setForm({ ...row });
      }
    };

    const save = async () => {
      try {
        if (editing && config.updateApi) {
          await apiPost(config.updateApi, form);
        } else if (config.createApi) {
          await apiPost(config.createApi, form);
        }
        Toast.success({ content: t('保存成功') });
        setEditing(null);
        setCreating(false);
        setForm({});
        load();
      } catch (e) {
        Toast.error({ content: e instanceof Error ? e.message : t('保存失败') });
      }
    };

    const remove = async (row: any) => {
      if (!config.delApi) return;
      try {
        await apiPost(config.delApi, { id: row.id ?? row.accountId ?? row.vendorAccountId ?? row.shopAccountId });
        Toast.success({ content: t('删除成功') });
        load();
      } catch (e) {
        Toast.error({ content: e instanceof Error ? e.message : t('删除失败') });
      }
    };

    const idOf = (row: any) => row.id ?? row.accountId ?? row.vendorAccountId ?? row.shopAccountId;

    const accountColumns: ColumnProps<any>[] = [
      { title: 'ID', dataIndex: 'id', width: 70, render: (_: any, r: any) => idOf(r) },
      { title: t('开户人'), dataIndex: 'name', render: (v: any, r: any) => v || r.bankUserName || r.realName || '-' },
      { title: t('开户银行'), dataIndex: 'bankName', render: (v: any) => v || '-' },
      { title: t('银行账号'), dataIndex: 'cardNumber', render: (v: any, r: any) => v || r.bankNumber || r.account || '-' },
      { title: t('状态'), dataIndex: 'status', width: 90, render: (v: any) => <Tag color={Number(v) === 1 ? 'green' : 'grey'}>{Number(v) === 1 ? t('启用') : t('停用')}</Tag> },
      {
        title: t('操作'),
        width: 200,
        render: (_: any, r: any) => (
          <Space>
            <Button theme="borderless" type="primary" onClick={() => setDetail(r)}>{t('详情')}</Button>
            {!readOnly && <Button theme="borderless" type="primary" onClick={() => openEdit(r)}>{t('编辑')}</Button>}
            {config.delApi && (
              <Popconfirm title={t('确认删除该账户？')} onConfirm={() => remove(r)}>
                <Button theme="borderless" type="danger">{t('删除')}</Button>
              </Popconfirm>
            )}
          </Space>
        ),
      },
    ];

    const formFields: Array<{ key: string; label: string; type?: 'input' | 'number' }> = [
      { key: 'name', label: t('开户人') },
      { key: 'bankName', label: t('开户银行') },
      { key: 'cardNumber', label: t('银行账号') },
      { key: 'branch', label: t('开户支行') },
    ];

    return (
      <div style={{ padding: 20 }}>
        <Space style={{ marginBottom: 16 }}>
          {!readOnly && (
            <Button theme="solid" icon={<IconPlus />} onClick={() => { setCreating(true); setEditing(null); setForm({ status: 1 }); }}>{t('添加收款账户')}</Button>
          )}
          {readOnly && <span style={{ color: 'var(--semi-color-text-2)' }}>{t('供应商收款账户由平台侧维护，此处仅查看')}</span>}
        </Space>
        <Table loading={loading} dataSource={rows} rowKey={(r?: any) => String(idOf(r) ?? Math.random())} columns={accountColumns} empty={<Empty description={t('暂无数据')} />} pagination={false} />

        <Modal
          title={editing ? t('编辑收款账户') : t('添加收款账户')}
          visible={creating || !!editing}
          onOk={save}
          onCancel={() => { setEditing(null); setCreating(false); }}
          width={480}
          okText={t('提交')}
          cancelText={t('取消')}
        >
          <div style={{ display: 'grid', gap: 12 }}>
            {formFields.map((f) => (
              <label key={f.key} style={{ display: 'grid', gap: 4 }}>
                <span>{f.label}</span>
                <Input value={form[f.key] ?? ''} onChange={(v) => setForm({ ...form, [f.key]: v })} />
              </label>
            ))}
          </div>
        </Modal>

        <Modal title={t('账户详情')} visible={!!detail} onCancel={() => setDetail(null)} footer={null} width={480}>
          {detail && (
            <div style={{ display: 'grid', gap: 8 }}>
              {Object.entries({
                ID: idOf(detail),
                [t('开户人')]: detail.name || detail.bankUserName,
                [t('开户银行')]: detail.bankName,
                [t('银行账号')]: detail.cardNumber || detail.bankNumber,
                [t('开户支行')]: detail.branch,
                [t('备注')]: detail.remark,
              }).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 12 }}>
                  <span style={{ width: 90, color: 'var(--semi-color-text-2)', flexShrink: 0 }}>{k}</span>
                  <span>{(v as any) || '-'}</span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      </div>
    );
  };
}

/* ------------------------------- 提现（withdraw） ------------------------------ */

export function makeWithdrawPage(config: { configApi: string; createApi: string; listApi: string; dualBalanceApi?: string }) {
  return function WithdrawPage() {
    const { t } = useI18n();
    const [rows, setRows] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [balance, setBalance] = useState<any>(null);
    const [applyOpen, setApplyOpen] = useState(false);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [form, setForm] = useState<{ accountId?: string; amount?: number; remark: string }>({ remark: '' });
    const [saving, setSaving] = useState(false);
    const [detail, setDetail] = useState<any | null>(null);

    const load = (p = 1) => {
      setLoading(true);
      apiGet<{ records: any[]; total: number }>(config.listApi, { page: p, size: 15 })
        .then((res) => {
          setRows(res.records || []);
          setTotal(res.total || 0);
        })
        .catch((e) => Toast.error({ content: e.message }))
        .finally(() => setLoading(false));
    };

    useEffect(() => {
      load(1);
      if (config.dualBalanceApi) {
        apiGet<any>(config.dualBalanceApi, {}).then(setBalance).catch(() => setBalance(null));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config.listApi]);

    const openApply = async () => {
      setForm({ remark: '' });
      setApplyOpen(true);
      try {
        const res = await apiGet<{ records?: any[] } | any[]>(config.listApi.replace(/\/list$/, '') === config.listApi ? config.configApi : config.configApi, {});
        void res;
      } catch { /* config 可选 */ }
      // 收款账户下拉：复用各端账户列表
      const accountApi = config.createApi.includes('shopWithdraw') ? '/merchant/account/list' : '/vendor/vendorAccount/list';
      apiGet<{ records?: any[] } | any[]>(accountApi, {})
        .then((res) => setAccounts(Array.isArray(res) ? res : res.records || []))
        .catch(() => setAccounts([]));
    };

    const submit = async () => {
      if (!form.amount || form.amount <= 0) {
        Toast.warning({ content: t('请输入提现金额') });
        return;
      }
      if (!form.accountId) {
        Toast.warning({ content: t('请选择收款账户') });
        return;
      }
      setSaving(true);
      try {
        await apiPost(config.createApi, {
          merchantAccountId: Number(form.accountId),
          amount: form.amount,
          remark: form.remark,
          accountData: accounts.find((a) => String(a.id ?? a.accountId ?? a.vendorAccountId ?? a.shopAccountId) === form.accountId) || undefined,
        });
        Toast.success({ content: t('提现申请已提交') });
        setApplyOpen(false);
        load(1);
      } catch (e) {
        Toast.error({ content: e instanceof Error ? e.message : t('提交失败') });
      } finally {
        setSaving(false);
      }
    };

    const statusTag = (row: any) => {
      const s = Number(row.status);
      const color = s === 1 ? 'green' : s === 2 ? 'red' : 'orange';
      const text = row.statusText || (s === 1 ? t('已通过') : s === 2 ? t('已拒绝') : t('待审核'));
      return <Tag color={color}>{text}</Tag>;
    };

    return (
      <div style={{ padding: 20 }}>
        <Space style={{ marginBottom: 16 }}>
          <Button theme="solid" type="primary" icon={<IconPlus />} onClick={openApply}>{t('申请提现')}</Button>
          {balance && <span style={{ color: 'var(--semi-color-text-2)' }}>{t('可用余额')}：{money(balance.shopMoney ?? balance.shop_money)}</span>}
        </Space>
        <Table
          loading={loading}
          dataSource={rows}
          rowKey={(r?: any) => String(r.id ?? r.shopWithdrawId ?? r.vendorWithdrawId ?? Math.random())}
          empty={<Empty description={t('暂无提现记录')} />}
          pagination={{ currentPage: page, pageSize: 15, total, onPageChange: (p) => { setPage(p); load(p); } }}
          columns={[
            { title: 'ID', dataIndex: 'id', width: 70, render: (_: any, r: any) => r.id ?? r.shopWithdrawId ?? r.vendorWithdrawId },
            { title: t('提现金额'), dataIndex: 'amount', width: 130, render: money },
            { title: t('收款账户'), dataIndex: 'accountData', render: (v: any) => (v?.bankName ? `${v.bankName} ${v.cardNumber || ''}` : v?.name || '-') },
            { title: t('状态'), dataIndex: 'status', width: 100, render: (_: any, r: any) => statusTag(r) },
            { title: t('备注'), dataIndex: 'remark', render: (v: string) => v || '-' },
            { title: t('申请时间'), dataIndex: 'addTime', width: 170 },
            {
              title: t('操作'),
              width: 90,
              render: (_: any, r: any) => <Button theme="borderless" type="primary" onClick={() => setDetail(r)}>{t('详情')}</Button>,
            },
          ] as ColumnProps<any>[]}
        />
        <Modal title={t('申请提现')} visible={applyOpen} onOk={submit} onCancel={() => setApplyOpen(false)} width={480} okText={t('提交')} okButtonProps={{ loading: saving }} cancelText={t('取消')}>
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span>{t('收款账户')}</span>
              <Select
                style={{ width: '100%' }}
                placeholder={t('请选择收款账户')}
                optionList={accounts.map((a) => ({
                  value: String(a.id ?? a.accountId ?? a.vendorAccountId ?? a.shopAccountId),
                  label: `${a.name || a.bankUserName || '-'} ${a.bankName || ''} ${a.cardNumber || a.bankNumber || ''}`.trim(),
                }))}
                value={form.accountId}
                onChange={(v) => setForm({ ...form, accountId: v as string })}
              />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span>{t('提现金额')}</span>
              <InputNumber style={{ width: 200 }} min={0.01} precision={2} value={form.amount} onChange={(v) => setForm({ ...form, amount: v === '' || v === null || v === undefined ? undefined : Number(v) })} />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span>{t('备注')}</span>
              <TextArea rows={3} value={form.remark} onChange={(v: string) => setForm({ ...form, remark: v })} />
            </label>
          </div>
        </Modal>
        <Modal title={t('提现详情')} visible={!!detail} onCancel={() => setDetail(null)} footer={null} width={520}>
          {detail && (
            <div style={{ display: 'grid', gap: 8 }}>
              {Object.entries({
                ID: detail.id ?? detail.shopWithdrawId ?? detail.vendorWithdrawId,
                [t('提现金额')]: money(detail.amount),
                [t('状态')]: detail.statusText || detail.status,
                [t('收款账户')]: detail.accountData ? JSON.stringify(detail.accountData) : '-',
                [t('备注')]: detail.remark,
                [t('申请时间')]: detail.addTime,
                [t('打款凭证')]: detail.paymentVoucher ? <img src={detail.paymentVoucher} alt="" style={{ maxWidth: 200 }} /> : '-',
              }).map(([k, v], i) => (
                <div key={i} style={{ display: 'flex', gap: 12 }}>
                  <span style={{ width: 90, color: 'var(--semi-color-text-2)', flexShrink: 0 }}>{k as string}</span>
                  <span>{(v as any) || '-'}</span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      </div>
    );
  };
}

/* ------------------------------- 保证金（deposit） ------------------------------ */

export function makeDepositPage(config: {
  overviewApi: string;
  logApi: string;
  frozenApi?: string;
  rechargeApplyApi?: string;
  refundApplyApi?: string;
  payeeListApi?: string;
}) {
  return function DepositPage() {
    const { t } = useI18n();
    const [overview, setOverview] = useState<Record<string, any> | null>(null);
    const [rows, setRows] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'log' | 'frozen'>('log');
    const [rechargeOpen, setRechargeOpen] = useState(false);
    const [payees, setPayees] = useState<any[]>([]);
    const [form, setForm] = useState<{ amount?: number; payeeId?: string; remark: string }>({ remark: '' });
    const [saving, setSaving] = useState(false);

    const load = (p = 1) => {
      setLoading(true);
      const api = tab === 'log' ? config.logApi : config.frozenApi || config.logApi;
      apiGet<{ records: any[]; total: number }>(api, { page: p, size: 15 })
        .then((res) => {
          setRows(res.records || []);
          setTotal(res.total || 0);
        })
        .catch((e) => Toast.error({ content: e.message }))
        .finally(() => setLoading(false));
    };

    useEffect(() => {
      apiGet<Record<string, any>>(config.overviewApi, {}).then(setOverview).catch(() => setOverview(null));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config.overviewApi]);

    useEffect(() => {
      load(1);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    const openRecharge = () => {
      setForm({ remark: '' });
      setRechargeOpen(true);
      if (config.payeeListApi) {
        apiGet<{ records?: any[] } | any[]>(config.payeeListApi, {})
          .then((res) => setPayees(Array.isArray(res) ? res : res.records || []))
          .catch(() => setPayees([]));
      }
    };

    const submitRecharge = async () => {
      if (!config.rechargeApplyApi) return;
      if (!form.amount || form.amount <= 0) {
        Toast.warning({ content: t('请输入充值金额') });
        return;
      }
      setSaving(true);
      try {
        await apiPost(config.rechargeApplyApi, { amount: form.amount, payeeAccountId: form.payeeId ? Number(form.payeeId) : undefined, remark: form.remark });
        Toast.success({ content: t('充值申请已提交，等待平台审核') });
        setRechargeOpen(false);
        load(1);
      } catch (e) {
        Toast.error({ content: e instanceof Error ? e.message : t('提交失败') });
      } finally {
        setSaving(false);
      }
    };

    const cards = [
      { label: t('保证金余额'), value: money(overview?.balance ?? overview?.shopMoney) },
      { label: t('冻结金额'), value: money(overview?.frozenMoney ?? overview?.frozen_money) },
      { label: t('已缴金额'), value: money(overview?.paidAmount ?? overview?.totalAmount) },
      { label: t('应缴金额'), value: money(overview?.requiredAmount ?? overview?.ruleAmount) },
    ];

    const logColumns: ColumnProps<any>[] =
      tab === 'log'
        ? [
            { title: t('变动说明'), dataIndex: 'changeDesc', render: (v: any, r: any) => v || r.remark || r.desc || '-' },
            { title: t('变动金额'), dataIndex: 'amount', width: 130, render: (_: any, r: any) => money(r.amount ?? r.money ?? r.balance) },
            { title: t('类型'), dataIndex: 'type', width: 100, render: (v: any, r: any) => <Tag>{v ?? r.typeName ?? '-'}</Tag> },
            { title: t('时间'), dataIndex: 'changeTime', width: 170, render: (v: any, r: any) => v || r.addTime || r.createTime || '-' },
          ]
        : [
            { title: t('关联单号'), dataIndex: 'orderSn', render: (v: any, r: any) => v || r.orderId || r.sn || '-' },
            { title: t('冻结金额'), dataIndex: 'frozenMoney', width: 130, render: (_: any, r: any) => money(r.frozenMoney ?? r.money) },
            { title: t('原因'), dataIndex: 'reason', render: (v: any, r: any) => v || r.remark || '-' },
            { title: t('时间'), dataIndex: 'frozenTime', width: 170, render: (v: any, r: any) => v || r.addTime || '-' },
          ];

    return (
      <div style={{ padding: 20 }}>
        <Row gutter={16} style={{ marginBottom: 20 }}>
          {cards.map((c) => (
            <Col span={6} key={c.label}>
              <Card>
                <span style={{ color: 'var(--semi-color-text-2)' }}>{c.label}</span>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 8 }}>{c.value}</div>
              </Card>
            </Col>
          ))}
        </Row>
        <Space style={{ marginBottom: 16 }}>
          <Button type={tab === 'log' ? 'primary' : 'tertiary'} onClick={() => setTab('log')}>{t('保证金流水')}</Button>
          {config.frozenApi && <Button type={tab === 'frozen' ? 'primary' : 'tertiary'} onClick={() => setTab('frozen')}>{t('冻结明细')}</Button>}
          {config.rechargeApplyApi && <Button theme="solid" icon={<IconPlus />} onClick={openRecharge}>{t('申请充值')}</Button>}
        </Space>
        <Table
          loading={loading}
          dataSource={rows}
          rowKey={(r?: any) => String(r.id ?? r.logId ?? Math.random())}
          empty={<Empty description={t('暂无数据')} />}
          pagination={{ currentPage: page, pageSize: 15, total, onPageChange: (p) => { setPage(p); load(p); } }}
          columns={logColumns}
        />
        <Modal title={t('申请充值')} visible={rechargeOpen} onOk={submitRecharge} onCancel={() => setRechargeOpen(false)} width={480} okText={t('提交')} okButtonProps={{ loading: saving }} cancelText={t('取消')}>
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span>{t('充值金额')}</span>
              <InputNumber style={{ width: 200 }} min={0.01} precision={2} value={form.amount} onChange={(v) => setForm({ ...form, amount: v === '' || v === null || v === undefined ? undefined : Number(v) })} />
            </label>
            {payees.length > 0 && (
              <label style={{ display: 'grid', gap: 4 }}>
                <span>{t('收款方')}</span>
                <Select
                  style={{ width: '100%' }}
                  placeholder={t('请选择收款账户')}
                  optionList={payees.map((p) => ({ value: String(p.id ?? p.payeeAccountId), label: p.name ?? p.accountName ?? `#${p.id ?? p.payeeAccountId}` }))}
                  value={form.payeeId}
                  onChange={(v) => setForm({ ...form, payeeId: v as string })}
                />
              </label>
            )}
            <label style={{ display: 'grid', gap: 4 }}>
              <span>{t('备注')}</span>
              <TextArea rows={3} value={form.remark} onChange={(v: string) => setForm({ ...form, remark: v })} />
            </label>
          </div>
        </Modal>
      </div>
    );
  };
}
