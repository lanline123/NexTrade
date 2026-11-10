'use client';

/**
 * 发票申请列表（PC 会员中心）—— Semi Design 现代化版
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/orderInvoice/List.vue + Info.vue（弹窗）
 *
 * 功能 1:1 保留：
 * - 顶部页签（发票申请 / 增票资质）
 * - 列表：已完成订单（user/order/list orderStatus=5），每单发票状态（无记录=可申请；
 *   0 待审核 / 1 通过 / 2 失败作废），操作（申请/查看/重新申请）
 * - 弹窗三态：info 只读（审核状态 + 按发票类型/抬头分支的资质字段 + 发票图片）；
 *   apply / reapply（发票类型单选、增票资质校验与引导、普通发票数电票说明、
 *   抬头单选 + 个人名称或企业六项、收票人手机/邮箱）
 * - 提交校验（手机必填、名称必填、专票需已过资质）、create/update 分流、发票图片回显
 * - Semi Pagination + Skeleton + Empty；发票图片用 Semi Image 内置预览
 *
 * 现代化：列表 table → 卡片（.mol-card 同款），弹窗 el-form → Semi Descriptions/Input/RadioGroup，
 * 状态文字 → Semi Tag 语义色。样式复用 .miq 与 .mol 全局类 + 本文件 .moi 补充。
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Descriptions, Empty, Image, Input, Modal, Pagination, RadioGroup, Radio, Skeleton, Tag, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';

import { formatPrice } from '@/lib/currency';
interface InvoiceItem {
  productId?: number;
  productName?: string;
  productSn?: string;
  picThumb?: string;
  picUrl?: string;
  productImage?: string;
  quantity?: number;
}

interface InvoiceData {
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
  invoiceData?: unknown;
}

interface InvoiceForm {
  amount: string;
  invoiceType: number;
  titleType: number;
  invoiceContent: string;
  companyName: string;
  companyCode: string;
  companyAddress: string;
  companyPhone: string;
  companyBank: string;
  companyAccount: string;
  mobile: string;
  email: string;
}

type DialogMode = 'info' | 'apply' | 'reapply';

interface DialogState {
  mode: DialogMode;
  order: InvoiceOrder;
}

const EMPTY_FORM: InvoiceForm = {
  amount: '',
  invoiceType: 1,
  titleType: 1,
  invoiceContent: '',
  companyName: '',
  companyCode: '',
  companyAddress: '',
  companyPhone: '',
  companyBank: '',
  companyAccount: '',
  mobile: '',
  email: '',
};

const STATUS_TEXT: Record<number, string> = { 0: '待审核', 1: '通过', 2: '失败/作废' };
/** 发票状态 → Semi Tag 色（-1=可申请） */
const STATUS_TAG: Record<number, 'blue' | 'orange' | 'green' | 'red'> = {
  '-1': 'blue',
  0: 'orange',
  1: 'green',
  2: 'red',
};

/**
 * order.invoice_data 可能是：entity 对象、`[]`（Java 侧空占位）、`{}`、null、甚至数组里套对象。
 * 统一成「有发票记录的对象」或 null，供列表与弹窗共用。
 */
