'use client';

import { useEffect, useState } from 'react';
import { Toast } from '@douyinfe/semi-ui';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
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
  bankSerialNo?: string;
  voucherUrls?: string[];
}

export default function OfflineClaimClient({ orderId }: { orderId: number }) {
    const { t } = useTranslation();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState('');
  const [transferTime, setTransferTime] = useState('');
  const [payerName, setPayerName] = useState('');
  const [bankSerialNo, setBankSerialNo] = useState('');
  const [vouchers, setVouchers] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiGet<Claim | null>('user/order/offlinePaymentClaim/detail', { orderId })
      .then((result) => {
        setClaim(result || null);
        setEditing(!result);
        setAmount(String(result?.claimedAmount || ''));
        setTransferTime(result?.transferTime ? String(result.transferTime) : '');
        setPayerName(result?.payerName || '');
        setBankSerialNo(result?.bankSerialNo || '');
        setVouchers(result?.voucherUrls || []);
      })
      .catch(() => setClaim(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [orderId]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const body = new FormData();
        body.append('file', file);
        const token = localStorage.getItem('accessToken');
        const response = await fetch('/api/user/user/uploadImg', {
          method: 'POST',
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body,
        });
        const json = await response.json();
        if (!response.ok || (json.code !== undefined && json.code !== 0)) throw new Error(json.msg || t('上传失败'));
        const url = json.data?.url || json.data?.picUrl || json.data;
        if (typeof url === 'string') urls.push(url);
      }
      setVouchers((current) => [...current, ...urls].slice(0, 5));
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '凭证上传失败' });
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!orderId) return Toast.error({ content: '缺少订单 ID' });
    if (!amount || Number(amount) <= 0) return Toast.error({ content: '请输入付款金额' });
    if (!payerName.trim()) return Toast.error({ content: '请输入付款人' });
    if (!vouchers.length) return Toast.error({ content: '请上传付款凭证' });
    setSaving(true);
    try {
      await apiPost('user/order/offlinePaymentClaim/submit', {
        orderId,
        claimedAmount: Number(amount),
        transferTime: transferTime ? new Date(transferTime).getTime() : Date.now(),
        payerName: payerName.trim(),
        bankSerialNo: bankSerialNo.trim(),
        voucherUrls: vouchers,
      });
      Toast.success({ content: '提交成功，等待财务审核' });
      setEditing(false);
      load();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '提交失败' });
    } finally {
      setSaving(false);
    }
  };

  const status = Number(claim?.status);
  const statusText =
    claim?.statusName || (status === 0 ? t('待审核') : status === 1 ? t('审核通过') : status === 2 ? t('审核驳回') : '-');
  const voucherImages = claim?.voucherUrls || [];

  return (
    <>
      {/* 旧版 claimInfo.vue: .title-or-tabs.right-info > span + .header-actions */}
      <div className="title-or-tabs right-info">
        <span>{t('认款详情')}</span>
        <div className="header-actions">
          {orderId ? (
            <Link href={`/member/order/info?id=${orderId}`}>
              <button type="button" className="el-button">{t('订单详情')}</button>
            </Link>
          ) : null}
          {claim && status === 2 && !editing ? (
            <button type="button" className="el-button el-button--primary" onClick={() => setEditing(true)}>
              {t('修改申请')}
            </button>
          ) : null}
        </div>
      </div>

      {/* 旧版 claimInfo.vue: .claim-page */}
      <div className="claim-page">
        {!claim && !editing && !loading ? (
          <div className="el-empty">
            <div className="el-empty__description">
              <p>{t('暂无认款信息')}</p>
            </div>
          </div>
        ) : editing ? (
          <section className="detail-section">
            <div className="sub-title">{t('修改申请')}</div>
            <div className="edit-form">
              <form className="el-form">
                <div className="el-form-item">
                  <label className="el-form-item__label" style={{ width: '110px' }}>{t('付款金额')}：</label>
                  <div className="el-form-item__content">
                    <div className="el-input">
                      <div className="el-input__wrapper">
                        <input
                          className="el-input__inner"
                          value={amount}
                          onChange={(event) => setAmount(event.target.value)}
                          placeholder={t('请输入')}
                          inputMode="decimal"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="el-form-item">
                  <label className="el-form-item__label" style={{ width: '110px' }}>{t('转账时间')}：</label>
                  <div className="el-form-item__content">
                    <div className="el-input">
                      <div className="el-input__wrapper">
                        <input
                          className="el-input__inner"
                          type="datetime-local"
                          value={transferTime}
                          onChange={(event) => setTransferTime(event.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="el-form-item">
                  <label className="el-form-item__label" style={{ width: '110px' }}>{t('付款人姓名')}：</label>
                  <div className="el-form-item__content">
                    <div className="el-input">
                      <div className="el-input__wrapper">
                        <input
                          className="el-input__inner"
                          value={payerName}
                          onChange={(event) => setPayerName(event.target.value)}
                          placeholder={t('请输入')}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="el-form-item">
                  <label className="el-form-item__label" style={{ width: '110px' }}>{t('转账流水号')}：</label>
                  <div className="el-form-item__content">
                    <div className="el-input">
                      <div className="el-input__wrapper">
                        <input
                          className="el-input__inner"
                          value={bankSerialNo}
                          onChange={(event) => setBankSerialNo(event.target.value)}
                          placeholder={t('请填写')}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="el-form-item">
                  <label className="el-form-item__label" style={{ width: '110px' }}>
                    <span style={{ color: 'var(--price)' }}>*</span>
                    {t('付款凭证')}：
                  </label>
                  <div className="el-form-item__content">
                    <div className="claim-upload-wrap">
                      <div className="el-upload claim-uploader el-upload--picture-card">
                        <div className="el-upload-list el-upload-list--picture-card">
                          {vouchers.map((url) => (
                            <div className="el-upload-list__item" key={url}>
                              <img className="el-upload-list__item-thumbnail" src={url} alt="" />
                              <span className="el-upload-list__item-actions">
                                <span
                                  className="el-upload-list__item-delete"
                                  onClick={() => setVouchers(vouchers.filter((item) => item !== url))}
                                >
                                  ×
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                        {vouchers.length < 5 ? (
                          <div className="el-upload__trigger">
                            <label className="claim-upload-trigger">
                              +
                              <input
                                className="native-file-input"
                                type="file"
                                accept="image/png,image/jpeg,image/gif,image/webp,image/tiff"
                                multiple
                                hidden
                                disabled={uploading}
                                onChange={(event) => void upload(event.target.files)}
                              />
                            </label>
                          </div>
                        ) : null}
                      </div>
                      <div className="upload-tip">{uploading ? t('上传中...') : t('最多上传5张')}</div>
                    </div>
                  </div>
                </div>
              </form>
              <div className="page-actions">
                <button type="button" className="el-button" onClick={() => setEditing(false)}>{t('取消')}</button>
                <button type="button" className="el-button el-button--primary" disabled={saving} onClick={() => void submit()}>
                  {t('确认')}
                </button>
              </div>
            </div>
          </section>
        ) : claim ? (
          <>
            <div className="claim-summary">
              <div className="summary-row">
                <span>
                  <span className="summary-label">{t('订单号')}：</span>
                  <strong className="summary-value">{claim.orderSn || claim.orderId || '-'}</strong>
                </span>
                <span>
                  <span className="summary-label">{t('审核状态')}：</span>
                  <strong className="summary-value">{statusText}</strong>
                </span>
              </div>
              {status === 0 ? (
                <div className="status-tip">{t('您已提交汇款凭证，等待财务人员核对流水，我们尽快完成审核。')}</div>
              ) : null}
              {status === 1 && claim.auditRemark ? (
                <div className="status-tip">
                  {t('审核备注')}：{claim.auditRemark}
                </div>
              ) : null}
              {status === 2 && claim.rejectReason ? (
                <div className="status-tip reject-reason">
                  {t('认款审核未通过')}：{claim.rejectReason}
                </div>
              ) : null}
            </div>

            <section className="detail-section">
              <div className="sub-title">{t('付款信息')}</div>
              <div className="detail-grid">
                <div className="claim-row">
                  <span>{t('付款金额')}：</span>
                  <b style={{ color: 'var(--price)', fontSize: '16px' }}>¥ {Number(claim.claimedAmount || 0).toFixed(2)}</b>
                </div>
                <div className="claim-row">
                  <span>{t('转账时间')}：</span>
                  <b>{claim.transferTime ? new Date(claim.transferTime).toLocaleString('zh-CN') : '-'}</b>
                </div>
                <div className="claim-row">
                  <span>{t('付款人')}：</span>
                  <b>{claim.payerName || '-'}</b>
                </div>
                <div className="claim-row">
                  <span>{t('转账流水号')}：</span>
                  <b>{claim.bankSerialNo || '-'}</b>
                </div>
              </div>
              <div className="claim-row voucher-row">
                <span>{t('付款凭证')}：</span>
                {voucherImages.length ? (
                  <div className="voucher-list">
                    {voucherImages.map((url) => (
                      <img key={url} className="voucher-image" src={url} alt={t('付款凭证')} />
                    ))}
                  </div>
                ) : (
                  <span className="empty-text">{t('暂无付款凭证')}</span>
                )}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </>
  );
}
