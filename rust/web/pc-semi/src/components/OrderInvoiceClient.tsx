'use client';

/**
 * 发票申请列表（会员中心右侧内容区）
 *
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/orderinvoice/List.vue
 * 弹窗对照：java-b2b2c-overseas-v5.8.61/view/pc/components/invoice/InvoiceDialog.vue
 * 菜单对照：java-b2b2c-overseas-v5.8.61/view/pc/components/member/TopMenu.vue
 *
 * 对齐要点（旧版 pc-semi 简化实现缺这些）：
 *  1. 接口是 `user/order/list?orderStatus=5`，不是 `order/order/list`（后者 404）。
 *     见 view/pc/api/user/order.ts::getOrderList 与 crates/api/public/src/lib.rs。
 *  2. 顶部 MemberTopMenu 子菜单：发票申请 / 增票资质。
 *  3. `.table-head` 三列表头：商品名称 / 状态 / 操作。
 *  4. 每单一张 `custom-table`：表头行「订单号 / 下单时间 / 总金额 (运费)」，
 *     正文行左侧商品缩略图（只显示图片链接，不显示名称与数量）、状态列、操作列。
 *  5. 状态：无发票=可申请；0=待审核(绿)；1=通过(绿)；其它=失败/作废(红)。
 *  6. 操作是 InvoiceDialog 弹窗（查看 / 重新申请 / 发票申请），不跳订单详情、没有「删除发票」。
 *  7. 空态是 /assets/images/empty-box.png + 「还没有可申请订单」。
 *
 * 数据契约注意：
 *  - `order.invoiceData` 由 order_invoice_client 服务回写，内容是 `OrderInvoice` entity
 *    序列化结果（snake_case，见 crates/core/src/entities/order.rs::OrderInvoice），
 *    而 Java VO 是 camelCase；且历史数据可能是 `[]` / `{}` / null。故统一走 invoiceOf() 归一化。
 *  - `user/orderInvoice/detail?id=` 接的是**发票 id**，不是订单 id（services/trade/
 *    order_invoice_client.rs::detail -> repo.find_invoice）。查看模式直接用订单上的
 *    invoiceData 快照渲染，避免再查一次，也避开该契约差异。
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Modal, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
interface InvoiceItem {
  productId?: number;
  productName?: string;
  productSn?: string;
  picThumb?: string;
  productImage?: string;
  picUrl?: string;
  quantity?: number;
  [key: string]: unknown;
}

interface InvoiceData {
  id?: number;
  status?: number;
  [key: string]: unknown;
}

interface InvoiceOrder {
  orderId?: number;
  orderSn?: string;
  addTime?: string;
  totalAmount?: number | string;
  shippingFee?: number | string;
  balance?: number | string;
  items?: InvoiceItem[];
  invoiceData?: InvoiceData | InvoiceData[] | null;
}

interface InvoiceForm {
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

type DialogMode = 'info' | 'apply' | 'reapply';
interface DialogState {
  mode: DialogMode;
  order: InvoiceOrder;
}

const EMPTY_FORM: InvoiceForm = {
  invoiceType: 1,
  titleType: 1,
  amount: '',
  invoiceContent: '商品明细',
  mobile: '',
  email: '',
  companyName: '',
  companyCode: '',
  companyAddress: '',
  companyPhone: '',
  companyBank: '',
  companyAccount: '',
};

const INVOICE_TYPE_TEXT: Record<number, string> = { 1: '普通发票', 2: '增值税专用发票' };
const TITLE_TYPE_TEXT: Record<number, string> = { 1: '个人', 2: '企业' };
const STATUS_TEXT: Record<number, string> = { 0: '待审核', 1: '通过' };

function money(value: unknown): string {
  const n = Number(value || 0);
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}

/**
 * order.invoice_data 可能是：entity 对象、`[]`（Java 侧空占位）、`{}`、null、甚至数组里套对象。
 * 统一成「有发票记录的对象」或 null，供列表与弹窗共用。
 */
function invoiceOf(order: InvoiceOrder): InvoiceData | null {
  const raw = order.invoiceData;
  if (Array.isArray(raw)) {
    const first = raw[0];
    return first && typeof first === 'object' ? (first as InvoiceData) : null;
  }
  if (raw && typeof raw === 'object') {
    return Object.keys(raw).length ? raw : null;
  }
  return null;
}

