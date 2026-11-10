'use client';

/**
 * 线下支付认领弹窗（认款详情 / 修改申请）
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/components/member/order/OfflinePaymentClaimDetail.vue
 *
 * 旧版行为：
 * - 弹窗标题「认款详情」；editable && status === 2（审核驳回）时切「修改申请」表单；
 * - 详情区：订单号 / 认款状态 / 按状态显示提示语（待审核 / 审核备注 / 驳回原因）；
 * - 付款信息区：付款金额 / 转账时间 / 付款人 / 转账流水号 / 付款凭证（多图，可预览）；
 * - 表单区（editable）：付款金额（只读）、转账时间（日期选择器，不能选未来）、
 *   付款人姓名、转账流水号、付款凭证上传（最多 5 张，png/jpeg/gif/webp/tiff）。
 * - 提交 `POST /user/order/offlinePaymentClaim/submit`，成功后关闭并刷新列表。
 *
 * 后端契约：
 * - GET  /user/order/offlinePaymentClaim/detail?orderId=  返回 OfflinePaymentClaimVO
 *   （status 0 待审核 / 1 审核通过 / 2 已驳回，transferTime 为**秒级**时间戳）；
 * - POST /user/order/offlinePaymentClaim/submit  入参
 *   { orderId, transferTime(秒), payerName, payerAccount, bankSerialNo, voucherUrls[] }，
 *   付款金额由后端按订单应付金额计算，前端不传（与旧版不同，Rust DTO 无 claimedAmount 字段）。
 * - POST /user/user/uploadImg  凭证图片上传，返回 { picUrl, picThumb }。
 */