function invoiceOf(order: InvoiceOrder): InvoiceData | null {
  const raw = order.invoiceData;
  if (Array.isArray(raw)) {
    const first = raw[0] as InvoiceData | undefined;
    return first && typeof first === 'object' ? first : null;
  }
  if (raw && typeof raw === 'object') {
    return Object.keys(raw).length ? (raw as InvoiceData) : null;
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

function money(value: number | string | undefined): string {
  return formatPrice(value);
}

/** 旧版图像字段优先级与 List.vue productImage() 一致 */
function thumbOf(img: InvoiceItem): string {
  return img.picThumb || img.productImage || img.picUrl || '';
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
        images = parsed
          .map((entry) => (entry && typeof entry === 'object' ? { picUrl: String((entry as { picUrl?: string }).picUrl || ''), picThumb: String((entry as { picThumb?: string }).picThumb || '') } : { picUrl: '' }))
          .filter((entry) => entry.picUrl);
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

  const submit = async () => {
    if (!dialog || dialog.mode === 'info') return;
    const { mode, order } = dialog;
    const inv = invoiceOf(order);
    if (!order.orderId) return Toast.error({ content: t('缺少订单 ID') });
    if (!form.mobile.trim()) return Toast.error({ content: t('请输入收票人手机') });
    if (!form.companyName.trim()) {
      return Toast.error({ content: form.titleType === 1 ? t('请输入个人名称') : t('请输入企业名称') });
    }
    if (form.invoiceType === 2 && !invoiceStatus) {
      return Toast.error({ content: t('您还未通过增票资质申请，暂时无法开具增值税专用发票') });
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
      Toast.success({ content: t('操作成功') });
      closeDialog();
      load();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('提交失败') });
    } finally {
      setSaving(false);
    }
  };

  const dialogState: DialogState | null = dialog;
  const dialogInvoice = dialogState ? invoiceOf(dialogState.order) : null;
  const isInfo = dialogState?.mode === 'info';
  const isReapply = dialogState?.mode === 'reapply';
  const auditStatus = dialogInvoice ? numField(dialogInvoice, 'status', 'status', 0) : 0;
  const rowStatus = (inv: InvoiceData | null) => (inv ? numField(inv, 'status', 'status', 0) : -1);
  const auditTag = auditStatus === 1 ? 'green' : auditStatus === 2 ? 'red' : 'orange';

  return (
    <div className="miq">
      {/* 顶部页签（发票申请 / 增票资质） */}
      <div className="miq-tabs">
        <span className="miq-tab miq-tab--active">{t('发票申请')}</span>
        <Link className="miq-tab" href="/member/userinvoice/info">{t('增票资质')}</Link>
      </div>

      <div className="mol-body">
        {loading ? (
          <div className="mcc-skeleton">
            {[0, 1, 2].map((index) => (
              <div key={index} className="mcc-skeleton__card">
                <Skeleton active loading placeholder={<Skeleton.Paragraph rows={3} style={{ padding: '16px 16px 8px' }} />} />
              </div>
            ))}
          </div>
        ) : total > 0 ? (
          rows.map((item, rowIndex) => {
            const inv = invoiceOf(item);
            const status = rowStatus(inv);
            return (
              <div className="mol-card moi-card" key={item.orderId || rowIndex}>
                {/* 头：订单号 + 下单时间 + 状态 */}
                <div className="mol-card__head">
                  <div className="mol-card__head-left">
                    <span className="moi-meta-label">{t('订单号')}：</span>
                    <span className="mol-card__sn">{item.orderSn}</span>
                    {item.addTime ? <span className="mol-card__time">{t('下单时间')}：{item.addTime}</span> : null}
                  </div>
                  <Tag color={STATUS_TAG[status] || 'grey'}>
                    {status === -1 ? t('可申请') : t(STATUS_TEXT[status] || '待审核')}
                  </Tag>
                </div>

                {/* 商品缩略图行 */}
                <div className="mol-card__items">
                  <div className="moi-thumbs">
                    {(item.items || []).map((img, index) => (
                      <Link
                        key={`${img.productId || img.productSn || index}`}
                        href={`/product/${img.productSn || ''}`}
                        title={img.productName || ''}
                        target="_blank"
                      >
                        <Image width={64} height={64} src={thumbOf(img)} alt={img.productName || ''} style={{ borderRadius: 8 }} />
                      </Link>
                    ))}
                  </div>
                </div>

                {/* 底：金额 + 操作 */}
                <div className="mol-card__foot">
                  <div className="mgl-card__meta">
                    <span>
                      {t('总金额')}：<b className="mcc-card__amount">{money(item.totalAmount)}</b>
                    </span>
                    <span>{t('运费')}：{money(item.shippingFee)}</span>
                  </div>
                  <div className="mol-card__actions">
                    {inv ? (
                      <>
                        <Button theme="borderless" onClick={() => openDialog('info', item)}>{t('查看')}</Button>
                        {status === 2 ? (
                          <Button theme="light" onClick={() => openDialog('reapply', item)}>{t('重新申请')}</Button>
                        ) : null}
                      </>
                    ) : (
                      <Button theme="solid" type="primary" onClick={() => openDialog('apply', item)}>{t('发票申请')}</Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="miq miq-empty">
            <Empty title={t('还没有可申请订单')} description={t('已完成并支付的订单会出现在这里')} />
          </div>
        )}
      </div>

      {total > size ? (
        <div className="mol-pager">
          <Pagination total={total} pageSize={size} currentPage={page} onPageChange={(next) => setPage(next)} />
        </div>
      ) : null}

      {/* 弹窗：信息查看 / 申请 / 重新申请 */}
      {dialogState ? (
        <Modal visible footer={null} width={800} closable maskClosable onCancel={closeDialog}>
          <div className="moi-dialog">
            <div className="moi-dialog__title">
              {t('发票申请')}
              {isReapply ? <span className="moi-dialog__title-extra">（{t('重新申请')}）</span> : null}
            </div>

            <div className="moi-dialog__body">
              {isInfo && dialogState && dialogInvoice ? (
                <>
                  <div className={`miq-hero miq-hero--${auditStatus === 1 ? 1 : auditStatus === 2 ? 3 : 2}`}>
                    <div className="miq-hero__main">
                      <Tag size="large" color={auditTag}>
                        {field(dialogInvoice, 'statusName', 'status_name') || t(STATUS_TEXT[auditStatus] || '待审核')}
                      </Tag>
                      {field(dialogInvoice, 'applyReply', 'apply_reply') ? (
                        <div className="miq-hero__desc">{field(dialogInvoice, 'applyReply', 'apply_reply')}</div>
                      ) : null}
                    </div>
                  </div>
                  <Descriptions
                    align="left"
                    size="medium"
                    className="moi-desc"
                    data={[
                      {
                        key: t('订单号'),
                        value: (
                          <Link href={`/member/order/info?id=${dialogState.order.orderId || ''}`} target="_blank">
                            {dialogState.order.orderSn}
                          </Link>
                        ),
                      },
                      { key: t('订单金额'), value: money(dialogState.order.totalAmount) },
                      {
                        key: t('发票金额'),
                        value: <b className="mcc-card__amount">{money(field(dialogInvoice, 'amount') || dialogState.order.balance)}</b>,
                      },
                      {
                        key: t('发票类型'),
                        value: numField(dialogInvoice, 'invoiceType', 'invoice_type', 1) === 1 ? t('普通发票') : t('增值税专用发票'),
                      },
                      { key: t('发票抬头'), value: numField(dialogInvoice, 'titleType', 'title_type', 1) === 1 ? t('个人') : t('企业') },
                      ...(numField(dialogInvoice, 'invoiceType', 'invoice_type', 1) === 1
                        ? numField(dialogInvoice, 'titleType', 'title_type', 1) === 1
                          ? [{ key: t('个人名称'), value: field(dialogInvoice, 'companyName', 'company_name') }]
                          : [
                              { key: t('企业名称'), value: field(dialogInvoice, 'companyName', 'company_name') },
                              { key: t('纳税人识号'), value: field(dialogInvoice, 'companyCode', 'company_code') },
                              { key: t('单位地址'), value: field(dialogInvoice, 'companyAddress', 'company_address') },
                              { key: t('单位电话'), value: field(dialogInvoice, 'companyPhone', 'company_phone') },
                              { key: t('开户银行'), value: field(dialogInvoice, 'companyBank', 'company_bank') },
                              { key: t('银行账户'), value: field(dialogInvoice, 'companyAccount', 'company_account') },
                            ]
                        : [
                            { key: t('单位名称'), value: field(dialogInvoice, 'companyName', 'company_name') },
                            { key: t('纳税人识别码'), value: field(dialogInvoice, 'companyCode', 'company_code') },
                            { key: t('注册地址'), value: field(dialogInvoice, 'companyAddress', 'company_address') },
                            { key: t('注册电话'), value: field(dialogInvoice, 'companyPhone', 'company_phone') },
                            { key: t('开户银行'), value: field(dialogInvoice, 'companyBank', 'company_bank') },
                            { key: t('银行账户'), value: field(dialogInvoice, 'companyAccount', 'company_account') },
                          ]),
                      { key: t('发票内容'), value: `${t('商品明细')}（${t('发票内容将显示详细商品名称与价格信息')}）` },
                      { key: t('收票人手机'), value: field(dialogInvoice, 'mobile') },
                      { key: t('收票人邮箱'), value: field(dialogInvoice, 'email') },
                    ]}
                  />
                  {invoiceImages.length ? (
                    <div className="moi-imgs">
                      <div className="moi-meta-label">{t('发票图片')}</div>
                      <div className="moi-imgs__row">
                        {invoiceImages.map((image, index) => (
                          <Image key={index} width={96} height={96} src={image.picUrl} alt="" style={{ borderRadius: 8 }} />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : dialogState ? (
                <>
                  {isReapply ? (
                    <div className={`miq-hero miq-hero--${auditStatus === 1 ? 1 : auditStatus === 2 ? 3 : 2}`}>
                      <div className="miq-hero__main">
                        <Tag size="large" color={auditTag}>
                          {field(dialogInvoice, 'statusName', 'status_name') || t(STATUS_TEXT[auditStatus] || '待审核')}
                        </Tag>
                        {field(dialogInvoice, 'applyReply', 'apply_reply') ? (
                          <div className="miq-hero__desc">{field(dialogInvoice, 'applyReply', 'apply_reply')}</div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="moi-meta-row">
                    <span>
                      {t('订单号')}：
                      <Link href={`/member/order/info?id=${dialogState.order.orderId || ''}`} target="_blank">
                        {dialogState.order.orderSn}
                      </Link>
                    </span>
                    <span>{t('订单金额')}：{money(dialogState.order.totalAmount)}</span>
                    <span>
                      {t('发票金额')}：<b className="mcc-card__amount">{money(form.amount)}</b>
                    </span>
                  </div>

                  <div className="moi-field-block">
                    <div className="miq-field__label">{t('发票类型')}</div>
                    <RadioGroup value={form.invoiceType} onChange={(event) => update('invoiceType', Number(event.target.value))}>
                      <Radio value={1}>{t('普通发票')}</Radio>
                      <Radio value={2}>{t('增值税专用发票')}</Radio>
                    </RadioGroup>
                    {form.invoiceType === 1 || invoiceStatus ? (
                      <div className="moi-extra">{t('所有发票由商品供货商开具')}</div>
                    ) : null}
                    {form.invoiceType === 2 && !invoiceStatus ? (
                      <div className="moi-extra moi-extra--warn">
                        {t('您还未通过增票资质申请，暂时无法开具增值税专用发票')}，
                        <Link href="/member/userinvoice/info">{t('点击这里')}</Link>
                        {t('去申请增票资质')}。
                      </div>
                    ) : null}
                  </div>

                  {form.invoiceType === 1 ? (
                    <>
                      <div className="moi-notes">
                        <p>{t('根据现行税收政策，部分公司提供数电票，数电（普通发票）法律效力与现有电子普通发票相同')}；</p>
                        <p>{t('电子普通发票和纸质普通发票具备同等法律效力，可支持报销入账')}；</p>
                        <p>{t('如商品由第三方卖家销售，发票类型及内容将由该卖家决定')}；</p>
                        <p>{t('如您为企业采购，需要多单合并开具或批量提交发票可注册企业用户')}；</p>
                        <p className="moi-notes--price">{t('使用礼品卡支付部分的金额，不支持开发票')}</p>
                      </div>
                      <div className="moi-field-block">
                        <div className="miq-field__label">{t('发票抬头')}</div>
                        <RadioGroup value={form.titleType} onChange={(event) => update('titleType', Number(event.target.value))}>
                          <Radio value={1}>{t('个人')}</Radio>
                          <Radio value={2}>{t('企业')}</Radio>
                        </RadioGroup>
                      </div>
                      {form.titleType === 1 ? (
                        <div className="moi-field-block">
                          <div className="miq-field__label">{t('个人名称')}</div>
                          <Input value={form.companyName} placeholder={t('请输入个人名称')} onChange={(value) => update('companyName', value)} />
                        </div>
                      ) : (
                        <div className="miq-form__grid">
                          {[
                            ['companyName', t('企业名称'), t('请输入企业名称')],
                            ['companyCode', t('纳税人识号'), t('请输入纳税人识号')],
                            ['companyAddress', t('单位地址'), t('请输入单位地址')],
                            ['companyPhone', t('单位电话'), t('请输入单位电话')],
                            ['companyBank', t('开户银行'), t('请输入开户银行')],
                            ['companyAccount', t('银行账户'), t('请输入银行账户')],
                          ].map(([key, label, placeholder]) => (
                            <div className="miq-field" key={key}>
                              <div className="miq-field__label">{label}</div>
                              <Input
                                value={String(form[key as keyof InvoiceForm] ?? '')}
                                placeholder={placeholder}
                                onChange={(value) => update(key as keyof InvoiceForm, value)}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : form.invoiceType === 2 && invoiceStatus ? (
                    <>
                      <div className="moi-notes">
                        <p>{t('我公司依法开具发票，请您按照税法规定使用发票')}。</p>
                        <p>{t('根据现行税收政策，部分公司提供数电票，数电（专用发票）法律效力与现有增值税专用发票相同')};</p>
                        <p>{t('如商品由第三方卖家销售，发票类型和内容将由该卖家决定，发票由卖家开具并提供')}。</p>
                        <p>{t('如您为企业采购，需要多单合并开具或批量提交发票可注册企业用户')}；</p>
                        <p className="moi-notes--price">{t('使用礼品卡支付部分的金额，不支持开发票')}</p>
                      </div>
                      <Descriptions
                        align="left"
                        size="medium"
                        className="moi-desc"
                        data={[
                          { key: t('单位名称'), value: form.companyName },
                          { key: t('纳税人识别码'), value: form.companyCode },
                          { key: t('注册地址'), value: form.companyAddress },
                          { key: t('注册电话'), value: form.companyPhone },
                          { key: t('开户银行'), value: form.companyBank },
                          { key: t('银行账户'), value: form.companyAccount },
                        ]}
                      />
                    </>
                  ) : null}

                  {form.invoiceType !== 0 ? (
                    <div className="miq-form__grid">
                      <div className="miq-field">
                        <div className="miq-field__label">{t('收票人手机')}</div>
                        <Input value={form.mobile} placeholder={t('请输入收票人手机')} onChange={(value) => update('mobile', value)} />
                      </div>
                      <div className="miq-field">
                        <div className="miq-field__label">{t('收票人邮箱')}</div>
                        <Input value={form.email} placeholder={t('请输入收票人邮箱')} onChange={(value) => update('email', value)} />
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="moi-dialog__footer">
              <Button theme="light" onClick={closeDialog}>{t('暂不开票')}</Button>
              {!isInfo ? (
                <Button
                  theme="solid"
                  type="primary"
                  loading={saving}
                  disabled={form.invoiceType === 2 && !invoiceStatus}
                  onClick={() => void submit()}
                >
                  {isReapply ? t('重新提交开票申请') : t('提交开票申请')}
                </Button>
              ) : null}
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