/** 兼容 camelCase（Java VO）与 snake_case（Rust entity 快照）。 */
function field(inv: InvoiceData | null, camel: string, snake = camel): string {
  if (!inv) return '';
  const value = inv[camel] ?? inv[snake];
  return value == null ? '' : String(value);
}

function numField(inv: InvoiceData | null, camel: string, snake = camel, fallback = 0): number {
  const value = Number(inv?.[camel] ?? inv?.[snake]);
  return Number.isFinite(value) ? value : fallback;
}

function productImage(item: InvoiceItem): string {
  return item.picUrl || item.productImage || item.picThumb || '';
}

function productHref(item: InvoiceItem): string {
  return item.productId ? `/product/${item.productId}` : '/search';
}

function statusCell(inv: InvoiceData | null) {
    const { t } = useTranslation();
  if (!inv) return <span className="inv-list__can">{t('可申请')}</span>;
  const status = numField(inv, 'status');
  if (status === 0 || status === 1) {
    return <span className="inv-list__ok">{STATUS_TEXT[status]}</span>;
  }
  return <span className="inv-list__bad">失败/作废</span>;
}

/** 只读字段行，弹窗 info 模式与原版 el-form-item 对齐。 */
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="inv-dialog__row">
      <dt>{label}</dt>
      <dd>{children || '-'}</dd>
    </div>
  );
}

function InvoiceInfo({ order, inv }: { order: InvoiceOrder; inv: InvoiceData | null }) {
    const { t } = useTranslation();
  const status = numField(inv, 'status');
  const statusName = field(inv, 'statusName', 'status_name') || STATUS_TEXT[status] || t('失败/作废');
  const invoiceType = numField(inv, 'invoiceType', 'invoice_type', 1);
  const titleType = numField(inv, 'titleType', 'title_type', 1);
  const isFirm = invoiceType === 2 || titleType === 2;
  const attachment = field(inv, 'invoiceAttachment', 'invoice_attachment');
  let images: string[] = [];
  try {
    const parsed: unknown = JSON.parse(attachment);
    if (Array.isArray(parsed)) {
      images = parsed.map((entry) => (entry && typeof entry === 'object' ? String((entry as { picUrl?: string }).picUrl || '') : '')).filter(Boolean);
    }
  } catch {
    // 非 JSON 字符串按单图处理
  }
  if (!images.length) {
    const single = field(inv, 'invoiceImg', 'invoice_img');
    if (single) images = [single];
  }

  return (
    <div className="inv-dialog__info">
      <div className="inv-dialog__audit">{t('审核状态：')}<span className={`is-${status}`}>{statusName}</span>
        {field(inv, 'applyReply', 'apply_reply') ? <div>{field(inv, 'applyReply', 'apply_reply')}</div> : null}
      </div>
      <dl className="inv-dialog__list">
        <InfoRow label="订单号">
          <Link href={`/member/order/info?id=${order.orderId || ''}`} target="_blank" className="inv-list__link">
            {order.orderSn || '-'}
          </Link>
        </InfoRow>
        <InfoRow label="订单金额">¥ {money(order.totalAmount)}</InfoRow>
        <InfoRow label="发票金额">¥ {money(field(inv, 'amount') || (order.balance ?? order.totalAmount))}</InfoRow>
        <InfoRow label="发票类型">{INVOICE_TYPE_TEXT[invoiceType] || t('普通发票')}</InfoRow>
        <InfoRow label="发票抬头">{TITLE_TYPE_TEXT[isFirm ? 2 : 1]}</InfoRow>
        <InfoRow label={isFirm ? t('企业名称') : '个人名称'}>{field(inv, 'companyName', 'company_name')}</InfoRow>
        {isFirm ? (
          <>
            <InfoRow label="纳税人识别号">{field(inv, 'companyCode', 'company_code')}</InfoRow>
            <InfoRow label="单位地址">{field(inv, 'companyAddress', 'company_address')}</InfoRow>
            <InfoRow label="单位电话">{field(inv, 'companyPhone', 'company_phone')}</InfoRow>
            <InfoRow label="开户银行">{field(inv, 'companyBank', 'company_bank')}</InfoRow>
            <InfoRow label="银行账户">{field(inv, 'companyAccount', 'company_account')}</InfoRow>
          </>
        ) : null}
        <InfoRow label="发票内容">{field(inv, 'invoiceContent', 'invoice_content') || t('商品明细')}</InfoRow>
        <div className="inv-dialog__extra">{t('发票内容将显示详细商品名称与价格信息')}</div>
        <InfoRow label="收票人手机">{field(inv, 'mobile')}</InfoRow>
        <InfoRow label="收票人邮箱">{field(inv, 'email')}</InfoRow>
      </dl>
      {images.length ? (
        <div className="inv-dialog__images">
          {images.map((src, index) => <img key={index} src={src} alt={t('发票图片')} />)}
        </div>
      ) : null}
    </div>
  );
}

