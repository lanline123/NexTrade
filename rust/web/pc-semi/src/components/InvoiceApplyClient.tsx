'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Toast } from '@douyinfe/semi-ui';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/client-api';

interface FormState {
  invoiceType: number;
  titleType: number;
  amount: string;
  invoiceContent: string;
  mobile: string;
  email: string;
  companyName: string;
  companyCode: string;
  companyAddress: string;
  companyPhone: string;
  companyBank: string;
  companyAccount: string;
}

export default function InvoiceApplyClient({ orderId }: { orderId: number }) {
  const [form, setForm] = useState<FormState>({
    invoiceType: 1, titleType: 1, amount: '', invoiceContent: '商品明细', mobile: '', email: '',
    companyName: '', companyCode: '', companyAddress: '', companyPhone: '', companyBank: '', companyAccount: '',
  });
  /** 源码：已驳回后重新提交开票申请 */
  const isReapply = Boolean((form as any).applyReply);
  const [invoiceStatus, setInvoiceStatus] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet<any>('user/invoice/getStatus').then((result) => setInvoiceStatus(Boolean(result?.item ?? result))).catch(() => undefined);
  }, []);

  const update = (key: keyof FormState, value: string | number) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (!orderId) return Toast.error({ content: '缺少订单 ID' });
    if (!form.amount || Number(form.amount) <= 0) return Toast.error({ content: '请输入发票金额' });
    if (!form.mobile.trim()) return Toast.error({ content: '请输入收票人手机' });
    if (form.invoiceType === 1 && form.titleType === 2 && !form.companyName.trim()) return Toast.error({ content: '请输入企业名称' });
    if (form.invoiceType === 2 && !invoiceStatus) return Toast.error({ content: '请先提交增票资质' });
    setSaving(true);
    try {
      await apiPost('user/orderInvoice/create', {
        // OrderInvoiceSaveParam 的订单字段是 orderId（services/trade/order_invoice_client.rs::create
        // 读 param.order_id）；传 id 会被当成发票记录主键而报「订单不存在」。
        orderId,
        invoiceType: form.invoiceType,
        titleType: form.invoiceType === 2 ? 2 : form.titleType,
        amount: Number(form.amount),
        invoiceContent: form.invoiceContent,
        mobile: form.mobile.trim(),
        email: form.email.trim(),
        companyName: form.companyName.trim(),
        companyCode: form.companyCode.trim(),
        companyAddress: form.companyAddress.trim(),
        companyPhone: form.companyPhone.trim(),
        companyBank: form.companyBank.trim(),
        companyAccount: form.companyAccount.trim(),
      });
      Toast.success({ content: '发票申请已提交' });
      window.location.href = '/member/orderInvoice';
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '提交失败' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="member-card invoice-card">
      <div className="invoice-form">
        <label>发票类型</label>
        <div className="invoice-options">
          <button type="button" className={form.invoiceType === 1 ? 'is-active' : ''} onClick={() => update('invoiceType', 1)}>电子普通发票</button>
          <button type="button" className={form.invoiceType === 2 ? 'is-active' : ''} onClick={() => update('invoiceType', 2)}>增值税专用发票</button>
        </div>
        {form.invoiceType === 2 && !invoiceStatus ? (
          <div className="invoice-error">
            您还未通过增票资质申请，暂时无法开具增值税专用发票，
            <Link href="/member/userInvoice/confirmInfo">去申请增票资质</Link>
          </div>
        ) : null}
        <p className="invoice-hint">注意：有效增值税专用发票开票资质仅为一个</p>
        {form.invoiceType === 1 ? (
          <>
            <label>发票抬头</label>
            <div className="invoice-options">
              <button type="button" className={form.titleType === 1 ? 'is-active' : ''} onClick={() => update('titleType', 1)}>个人</button>
              <button type="button" className={form.titleType === 2 ? 'is-active' : ''} onClick={() => update('titleType', 2)}>企业</button>
            </div>
          </>
        ) : null}
        <label>发票金额</label>
        <input value={form.amount} onChange={(event) => update('amount', event.target.value)} placeholder="请输入开票金额" inputMode="decimal" />
        <label>发票内容</label>
        <input value={form.invoiceContent} onChange={(event) => update('invoiceContent', event.target.value)} placeholder="商品明细" />
        <p className="invoice-hint">发票内容将显示详细商品名称与价格信息</p>
        <p className="invoice-hint">使用礼品卡支付部分的金额，不支持开发票</p>
        <p className="invoice-hint">电子普通发票和纸质普通发票具备同等法律效力，可支持报销入账</p>
        <p className="invoice-hint">我公司依法开具发票，请您按照税法规定使用发票</p>
        <p className="invoice-hint">如商品由第三方卖家销售，发票类型及内容将由该卖家决定，发票由卖家开具并提供</p>
        <p className="invoice-hint">如您为企业采购，需要多单合并开具或批量提交发票可注册企业用户</p>
        {form.invoiceType === 1 && form.titleType === 2 ? (
          <>
            <label>企业名称</label>
            <input value={form.companyName} onChange={(event) => update('companyName', event.target.value)} placeholder="请输入企业名称" />
            <label>纳税人识别号</label>
            <input value={form.companyCode} onChange={(event) => update('companyCode', event.target.value)} placeholder="请输入纳税人识别号" />
            <label>单位地址</label>
            <input value={form.companyAddress} onChange={(event) => update('companyAddress', event.target.value)} placeholder="请输入单位地址" />
            <label>单位电话</label>
            <input value={form.companyPhone} onChange={(event) => update('companyPhone', event.target.value)} placeholder="请输入单位电话" />
            <label>开户银行</label>
            <input value={form.companyBank} onChange={(event) => update('companyBank', event.target.value)} placeholder="请输入开户银行" />
            <label>银行账户</label>
            <input value={form.companyAccount} onChange={(event) => update('companyAccount', event.target.value)} placeholder="请输入银行账户" />
          </>
        ) : null}
        {form.invoiceType === 1 && form.titleType === 1 ? (
          <>
            <label>个人名称</label>
            <input value={form.companyName} onChange={(event) => update('companyName', event.target.value)} placeholder="请输入个人名称" />
          </>
        ) : null}
        <label>收票人手机</label>
        <input value={form.mobile} onChange={(event) => update('mobile', event.target.value)} placeholder="请输入收票人手机" />
        <label>收票人邮箱</label>
        <input value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="请输入收票人邮箱" />
        <div className="invoice-actions">
          <Button theme="solid" type="primary" loading={saving} onClick={() => void submit()}>
            {isReapply ? '重新提交开票申请' : '提交开票申请'}
          </Button>
          <Button onClick={() => window.history.back()}>暂不开票</Button>
          <Link href="/member/userInvoice/confirmInfo">增票资质</Link>
        </div>
      </div>
    </Card>
  );
}
