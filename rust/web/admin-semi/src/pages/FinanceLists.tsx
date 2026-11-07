import { useMemo, useState, type ReactNode } from 'react';
import {
  Banner,
  Button,
  Input,
  Modal,
  Radio,
  RadioGroup,
  Space,
  Spin,
  Table,
  Tag,
  TextArea,
  Toast,
} from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import { useI18n } from '../i18n';
import ImageUploader from '../components/ImageUploader';

interface FinanceRow extends Record<string, any> {
  id?: number;
}

const unixToDateTime = (value: unknown): string => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '--';
  const date = new Date(num * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const amountText = (value: unknown): string => {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(2) : '--';
};

/** 只读展示行。 */
function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', lineHeight: '32px' }}>
      <div style={{ width: 120, flexShrink: 0, color: 'var(--semi-color-text-2)' }}>{label}</div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

/** 拆分 paymentVoucher / invoiceAttachment 的逗号或 JSON 字符串。 */
const splitUrls = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(typeof item === 'object' ? (item as any)?.url || '' : item)).filter(Boolean);
  }
  const text = String(value).trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text) as unknown[];
      return splitUrls(parsed);
    } catch {
      /* 按逗号分隔处理 */
    }
  }
  return text.split(',').map((item) => item.trim()).filter(Boolean);
};

// ——————————————————————————————————————————————
// 退款申请（finance/refundApply）：详情 + 审核（同意/拒绝/线下转账）
// ——————————————————————————————————————————————

const REFUND_STATUS_OPTIONS = [
  { label: '待处理', value: 0 },
  { label: '处理中', value: 1 },
  { label: '已处理', value: 2 },
  { label: '已取消', value: 3 },
  { label: '已拒绝', value: 4 },
];