export default function OrderInvoiceClient() {
    const { t } = useTranslation();
  const [rows, setRows] = useState<InvoiceOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [form, setForm] = useState<InvoiceForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [invoiceStatus, setInvoiceStatus] = useState(false);
  /** 发票图片（源码 orderInvoice/Info.vue invoiceAttachment） */
  const [invoiceImages, setInvoiceImages] = useState<Array<{ picUrl?: string; picThumb?: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const size = 10;

  const load = useCallback(() => {
    setLoading(true);
    // 原版 filterParams = { page: 1, orderStatus: 5 }，走 user/order/list
    apiGet<{ records?: InvoiceOrder[]; total?: number }>('user/order/list', { page, size, orderStatus: 5 })
      .then((result) => {
        setRows(Array.isArray(result?.records) ? result.records : []);
        setTotal(Number(result?.total || 0));
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiGet<{ item?: unknown }>('user/invoice/getStatus')
      .then((result) => setInvoiceStatus(Boolean(result?.item ?? result)))
      .catch(() => undefined);
  }, []);

  const closeDialog = () => setDialog(null);

  const openDialog = (mode: DialogMode, order: InvoiceOrder) => {
    const inv = invoiceOf(order);
    const amount = String(order.balance ?? order.totalAmount ?? 0);
    // 重新申请时回显已有发票图片
    let images: Array<{ picUrl?: string; picThumb?: string }> = [];
    try {
      const parsed: unknown = JSON.parse(field(inv, 'invoiceAttachment', 'invoice_attachment'));
      if (Array.isArray(parsed)) {
        images = parsed.map((entry) => (entry && typeof entry === 'object' ? { picUrl: String((entry as { picUrl?: string }).picUrl || ''), picThumb: String((entry as { picThumb?: string }).picThumb || '') } : { picUrl: '' })).filter((entry) => entry.picUrl);
      }
    } catch {
      // 非 JSON 字符串按空处理
    }
    setInvoiceImages(images);
    setForm({
      ...EMPTY_FORM,
      amount,
      invoiceType: mode === 'reapply' ? numField(inv, 'invoiceType', 'invoice_type', 1) : 1,
      titleType: mode === 'reapply' ? numField(inv, 'titleType', 'title_type', 1) : 1,
      companyName: mode === 'reapply' ? field(inv, 'companyName', 'company_name') : '',
      companyCode: mode === 'reapply' ? field(inv, 'companyCode', 'company_code') : '',
      companyAddress: mode === 'reapply' ? field(inv, 'companyAddress', 'company_address') : '',
      companyPhone: mode === 'reapply' ? field(inv, 'companyPhone', 'company_phone') : '',
      companyBank: mode === 'reapply' ? field(inv, 'companyBank', 'company_bank') : '',
      companyAccount: mode === 'reapply' ? field(inv, 'companyAccount', 'company_account') : '',
      mobile: mode === 'reapply' ? field(inv, 'mobile') : '',
      email: mode === 'reapply' ? field(inv, 'email') : '',
      invoiceContent: mode === 'reapply' ? field(inv, 'invoiceContent', 'invoice_content') || t('商品明细') : '商品明细',
    });
    setDialog({ mode, order });
  };

  const update = (key: keyof InvoiceForm, value: string | number) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  /**
   * 发票图片上传（源码 pages/member/orderInvoice/Info.vue 的 invoiceAttachment 字段）。
   * 后端 OrderInvoiceSaveParam.invoice_attachment 为 Vec<serde_json::Value>，
   * 落库时序列化成 JSON 字符串（services/src/trade/order_invoice_client.rs）。
   */
  const uploadInvoiceImage = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      Toast.error({ content: '只能上传 2M 以内的图片' });
      return;
    }
    setUploading(true);
    try {
      const token = localStorage.getItem('accessToken') || '';
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/user/user/uploadImg', {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body,
      });
      const json = await response.json();
      if (!response.ok || (json?.code !== undefined && json.code !== 0)) {
        Toast.error({ content: String(json?.msg || json?.message || t('上传失败')) });
        return;
      }
      const data = json?.data;
      const picUrl = typeof data === 'string' ? data : String(data?.picUrl || data?.url || '');
      if (!picUrl) {
        Toast.error({ content: t('上传失败') });
        return;
      }
      setInvoiceImages((current) => [...current, { picUrl, picThumb: String(data?.picThumb || picUrl) }]);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('上传失败') });
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!dialog || dialog.mode === 'info') return;
    const { mode, order } = dialog;
    const inv = invoiceOf(order);
    if (!order.orderId) return Toast.error({ content: '缺少订单 ID' });
    if (!form.mobile.trim()) return Toast.error({ content: '请输入收票人手机' });
    if (!form.companyName.trim()) {
      return Toast.error({ content: form.titleType === 1 ? t('请输入个人名称') : '请输入企业名称' });
    }
    if (form.invoiceType === 2 && !invoiceStatus) {
      return Toast.error({ content: '您还未通过增票资质申请，暂时无法开具增值税专用发票' });
    }
    const payload = {
      invoiceType: form.invoiceType,
      titleType: form.invoiceType === 2 ? 2 : form.titleType,
      amount: Number(form.amount) || Number(order.totalAmount) || 0,
      invoiceContent: form.invoiceContent || t('商品明细'),
      mobile: form.mobile.trim(),
      email: form.email.trim(),
      companyName: form.companyName.trim(),
      companyCode: form.companyCode.trim(),
      companyAddress: form.companyAddress.trim(),
      companyPhone: form.companyPhone.trim(),
      companyBank: form.companyBank.trim(),
      companyAccount: form.companyAccount.trim(),
      // 发票图片（后端 invoice_attachment 形如 [{ picUrl, picThumb }]）
      invoiceAttachment: invoiceImages,
    };
    setSaving(true);
    try {
      if (mode === 'apply') {
        // OrderInvoiceSaveParam 用 orderId（旧 InvoiceApplyClient 误传 id）
        await apiPost('user/orderInvoice/create', { orderId: order.orderId, ...payload });
      } else {
        // OrderInvoiceEditParam 用发票记录 id
        await apiPost('user/orderInvoice/update', { id: numField(inv, 'id'), ...payload });
      }
      Toast.success({ content: '操作成功' });
      closeDialog();
      load();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '提交失败' });
    } finally {
      setSaving(false);
    }
  };

  const pages = Math.max(1, Math.ceil(total / size));
  const dialogInvoice = dialog ? invoiceOf(dialog.order) : null;
  const isInfo = dialog?.mode === 'info';
  const isReapply = dialog?.mode === 'reapply';
  const isFirm = form.invoiceType === 2 || form.titleType === 2;

  return (
    <>
      {/* 原版 MemberTopMenu：发票申请 / 增票资质 */}
      <nav className="invq-tabs">
        <Link href="/member/orderinvoice/list" className="invq-tabs__item is-active">{t('发票申请')}</Link>
        <Link href="/member/userinvoice/info" className="invq-tabs__item">{t('增票资质')}</Link>
      </nav>

      {/* 不用 Card 的 loading：Semi 会把整个 children 换成骨架屏，导致原版常驻的
          .table-head 在 SSR 阶段消失。改为只让列表区随 loading 切换。 */}
      <Card className="member-card inv-list">
        <div className="inv-list__content">
          {/* 原版 .table-head */}
          <div className="inv-list__head">
            <div className="inv-list__head-cell">{t('商品名称')}</div>
            <div className="inv-list__head-cell">{t('状态')}</div>
            <div className="inv-list__head-cell">{t('操作')}</div>
          </div>

          {loading ? (
            <div className="inv-list__loading">{t('加载中...')}</div>
          ) : rows.length ? (
            <div className="inv-list__cards">
              {rows.map((order) => {
                const inv = invoiceOf(order);
                const status = numField(inv, 'status');
                return (
                  <table className="inv-list__table" key={order.orderId ?? order.orderSn}>
                    {/* 原版：商品名列撑满，状态/操作各 150px。table-layout:fixed 下
                        首行是 colspan=3 的 th，必须用 colgroup 显式定宽，否则三列等分。 */}
                    <colgroup>
                      <col />
                      <col style={{ width: 150 }} />
                      <col style={{ width: 150 }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="inv-list__table-head" colSpan={3}>{t('订单号：')}<span className="inv-list__sn">{order.orderSn || '-'}</span>
                          <span className="inv-list__gap" />
                          下单时间：{order.addTime || '-'}
                          <span className="inv-list__gap" />{t('总金额：')}<span className="inv-list__price">¥ {money(order.totalAmount)}</span>
                          (运费：<span className="inv-list__fee">¥ {money(order.shippingFee)}</span>)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="inv-list__products">
                          {(order.items || []).map((item, index) => (
                            <Link
                              href={productHref(item)}
                              target="_blank"
                              title={item.productName || ''}
                              className="inv-list__thumb"
                              key={`${item.productId ?? index}-${index}`}
                            >
                              <img src={productImage(item)} alt={item.productName || ''} loading="lazy" />
                            </Link>
                          ))}
                        </td>
                        <td className="inv-list__status">{statusCell(inv)}</td>
                        <td className="inv-list__actions">
                          {inv ? (
                            <>
                              <button type="button" className="inv-list__link" onClick={() => openDialog('info', order)}>{t('查看')}</button>
                              {status === 2 ? (
                                <>
                                  <span className="inv-list__sep">｜</span>
                                  <button type="button" className="inv-list__link" onClick={() => openDialog('reapply', order)}>{t('重新申请')}</button>
                                </>
                              ) : null}
                            </>
                          ) : (
                            <Button size="small" theme="solid" type="primary" onClick={() => openDialog('apply', order)}>{t('发票申请')}</Button>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                );
              })}
              {pages > 1 ? (
                <div className="comment-pagination">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>{t('上一页')}</button>
                  <span>{page} / {pages}</span>
                  <button type="button" disabled={page >= pages} onClick={() => setPage((n) => n + 1)}>{t('下一页')}</button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="inv-list__empty">
              <img src="/assets/images/empty-box.png" alt="" />
              <div>{t('还没有可申请订单')}</div>
            </div>
          )}
        </div>
      </Card>

      {/* 原版 InvoiceDialog.vue：查看 / 发票申请 / 重新申请共用一个弹窗 */}
      <Modal
        title={t('发票申请')}
        visible={Boolean(dialog)}
        width={800}
        onCancel={closeDialog}
        footer={
          isInfo ? (
            <Button onClick={closeDialog}>{t('关闭')}</Button>
          ) : (
            <div className="inv-dialog__footer">
              <Button onClick={closeDialog}>{t('暂不开票')}</Button>
              <Button theme="solid" type="primary" loading={saving} onClick={() => void submit()}>{t('提交开票申请')}</Button>
            </div>
          )
        }
      >
        {dialog ? (
          isInfo ? (
            <InvoiceInfo order={dialog.order} inv={dialogInvoice} />
          ) : (
            <div className="inv-dialog__form">
              {isReapply ? (
                <div className="inv-dialog__audit">{t('审核状态：')}<span className="is-2">失败/作废</span>
                  {field(dialogInvoice, 'applyReply', 'apply_reply') ? (
                    <div>{field(dialogInvoice, 'applyReply', 'apply_reply')}</div>
                  ) : null}
                </div>
              ) : null}

              <dl className="inv-dialog__list">
                <InfoRow label="订单号">{dialog.order.orderSn || '-'}</InfoRow>
                <InfoRow label="订单金额">¥ {money(dialog.order.totalAmount)}</InfoRow>
                <InfoRow label="发票金额">¥ {money(form.amount || dialog.order.totalAmount)}</InfoRow>
              </dl>

              <label className="inv-dialog__label">{t('发票类型')}</label>
              <div className="invoice-options">
                <button type="button" className={form.invoiceType === 1 ? 'is-active' : ''} onClick={() => update('invoiceType', 1)}>{t('普通发票')}</button>
                <button type="button" className={form.invoiceType === 2 ? 'is-active' : ''} onClick={() => update('invoiceType', 2)}>{t('增值税专用发票')}</button>
              </div>
              {form.invoiceType === 2 && !invoiceStatus ? (
                <div className="invoice-error">{t('您还未通过增票资质申请，暂时无法开具增值税专用发票，')}<Link href="/member/userinvoice/info">{t('点击这里')}</Link>{t('去申请增票资质。')}</div>
              ) : (
                <p className="inv-dialog__hint">{t('所有发票由商品供货商开具')}</p>
              )}

              {form.invoiceType === 1 ? (
                <>
                  <label className="inv-dialog__label">{t('发票抬头')}</label>
                  <div className="invoice-options">
                    <button type="button" className={form.titleType === 1 ? 'is-active' : ''} onClick={() => update('titleType', 1)}>{t('个人')}</button>
                    <button type="button" className={form.titleType === 2 ? 'is-active' : ''} onClick={() => update('titleType', 2)}>{t('企业')}</button>
                  </div>
                </>
              ) : null}

              <label className="inv-dialog__label">{isFirm ? t('企业名称') : '个人名称'}</label>
              <input value={form.companyName} onChange={(event) => update('companyName', event.target.value)} placeholder={isFirm ? t('请输入企业名称') : '请输入个人名称'} />
              {isFirm ? (
                <>
                  <label className="inv-dialog__label">{t('纳税人识别号')}</label>
                  <input value={form.companyCode} onChange={(event) => update('companyCode', event.target.value)} placeholder={t('请输入纳税人识别号')} />
                  <label className="inv-dialog__label">{t('单位地址')}</label>
                  <input value={form.companyAddress} onChange={(event) => update('companyAddress', event.target.value)} placeholder={t('请输入单位地址')} />
                  <label className="inv-dialog__label">{t('单位电话')}</label>
                  <input value={form.companyPhone} onChange={(event) => update('companyPhone', event.target.value)} placeholder={t('请输入单位电话')} />
                  <label className="inv-dialog__label">{t('开户银行')}</label>
                  <input value={form.companyBank} onChange={(event) => update('companyBank', event.target.value)} placeholder={t('请输入开户银行')} />
                  <label className="inv-dialog__label">{t('银行账户')}</label>
                  <input value={form.companyAccount} onChange={(event) => update('companyAccount', event.target.value)} placeholder={t('请输入银行账户')} />
                </>
              ) : null}

              <label className="inv-dialog__label">{t('发票内容')}</label>
              <input value={form.invoiceContent} onChange={(event) => update('invoiceContent', event.target.value)} placeholder={t('商品明细')} />
              <p className="inv-dialog__hint">{t('发票内容将显示详细商品名称与价格信息；使用礼品卡支付部分的金额，不支持开发票')}</p>

              <label className="inv-dialog__label">{t('收票人手机')}</label>
              <input value={form.mobile} onChange={(event) => update('mobile', event.target.value)} placeholder={t('请输入收票人手机')} />
              <label className="inv-dialog__label">{t('收票人邮箱')}</label>
              <input value={form.email} onChange={(event) => update('email', event.target.value)} placeholder={t('请输入收票人邮箱')} />

              {/* 发票图片（源码 orderInvoice/Info.vue invoiceAttachment） */}
              <label className="inv-dialog__label">{t('发票图片')}</label>
              <div className="inv-dialog__uploader">
                <div className="inv-dialog__images">
                  {invoiceImages.map((image, index) => (
                    <span className="inv-dialog__image" key={`${image.picUrl || ''}-${index}`}>
                      <img src={image.picThumb || image.picUrl || ''} alt={t('发票图片')} />
                      <button
                        type="button"
                        onClick={() => setInvoiceImages((current) => current.filter((_, i) => i !== index))}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <label className="inv-dialog__image inv-dialog__image--add">
                    {uploading ? t('上传中...') : '+'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      hidden
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadInvoiceImage(file);
                        event.target.value = '';
                      }}
                    />
                  </label>
                </div>
                <p className="inv-dialog__hint">{t('最多上传2M 以内的图片')}</p>
              </div>
            </div>
          )
        ) : null}
      </Modal>
    </>
  );
}