import { useCallback, useEffect, useState } from 'react';
import { Button, Image, Input, Modal, Spin, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';

import { formatPrice } from '@/lib/currency';
interface Claim {
  claimId?: number;
  orderId?: number;
  orderSn?: string;
  status?: number;
  statusName?: string;
  auditRemark?: string;
  rejectReason?: string;
  claimedAmount?: number | string;
  transferTime?: number | string;
  payerName?: string;
  payerAccount?: string;
  bankSerialNo?: string;
  voucherUrls?: string[];
}

const VOUCHER_LIMIT = 5;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/tiff'];

/** 秒级时间戳 → 「YYYY-MM-DD HH:mm」（对齐旧版 utils/transferTime.ts） */
function formatTransferTime(timestamp?: number | string): string {
  const seconds = Number(timestamp || 0);
  if (!seconds) return '';
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 「YYYY-MM-DD HH:mm」→ 秒级时间戳（对齐旧版 utils/transferTime.ts） */
function parseTransferTime(value?: string): number {
  if (!value) return 0;
  const time = new Date(`${value.replace(/-/g, '/')}:00`).getTime();
  return Number.isNaN(time) ? 0 : Math.floor(time / 1000);
}

export default function MemberOfflineClaimDialog({
  visible,
  orderId,
  editable,
  onClose,
  onSubmitted,
}: {
  visible: boolean;
  orderId: number;
  /** 是否可编辑（驳回后重新提交） */
  editable?: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { t } = useTranslation();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [transferTime, setTransferTime] = useState('');
  const [payerName, setPayerName] = useState('');
  const [bankSerialNo, setBankSerialNo] = useState('');
  const [vouchers, setVouchers] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const result = await apiGet<Claim | null>('user/order/offlinePaymentClaim/detail', { orderId });
      setClaim(result || null);
      setTransferTime(formatTransferTime(result?.transferTime));
      setPayerName(result?.payerName || '');
      setBankSerialNo(result?.bankSerialNo || '');
      setVouchers(Array.isArray(result?.voucherUrls) ? result.voucherUrls : []);
    } catch {
      setClaim(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!visible) return;
    void load();
  }, [visible, load]);

  const isEdit = Boolean(editable) && Number(claim?.status) === 2;

  const uploadVoucher = async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      Toast.error({ content: t('不支持上传此文件格式') });
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
      const url = typeof data === 'string' ? data : String(data?.picUrl || data?.url || '');
      if (!url) {
        Toast.error({ content: t('上传失败') });
        return;
      }
      setVouchers((current) => [...current, url].slice(0, VOUCHER_LIMIT));
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('上传失败') });
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!vouchers.length) return Toast.error({ content: t('付款凭证必传') });
    if (!payerName.trim()) return Toast.error({ content: t('请输入付款人姓名') });
    setSubmitting(true);
    try {
      await apiPost('user/order/offlinePaymentClaim/submit', {
        orderId,
        transferTime: parseTransferTime(transferTime),
        payerName: payerName.trim(),
        bankSerialNo: bankSerialNo.trim(),
        voucherUrls: vouchers,
      });
      Toast.success({ content: t('提交成功，等待财务审核') });
      onClose();
      onSubmitted();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('提交失败，请稍后重试') });
    } finally {
      setSubmitting(false);
    }
  };

  const status = Number(claim?.status);
  const statusText = claim?.statusName || (status === 0 ? t('待审核') : status === 1 ? t('审核通过') : status === 2 ? t('审核驳回') : '-');

  return (
    <Modal
      title={isEdit ? t('修改申请') : t('认款详情')}
      visible={visible}
      width={isEdit ? 500 : 620}
      onCancel={onClose}
      footer={
        isEdit ? (
          <>
            <Button onClick={onClose}>{t('取消')}</Button>
            <Button theme="solid" type="primary" loading={submitting} onClick={() => void submit()}>{t('确认')}</Button>
          </>
        ) : (
          <Button onClick={onClose}>{t('关闭')}</Button>
        )
      }
    >
      {loading ? (
        <div className="member-claim__loading"><Spin /></div>
      ) : !claim ? (
        <div className="member-claim__empty">{t('暂无认款信息')}</div>
      ) : isEdit ? (
        <div className="member-claim__form">
          <div className="member-claim__row">
            <label>{t('付款金额')}</label>
            <span className="member-claim__readonly">{formatPrice(Number(claim.claimedAmount || 0))}</span>
          </div>
          <div className="member-claim__row">
            <label>{t('转账时间')}</label>
            <input
              type="datetime-local"
              value={transferTime}
              max={formatTransferTime(Math.floor(Date.now() / 1000))}
              onChange={(event) => setTransferTime(event.target.value.replace('T', ' '))}
            />
          </div>
          <div className="member-claim__row">
            <label>{t('付款人姓名')}</label>
            <input value={payerName} onChange={(event) => setPayerName(event.target.value)} placeholder={t('请输入')} />
          </div>
          <div className="member-claim__row">
            <label>{t('转账流水号')}</label>
            <input value={bankSerialNo} onChange={(event) => setBankSerialNo(event.target.value)} placeholder={t('请填写')} />
          </div>
          <div className="member-claim__row member-claim__row--upload">
            <label>{t('付款凭证')}</label>
            <div className="member-claim__uploader">
              <div className="member-claim__vouchers">
                {vouchers.map((url, index) => (
                  <span className="member-claim__voucher" key={url + index}>
                    <Image
                      src={url}
                      width={80}
                      height={80}
                      preview={{ src: vouchers, currentIndex: index }}
                      style={{ cursor: 'pointer' }}
                    />
                    <button type="button" onClick={() => setVouchers((current) => current.filter((_, i) => i !== index))}>×</button>
                  </span>
                ))}
                {vouchers.length < VOUCHER_LIMIT ? (
                  <label className="member-claim__voucher member-claim__voucher--add">
                    {uploading ? t('上传中...') : '+'}
                    <input
                      type="file"
                      accept={ACCEPTED_TYPES.join(',')}
                      hidden
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadVoucher(file);
                        event.target.value = '';
                      }}
                    />
                  </label>
                ) : null}
              </div>
              <div className="member-claim__upload-tip">{t('最多上传5张')}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="member-claim">
          <div className="member-claim__summary">
            <div className="member-claim__summary-row">
              <div><span>{t('订单号')}：</span><b>{claim.orderSn || claim.orderId || '-'}</b></div>
              <div><span>{t('认款状态')}：</span><b className={`member-claim__status is-${status}`}>{statusText}</b></div>
            </div>
            {status === 0 ? <div className="member-claim__tip">{t('您已提交汇款凭证，等待财务人员核对流水，我们尽快完成审核。')}</div> : null}
            {status === 1 && claim.auditRemark ? <div className="member-claim__tip">{t('审核备注')}：{claim.auditRemark}</div> : null}
            {status === 2 && claim.rejectReason ? <div className="member-claim__tip">{t('认款审核未通过')}：{claim.rejectReason}</div> : null}
          </div>
          <section className="member-claim__section">
            <h3>{t('付款信息')}</h3>
            <div className="member-claim__grid">
              <div className="member-claim__grid-row"><span>{t('付款金额')}：</span><b>{formatPrice(Number(claim.claimedAmount || 0))}</b></div>
              <div className="member-claim__grid-row"><span>{t('转账时间')}：</span><b>{formatTransferTime(claim.transferTime) || '-'}</b></div>
              <div className="member-claim__grid-row"><span>{t('付款人')}：</span><b>{claim.payerName || '-'}</b></div>
              <div className="member-claim__grid-row"><span>{t('转账流水号')}：</span><b>{claim.bankSerialNo || '-'}</b></div>
            </div>
            <div className="member-claim__grid-row member-claim__grid-row--voucher">
              <span>{t('付款凭证')}：</span>
              {vouchers.length ? (
              <div className="member-claim__vouchers">
                {vouchers.map((url, index) => (
                  <Image
                    key={url + index}
                    src={url}
                    width={88}
                    height={88}
                    preview={{ src: vouchers, currentIndex: index }}
                    style={{ cursor: 'pointer' }}
                  />
                ))}
              </div>
              ) : (
                <i className="member-claim__empty-text">{t('暂无付款凭证')}</i>
              )}
            </div>
          </section>
        </div>
      )}

    </Modal>
  );
}