export function RefundApplyList() {
  const { t } = useI18n();
  const [reloadToken, setReloadToken] = useState(0);
  const listQuery = useMemo(() => ({ _reload: reloadToken }), [reloadToken]);
  const [detail, setDetail] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState('');
  const [voucher, setVoucher] = useState<string[]>([]);

  const openDetail = async (row: FinanceRow) => {
    setDetail(row);
    setNote(String(row.refundNote || ''));
    setVoucher(splitUrls(row.paymentVoucher));
    setLoading(true);
    try {
      const result = await apiGet<Record<string, any>>('/finance/refundApply/detail', { refundId: row.refundId });
      setDetail(result || row);
      setNote(String(result?.refundNote || ''));
      setVoucher(splitUrls(result?.paymentVoucher));
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载失败') });
    } finally {
      setLoading(false);
    }
  };

  const audit = async (refundStatus: number) => {
    if (!detail?.refundId) return;
    const refundNote = note.trim();
    if (refundStatus === 4 && !refundNote) {
      Toast.warning({ content: t('拒绝原因不能为空') });
      return;
    }
    setSubmitting(true);
    try {
      await apiPost('/finance/refundApply/audit', { refundId: detail.refundId, refundStatus, refundNote });
      Toast.success({ content: t('审核完成') });
      setDetail(null);
      setReloadToken((token) => token + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('审核失败') });
    } finally {
      setSubmitting(false);
    }
  };

  const offlineAudit = async () => {
    if (!detail?.refundId) return;
    setSubmitting(true);
    try {
      await apiPost('/finance/refundApply/offlineAudit', {
        refundId: detail.refundId,
        paymentVoucher: voucher.join(','),
      });
      Toast.success({ content: t('操作成功') });
      setDetail(null);
      setReloadToken((token) => token + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnConfig<FinanceRow>[] = [
    { title: t('退款类型'), dataIndex: 'refundTypeName', width: 120 },
    {
      title: t('退款信息'),
      dataIndex: 'refundNote',
      render: (value: unknown) => {
        const text = String(value || '').trim();
        return text || '-';
      },
    },
    {
      title: t('退款金额'),
      dataIndex: 'refundBalance',
      width: 120,
      render: (value: unknown) => amountText(value),
    },
    {
      title: t('退款状态'),
      dataIndex: 'refundStatus',
      width: 120,
      render: (value: unknown, row: FinanceRow) => row.refundStatusName || REFUND_STATUS_OPTIONS.find((o) => o.value === Number(value))?.label || String(value ?? '-'),
    },
    {
      title: t('申请时间'),
      dataIndex: 'addTime',
      width: 170,
      render: (value: unknown) => (String(value ?? '').includes('-') ? String(value) : unixToDateTime(value)),
    },
  ];

  const status = Number(detail?.refundStatus);
  const canAudit = status === 0;
  const isOffline = Number(detail?.isOffline) === 1;

  return (
    <>
      <ListPage<FinanceRow>
        api="/finance/refundApply/list"
        rowKey="refundId"
        pageSize={10}
        query={listQuery}
        filters={[
          {
            field: 'orderSn',
            label: t('订单号'),
            type: 'input',
            placeholder: t('输入订单号'),
            width: 240,
          },
          {
            field: 'refundStatus',
            label: t('退款状态'),
            type: 'select',
            placeholder: t('请选择状态'),
            options: REFUND_STATUS_OPTIONS.map((o) => ({ ...o, label: t(o.label) })),
            width: 150,
          },
        ]}
        columns={columns}
        rowActions={(row) => (
          <Button theme="borderless" size="small" onClick={() => void openDetail(row)}>
            {Number(row.refundStatus) === 0 ? t('处理申请') : t('查看详情')}
          </Button>
        )}
      />
      <Modal
        title={detail ? `${t('退款申请')}-${detail.refundId}` : ''}
        visible={Boolean(detail)}
        onCancel={() => setDetail(null)}
        footer={null}
        width={720}
      >
        <Spin spinning={loading}>
          {detail && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <InfoRow label={t('退款类型')}>{detail.refundTypeName || '-'}</InfoRow>
              <InfoRow label={t('退款状态')}>
                <Tag>{detail.refundStatusName || '-'}</Tag>
              </InfoRow>
              <InfoRow label={t('退款总额')}>{amountText(detail.refundBalance)}</InfoRow>
              <InfoRow label={t('线上退款金额')}>{amountText(detail.onlineBalance)}</InfoRow>
              <InfoRow label={t('线下退款金额')}>{amountText(detail.offlineBalance)}</InfoRow>
              {isOffline && (
                <InfoRow label={t('支付凭证')}>
                  <ImageUploader value={voucher} onChange={setVoucher} max={5} />
                </InfoRow>
              )}
              <FormRow label={t('本次操作备注')}>
                <TextArea
                  value={note}
                  onChange={(value) => setNote(value)}
                  rows={3}
                  disabled={!canAudit && !isOffline}
                  placeholder={t('本次操作备注')}
                />
              </FormRow>
              <div>
                <div style={{ marginBottom: 6 }}>{t('操作日志')}</div>
                <Table
                  size="small"
                  pagination={false}
                  rowKey="logId"
                  columns={[
                    { title: t('退款方式'), dataIndex: 'refundTypeName' },
                    { title: t('流水号'), dataIndex: 'transactionId' },
                    { title: t('金额'), dataIndex: 'refundAmount', render: (v: unknown) => amountText(v) },
                    { title: t('时间'), dataIndex: 'addTime', render: (v: unknown) => unixToDateTime(v) },
                  ]}
                  dataSource={detail.logs || []}
                />
              </div>
              <Banner
                type="info"
                closeIcon={null}
                description={t('处理状态为取消时，佣金等相关功能会忽略该退款；积分、优惠券等退还与本操作无关。')}
              />
              <Space>
                {canAudit && !isOffline && (
                  <Button theme="solid" type="primary" loading={submitting} onClick={() => void audit(1)}>
                    {t('同意退款')}
                  </Button>
                )}
                {canAudit && (
                  <Button theme="solid" type="danger" loading={submitting} onClick={() => void audit(4)}>
                    {t('拒绝退款')}
                  </Button>
                )}
                {canAudit && (
                  <Button theme="light" loading={submitting} onClick={() => void audit(3)}>
                    {t('取消')}
                  </Button>
                )}
                {isOffline && canAudit && (
                  <Button theme="solid" loading={submitting} onClick={() => void offlineAudit()}>
                    {t('确认已线下转账')}
                  </Button>
                )}
              </Space>
            </div>
          )}
        </Spin>
      </Modal>
    </>
  );
}

// ——————————————————————————————————————————————
// 会员提现申请（finance/userWithdrawApply）：审核（已完成/拒绝）
// ——————————————————————————————————————————————

const ACCOUNT_TYPE_LABELS: Record<number, string> = { 1: '银行卡', 2: '支付宝', 3: '微信' };

export function WithdrawApplyList() {
  const { t } = useI18n();
  const [reloadToken, setReloadToken] = useState(0);
  const listQuery = useMemo(() => ({ _reload: reloadToken }), [reloadToken]);
  const [editing, setEditing] = useState<Record<string, any> | null>(null);
  const [status, setStatus] = useState<number>(1);
  const [postscript, setPostscript] = useState('');
  const [saving, setSaving] = useState(false);

  const openEdit = (row: FinanceRow) => {
    setEditing(row);
    setStatus(Number(row.status) || 0);
    setPostscript(String(row.postscript || ''));
  };

  const submit = async () => {
    if (!editing) return;
    if (!postscript.trim()) {
      Toast.warning({ content: t('管理员备注不能为空!') });
      return;
    }
    setSaving(true);
    try {
      await apiPost('/finance/userWithdrawApply/update', {
        id: editing.id,
        postscript: postscript.trim(),
        status,
      });
      Toast.success({ content: t('操作成功') });
      setEditing(null);
      setReloadToken((token) => token + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnConfig<FinanceRow>[] = [
    { title: t('会员名称'), dataIndex: 'username', width: 150 },
    { title: t('金额'), dataIndex: 'amount', width: 110, render: (v: unknown) => amountText(v) },
    { title: t('手续费(元)'), dataIndex: 'handlingFee', width: 110, render: (v: unknown) => amountText(v) },
    { title: t('手续费率'), dataIndex: 'handlingRate', width: 100 },
    {
      title: t('提现账号类型'),
      dataIndex: 'accountTypeText',
      width: 120,
      render: (_v: unknown, row: FinanceRow) =>
        row.accountTypeText || ACCOUNT_TYPE_LABELS[Number(row.accountData?.accountType)] || '-',
    },
    {
      title: t('到款状态'),
      dataIndex: 'statusType',
      width: 110,
      render: (value: unknown, row: FinanceRow) => {
        if (value) return String(value);
        const map: Record<number, string> = { 0: t('待处理'), 1: t('已完成'), 2: t('拒绝申请') };
        return map[Number(row.status)] || String(row.status ?? '-');
      },
    },
    { title: t('操作时间'), dataIndex: 'addTime', width: 170 },
  ];

  const accountData = editing?.accountData || {};

  return (
    <>
      <ListPage<FinanceRow>
        api="/finance/userWithdrawApply/list"
        rowKey="id"
        pageSize={10}
        query={listQuery}
        filters={[
          { field: 'keyword', label: t('会员'), type: 'input', placeholder: t('输入会员名称'), width: 220 },
          {
            field: 'status',
            label: t('到款状态'),
            type: 'select',
            placeholder: t('请选择状态'),
            options: [
              { label: t('待处理'), value: 0 },
              { label: t('已完成'), value: 1 },
              { label: t('拒绝申请'), value: 2 },
            ],
            width: 140,
          },
        ]}
        columns={columns}
        rowActions={(row) => (
          <Button theme="borderless" size="small" onClick={() => openEdit(row)}>
            {Number(row.status) === 0 ? t('审核') : t('查看')}
          </Button>
        )}
      />
      <Modal
        title={editing ? `${t('提现申请')}-${editing.username || editing.id}` : ''}
        visible={Boolean(editing)}
        onCancel={() => setEditing(null)}
        onOk={() => void submit()}
        okText={t('提交')}
        cancelText={t('取消')}
        okButtonProps={{ loading: saving }}
        width={560}
      >
        {editing && (
          <div>
            <Banner
              type="info"
              closeIcon={null}
              style={{ marginBottom: 14 }}
              description={`${t('会员名称：')}${editing.username || '-'}　${t('金额：')}${amountText(editing.amount)}`}
            />
            <InfoRow label={t('提现方式')}>{ACCOUNT_TYPE_LABELS[Number(accountData.accountType)] || '-'}</InfoRow>
            <InfoRow label={t('姓名')}>{accountData.accountName || '-'}</InfoRow>
            <InfoRow label={t('银行卡号或账号')}>{accountData.accountNo || '-'}</InfoRow>
            {accountData.bankName && <InfoRow label={t('银行名称')}>{accountData.bankName}</InfoRow>}
            {accountData.identity && <InfoRow label={t('身份证号')}>{accountData.identity}</InfoRow>}
            <FormRow label={t('管理员备注')}>
              <TextArea value={postscript} onChange={(v) => setPostscript(v)} rows={2} placeholder={t('管理员备注')} />
            </FormRow>
            <FormRow label={t('到款状态')}>
              <RadioGroup value={status} onChange={(e) => setStatus(Number(e.target.value))}>
                <Radio value={1}>{t('已完成')}</Radio>
                <Radio value={2}>{t('拒绝申请')}</Radio>
              </RadioGroup>
            </FormRow>
          </div>
        )}
      </Modal>
    </>
  );
}

// ——————————————————————————————————————————————
// 充值订单（finance/userRechargeOrder）：审核（已支付/无效）
// ——————————————————————————————————————————————

export function RechargeOrderList() {
  const { t } = useI18n();
  const [reloadToken, setReloadToken] = useState(0);
  const listQuery = useMemo(() => ({ _reload: reloadToken }), [reloadToken]);
  const [editing, setEditing] = useState<Record<string, any> | null>(null);
  const [status, setStatus] = useState<number>(1);
  const [postscript, setPostscript] = useState('');
  const [saving, setSaving] = useState(false);

  const openEdit = (row: FinanceRow) => {
    setEditing(row);
    setStatus(Number(row.status) || 0);
    setPostscript(String(row.postscript || ''));
  };

  const submit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await apiPost('/finance/userRechargeOrder/update', {
        orderId: editing.orderId ?? editing.id,
        postscript: postscript.trim() || undefined,
        status,
      });
      Toast.success({ content: t('操作成功') });
      setEditing(null);
      setReloadToken((token) => token + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnConfig<FinanceRow>[] = [
    { title: t('会员名称'), dataIndex: 'username', width: 150 },
    { title: t('手机号'), dataIndex: 'mobile', width: 140 },
    { title: t('金额'), dataIndex: 'amount', width: 110, render: (v: unknown) => amountText(v) },
    { title: t('赠送金额'), dataIndex: 'discountMoney', width: 110, render: (v: unknown) => amountText(v) },
    {
      title: t('到款状态'),
      dataIndex: 'statusType',
      width: 110,
      render: (value: unknown, row: FinanceRow) => {
        if (value) return String(value);
        const map: Record<number, string> = { 0: t('待支付'), 1: t('已支付'), 2: t('无效') };
        return map[Number(row.status)] || String(row.status ?? '-');
      },
    },
    { title: t('操作时间'), dataIndex: 'addTime', width: 170 },
  ];

  return (
    <>
      <ListPage<FinanceRow>
        api="/finance/userRechargeOrder/list"
        rowKey="orderId"
        pageSize={10}
        query={listQuery}
        filters={[
          { field: 'keyword', label: t('会员'), type: 'input', placeholder: t('输入会员名称'), width: 220 },
          {
            field: 'status',
            label: t('到款状态'),
            type: 'select',
            placeholder: t('请选择状态'),
            options: [
              { label: t('待支付'), value: 0 },
              { label: t('已支付'), value: 1 },
              { label: t('无效'), value: 2 },
            ],
            width: 140,
          },
        ]}
        columns={columns}
        rowActions={(row) => (
          <Button theme="borderless" size="small" onClick={() => openEdit(row)}>
            {Number(row.status) === 0 ? t('审核') : t('查看')}
          </Button>
        )}
      />
      <Modal
        title={editing ? `${t('充值订单')}-${editing.orderId ?? editing.id}` : ''}
        visible={Boolean(editing)}
        onCancel={() => setEditing(null)}
        onOk={() => void submit()}
        okText={t('提交')}
        cancelText={t('取消')}
        okButtonProps={{ loading: saving }}
        width={520}
      >
        {editing && (
          <div>
            <Banner
              type="info"
              closeIcon={null}
              style={{ marginBottom: 14 }}
              description={`${t('会员名称：')}${editing.username || '-'}　${t('金额：')}${amountText(editing.amount)}　${t('赠送金额：')}${amountText(editing.discountMoney)}`}
            />
            <FormRow label={t('管理员备注')}>
              <TextArea value={postscript} onChange={(v) => setPostscript(v)} rows={2} placeholder={t('管理员备注')} />
            </FormRow>
            <FormRow label={t('到款状态')}>
              <RadioGroup value={status} onChange={(e) => setStatus(Number(e.target.value))}>
                <Radio value={1}>{t('已支付')}</Radio>
                <Radio value={2}>{t('无效')}</Radio>
              </RadioGroup>
            </FormRow>
          </div>
        )}
      </Modal>
    </>
  );
}

// ——————————————————————————————————————————————
// 用户发票资质（finance/userInvoice）：编辑 + 审核（1 通过 / 2 待审核 / 3 未通过）
// ——————————————————————————————————————————————

const USER_INVOICE_STATUS = [
  { label: '审核通过', value: 1 },
  { label: '待审核', value: 2 },
  { label: '审核未通过', value: 3 },
];

export function UserInvoiceList() {
  const { t } = useI18n();
  const [reloadToken, setReloadToken] = useState(0);
  const listQuery = useMemo(() => ({ _reload: reloadToken }), [reloadToken]);
  const [editing, setEditing] = useState<Record<string, any> | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const openEdit = async (row: FinanceRow) => {
    setEditing(row);
    setLoading(true);
    try {
      const result = await apiGet<Record<string, any>>('/finance/userInvoice/detail', { invoiceId: row.invoiceId ?? row.id });
      const data = result || row;
      setForm({
        status: Number(data.status ?? 2),
        applyReply: String(data.applyReply || ''),
        companyName: String(data.companyName || ''),
        companyCode: String(data.companyCode || ''),
        companyAddress: String(data.companyAddress || ''),
        companyPhone: String(data.companyPhone || ''),
        companyBank: String(data.companyBank || ''),
        companyAccount: String(data.companyAccount || ''),
      });
    } catch {
      setForm({
        status: Number(row.status ?? 2),
        applyReply: String(row.applyReply || ''),
        companyName: String(row.companyName || ''),
        companyCode: String(row.companyCode || ''),
        companyAddress: String(row.companyAddress || ''),
        companyPhone: String(row.companyPhone || ''),
        companyBank: String(row.companyBank || ''),
        companyAccount: String(row.companyAccount || ''),
      });
    } finally {
      setLoading(false);
    }
  };

  const setField = (field: string, value: unknown) => setForm((prev) => ({ ...prev, [field]: value }));

  const submit = async () => {
    if (!editing) return;
    if (Number(form.status) === 3 && !String(form.applyReply || '').trim()) {
      Toast.warning({ content: t('申请未通过原因不能为空') });
      return;
    }
    setSaving(true);
    try {
      await apiPost('/finance/userInvoice/update', {
        invoiceId: editing.invoiceId ?? editing.id,
        status: Number(form.status),
        applyReply: String(form.applyReply || ''),
        companyName: String(form.companyName || ''),
        companyCode: String(form.companyCode || ''),
        companyAddress: String(form.companyAddress || ''),
        companyPhone: String(form.companyPhone || ''),
        companyBank: String(form.companyBank || ''),
        companyAccount: String(form.companyAccount || ''),
      });
      Toast.success({ content: t('修改成功') });
      setEditing(null);
      setReloadToken((token) => token + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('修改失败') });
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnConfig<FinanceRow>[] = [
    { title: t('申请会员'), dataIndex: 'username', width: 150 },
    { title: t('公司名称'), dataIndex: 'companyName' },
    { title: t('申请日期'), dataIndex: 'addTime', width: 170 },
    {
      title: t('申请状态'),
      dataIndex: 'status',
      width: 120,
      render: (value: unknown, row: FinanceRow) =>
        row.statusName || USER_INVOICE_STATUS.find((o) => o.value === Number(value))?.label || String(value ?? '-'),
    },
  ];

  return (
    <>
      <ListPage<FinanceRow>
        api="/finance/userInvoice/list"
        rowKey="invoiceId"
        pageSize={10}
        query={listQuery}
        filters={[
          { field: 'keyword', label: t('会员'), type: 'input', placeholder: t('输入会员名称'), width: 220 },
          {
            field: 'status',
            label: t('申请状态'),
            type: 'select',
            placeholder: t('请选择状态'),
            options: USER_INVOICE_STATUS.map((o) => ({ ...o, label: t(o.label) })),
            width: 140,
          },
        ]}
        columns={columns}
        rowActions={(row) => (
          <Button theme="borderless" size="small" onClick={() => void openEdit(row)}>
            {t('编辑')}
          </Button>
        )}
      />
      <Modal
        title={editing ? `${t('发票资质')}-${editing.username || (editing.invoiceId ?? editing.id)}` : ''}
        visible={Boolean(editing)}
        onCancel={() => setEditing(null)}
        onOk={() => void submit()}
        okText={t('保存')}
        cancelText={t('取消')}
        okButtonProps={{ loading: saving }}
        width={620}
      >
        <Spin spinning={loading}>
          {editing && (
            <div>
              <FormRow label={t('公司名称')}>
                <Input value={form.companyName} onChange={(v) => setField('companyName', v)} />
              </FormRow>
              <FormRow label={t('纳税人识别码')}>
                <Input value={form.companyCode} onChange={(v) => setField('companyCode', v)} />
              </FormRow>
              <FormRow label={t('注册地址')}>
                <Input value={form.companyAddress} onChange={(v) => setField('companyAddress', v)} />
              </FormRow>
              <FormRow label={t('注册电话')}>
                <Input value={form.companyPhone} onChange={(v) => setField('companyPhone', v)} />
              </FormRow>
              <FormRow label={t('开户银行')}>
                <Input value={form.companyBank} onChange={(v) => setField('companyBank', v)} />
              </FormRow>
              <FormRow label={t('银行账户')}>
                <Input value={form.companyAccount} onChange={(v) => setField('companyAccount', v)} />
              </FormRow>
              <FormRow label={t('申请状态')}>
                <RadioGroup value={Number(form.status)} onChange={(e) => setField('status', Number(e.target.value))}>
                  {USER_INVOICE_STATUS.map((option) => (
                    <Radio key={option.value} value={option.value}>
                      {t(option.label)}
                    </Radio>
                  ))}
                </RadioGroup>
              </FormRow>
              {Number(form.status) === 3 && (
                <FormRow label={t('申请未通过原因')}>
                  <TextArea value={form.applyReply} onChange={(v) => setField('applyReply', v)} rows={2} />
                </FormRow>
              )}
            </div>
          )}
        </Spin>
      </Modal>
    </>
  );
}

// ——————————————————————————————————————————————
// 订单发票（finance/orderInvoice）：编辑（开票 / 作废 / 附件）
// ——————————————————————————————————————————————

const ORDER_INVOICE_STATUS = [
  { label: '待处理', value: 0 },
  { label: '已开', value: 1 },
  { label: '失败/作废', value: 2 },
];

interface OrderInvoiceAttachment {
  url?: string;
  [key: string]: unknown;
}

export function OrderInvoiceList() {
  const { t } = useI18n();
  const [reloadToken, setReloadToken] = useState(0);
  const listQuery = useMemo(() => ({ _reload: reloadToken }), [reloadToken]);
  const [editing, setEditing] = useState<Record<string, any> | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [attachments, setAttachments] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const openEdit = async (row: FinanceRow) => {
    setEditing(row);
    setLoading(true);
    try {
      const result = await apiGet<Record<string, any>>('/finance/orderInvoice/detail', { id: row.id });
      const data = result || row;
      setForm({
        status: Number(data.status ?? 0),
        applyReply: String(data.applyReply || ''),
        invoiceNo: String(data.invoiceNo || ''),
        amount: String(data.amount ?? ''),
      });
      setAttachments(splitUrls(data.invoiceAttachment));
    } catch {
      setForm({
        status: Number(row.status ?? 0),
        applyReply: String(row.applyReply || ''),
        invoiceNo: String(row.invoiceNo || ''),
        amount: String(row.amount ?? ''),
      });
      setAttachments(splitUrls(row.invoiceAttachment));
    } finally {
      setLoading(false);
    }
  };

  const setField = (field: string, value: unknown) => setForm((prev) => ({ ...prev, [field]: value }));

  const submit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await apiPost('/finance/orderInvoice/update', {
        id: editing.id,
        status: Number(form.status),
        applyReply: String(form.applyReply || ''),
        invoiceNo: String(form.invoiceNo || ''),
        amount: form.amount === '' ? undefined : Number(form.amount),
        invoiceAttachment: attachments.map((url) => ({ url })),
      });
      Toast.success({ content: t('修改成功') });
      setEditing(null);
      setReloadToken((token) => token + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('修改失败') });
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnConfig<FinanceRow>[] = [
    { title: t('申请会员'), dataIndex: 'username', width: 130 },
    {
      title: t('发票类型'),
      dataIndex: 'invoiceTypeName',
      width: 110,
      render: (value: unknown, row: FinanceRow) =>
        String(value || '') || (Number(row.invoiceType) === 2 ? t('增值发票') : t('普通发票')),
    },
    { title: t('公司名称/抬头'), dataIndex: 'companyName', width: 180 },
    { title: t('金额'), dataIndex: 'amount', width: 100, render: (v: unknown) => amountText(v) },
    { title: t('申请订单'), dataIndex: 'orderSn', width: 170 },
    {
      title: t('申请日期'),
      dataIndex: 'orderInvoiceAddTime',
      width: 170,
      render: (value: unknown, row: FinanceRow) =>
        value ? unixToDateTime(value) : String(row.addTime ?? '').includes('-') ? String(row.addTime) : unixToDateTime(row.addTime),
    },
    {
      title: t('申请状态'),
      dataIndex: 'status',
      width: 110,
      render: (value: unknown, row: FinanceRow) =>
        row.statusName || ORDER_INVOICE_STATUS.find((o) => o.value === Number(value))?.label || String(value ?? '-'),
    },
  ];

  return (
    <>
      <ListPage<FinanceRow>
        api="/finance/orderInvoice/list"
        rowKey="id"
        pageSize={10}
        query={listQuery}
        filters={[
          { field: 'keyword', label: t('会员'), type: 'input', placeholder: t('输入会员名称'), width: 220 },
          {
            field: 'status',
            label: t('申请状态'),
            type: 'select',
            placeholder: t('请选择状态'),
            options: ORDER_INVOICE_STATUS.map((o) => ({ ...o, label: t(o.label) })),
            width: 140,
          },
          {
            field: 'invoiceType',
            label: t('发票类型'),
            type: 'select',
            placeholder: t('请选择类型'),
            options: [
              { label: t('普通发票'), value: 1 },
              { label: t('增值发票'), value: 2 },
            ],
            width: 140,
          },
        ]}
        columns={columns}
        rowActions={(row) => (
          <Button theme="borderless" size="small" onClick={() => void openEdit(row)}>
            {Number(row.status) === 0 ? t('开票') : t('编辑')}
          </Button>
        )}
      />
      <Modal
        title={editing ? `${t('订单发票')}-${editing.orderSn || editing.id}` : ''}
        visible={Boolean(editing)}
        onCancel={() => setEditing(null)}
        onOk={() => void submit()}
        okText={t('保存')}
        cancelText={t('取消')}
        okButtonProps={{ loading: saving }}
        width={620}
      >
        <Spin spinning={loading}>
          {editing && (
            <div>
              <InfoRow label={t('公司名称')}>{form.companyName || editing.companyName || '-'}</InfoRow>
              <InfoRow label={t('纳税人识别码')}>{editing.companyCode || '-'}</InfoRow>
              <InfoRow label={t('发票内容')}>{editing.invoiceContent || '-'}</InfoRow>
              <InfoRow label={t('收票人邮箱')}>{editing.email || '-'}</InfoRow>
              <FormRow label={t('申请状态')}>
                <RadioGroup value={Number(form.status)} onChange={(e) => setField('status', Number(e.target.value))}>
                  {ORDER_INVOICE_STATUS.map((option) => (
                    <Radio key={option.value} value={option.value}>
                      {t(option.label)}
                    </Radio>
                  ))}
                </RadioGroup>
              </FormRow>
              <FormRow label={t('发票金额')}>
                <Input value={form.amount} onChange={(v) => setField('amount', v)} style={{ width: 200 }} />
              </FormRow>
              <FormRow label={t('发票号码')}>
                <Input value={form.invoiceNo} onChange={(v) => setField('invoiceNo', v)} style={{ width: 300 }} />
              </FormRow>
              {Number(form.status) === 2 && (
                <FormRow label={t('申请未通过原因')}>
                  <TextArea value={form.applyReply} onChange={(v) => setField('applyReply', v)} rows={2} />
                </FormRow>
              )}
              <FormRow label={t('上传发票附件')}>
                <ImageUploader value={attachments} onChange={setAttachments} max={5} />
              </FormRow>
            </div>
          )}
        </Spin>
      </Modal>
    </>
  );
}
