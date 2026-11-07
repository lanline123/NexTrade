'use client';

/**
 * 售后详情 / 退款申请详情（PC 会员中心）
 *
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/return/logInfo.vue
 * - 顶部状态头：statusName + statusDesc/兜底文案 + autoAgreeEndTime 倒计时（每秒刷新，归零后重新拉取）
 * - 可撤销：canCancel 时展示撤销按钮（POST user/aftersales/cancel）
 * - 问题补充/回寄信息表单（status!==6 && status!==7；status===4 时要求快递公司/单号）：
 *   POST user/aftersales/feedback，图片走 POST /api/user/user/uploadImg
 * - 商品明细：商品名称/价格/购买数量/小计/售后数量
 * - 售后信息：买家问题描述/售后类型/退款金额/售后原因/退货地址/上传凭证/线上/线下/余额退款金额
 * - 协商记录：发言人/时间/信息 + 记录图片
 *
 * 旧源码中「重新申请」由 ENABLE_REAPPLY=false 关闭，未迁移该按钮（缺后端接口）。
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Modal, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
interface ReturnPic {
  picUrl?: string;
  picThumb?: string;
}

interface AfterSalesItem {
  aftersalesItemId?: number;
  orderItemId?: number;
  productId?: number;
  productName?: string;
  productSn?: string;
  picThumb?: string;
  skuValue?: string;
  price?: string | number;
  quantity?: number;
  subtotal?: string | number;
  number?: number;
}

interface AfterSalesLog {
  addTime?: string;
  logInfo?: string;
  userName?: string;
  adminName?: string;
  returnPic?: ReturnPic[];
}

interface RefundInfo {
  isOnline?: number;
  isOffline?: number;
  isReceive?: number;
  onlineBalance?: string | number;
  offlineBalance?: string | number;
  refundBalance?: string | number;
}

interface AfterSaleDetail {
  aftersaleId?: number;
  aftersalesSn?: string;
  orderId?: number;
  orderSn?: string;
  status?: number;
  statusName?: string;
  statusDesc?: string;
  autoAgreeEndTime?: string;
  aftersalesTypeName?: string;
  addTime?: string;
  refundAmount?: string | number;
  description?: string;
  aftersaleReason?: string;
  reply?: string;
  returnAddress?: string;
  returnGoodsTip?: string;
  logisticsName?: string;
  trackingNo?: string;
  canCancel?: boolean;
  pics?: ReturnPic[];
  refund?: RefundInfo;
  aftersalesItems?: AfterSalesItem[];
  aftersalesLog?: AfterSalesLog[];
}

function money(value: string | number | undefined | null): string {
  return Number(value || 0).toFixed(2);
}

function imageUrl(pic?: ReturnPic | string | null): string {
  if (!pic) return '';
  if (typeof pic === 'string') return pic;
  return pic.picUrl || pic.picThumb || '';
}

function fallbackSubText(status: number | undefined): string {
  if ([0, 1, 21].includes(Number(status ?? -1))) return '您的售后申请正在处理，请耐心等待';
  if ([2, 4, 5, 22].includes(Number(status ?? -1))) return '您的退款申请已提交，请耐心等待财务处理';
  if (Number(status) === 6) return '您的退款申请已处理完成，款项将按原支付路径退回';
  return '';
}

export default function AfterSalesDetailClient({ id }: { id: number }) {
    const { t } = useTranslation();
  const [detail, setDetail] = useState<AfterSaleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [nowTs, setNowTs] = useState(Date.now());
  const [previewUrl, setPreviewUrl] = useState('');

  const [logInfo, setLogInfo] = useState('');
  const [logisticsName, setLogisticsName] = useState('');
  const [trackingNo, setTrackingNo] = useState('');
  const [returnAddress, setReturnAddress] = useState('');
  const [returnPic, setReturnPic] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiGet<AfterSaleDetail>('user/aftersales/detail', { id })
      .then((result) => {
        setDetail(result || null);
        setLogInfo(result?.aftersalesLog?.[0]?.logInfo ? '' : '');
        setReturnAddress(result?.returnAddress || '');
        setLogisticsName(result?.logisticsName || '');
        setTrackingNo(result?.trackingNo || '');
        setReturnPic([]);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : '';
        setNeedLogin(message.includes('登录') || message.includes('401'));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 自动同意截止时间倒计时（旧版每秒刷新，归零后重新拉取一次）
  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const autoAgreeEndMs = useMemo(() => {
    const raw = String(detail?.autoAgreeEndTime || '');
    if (!raw) return 0;
    const ms = Date.parse(raw.replace(/-/g, '/'));
    return Number.isFinite(ms) ? ms : 0;
  }, [detail?.autoAgreeEndTime]);

  const isProcessing = [0, 1, 21].includes(Number(detail?.status ?? -1));
  const showCountdown = isProcessing && autoAgreeEndMs > nowTs;
  const countdownText = useMemo(() => {
    const diff = autoAgreeEndMs - nowTs;
    if (diff <= 0) return '';
    const totalSec = Math.floor(diff / 1000);
    const days = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return days > 0 ? t('{d}天{t}', { d: days, t: `${pad(h)}:${pad(m)}:${pad(s)}` }) : `${pad(h)}:${pad(m)}:${pad(s)}`;
  }, [autoAgreeEndMs, nowTs]);

  const status = Number(detail?.status ?? -1);
  const statusSubText = showCountdown ? '' : String(detail?.statusDesc || '').trim() || fallbackSubText(status);
  const canFeedback = !!detail && status !== 6 && status !== 7;

  const cancel = () => {
    if (!id) return;
    Modal.confirm({
      title: '确认要撤销申请吗',
      content: '撤销后该售后申请将关闭，如需售后需重新发起申请。',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await apiPost('user/aftersales/cancel', { aftersaleId: detail?.aftersaleId || id });
          Toast.success({ content: '撤销成功' });
          window.location.replace('/member/return/log');
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : '取消失败' });
        }
      },
    });
  };

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
        const data = json.data;
        const url = typeof data === 'string' ? data : data?.url || data?.picUrl;
        if (typeof url === 'string') urls.push(url);
      }
      setReturnPic((current) => [...current, ...urls].slice(0, 5));
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '凭证上传失败' });
    } finally {
      setUploading(false);
    }
  };

  const submitFeedback = async () => {
    if (!detail) return;
    if (Number(detail.status) === 4) {
      if (!logisticsName.trim()) return Toast.error({ content: '快递公司不能为空!' });
      if (!trackingNo.trim()) return Toast.error({ content: '快递单号不能为空!' });
    }
    if (!logInfo.trim() && !returnPic.length && !logisticsName.trim() && !trackingNo.trim()) {
      return Toast.error({ content: '请填写问题补充、回寄信息或上传凭证' });
    }
    setSubmitting(true);
    try {
      await apiPost('user/aftersales/feedback', {
        id: detail.aftersaleId || id,
        logInfo: logInfo.trim() || undefined,
        returnAddress: returnAddress || undefined,
        logisticsName: logisticsName.trim() || undefined,
        trackingNo: trackingNo.trim() || undefined,
        returnPic: returnPic.map((picUrl) => ({ picUrl })),
      });
      Toast.success({ content: '提交成功' });
      setLogInfo('');
      setReturnPic([]);
      load();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '提交失败' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Card className="cart-state">{t('售后详情加载中...')}</Card>;
  if (needLogin) {
    return (
      <Card className="cart-state">
        <h2>{t('登录后查看售后详情')}</h2>
        <Link href={`/login?redirect=/member/return/logInfo?id=${id}`}><Button theme="solid" type="primary">{t('去登录')}</Button></Link>
      </Card>
    );
  }
  if (!detail) return <Card className="cart-state">{t('售后单不存在')}</Card>;

  const items = detail.aftersalesItems || [];
  const logs = detail.aftersalesLog || [];
  const pics = detail.pics || [];
  const refund = detail.refund;

  return (
    <div className="member-return-loginfo">
      {detail.returnGoodsTip ? <div className="return-goods-tip">{detail.returnGoodsTip}</div> : null}

      <div className="return-status-header">
        <div className="return-status-title">{detail.statusName || ''}</div>
        {detail.canCancel ? (
          <div className="return-status-actions">
            <Button size="small" onClick={cancel}>{t('撤销')}</Button>
          </div>
        ) : null}
        {showCountdown ? (
          <div className="return-status-sub">{t('订单将在')}<span className="return-countdown">{countdownText}</span>{t('后自动同意您的退款申请')}</div>
        ) : statusSubText ? (
          <div className="return-status-sub">{statusSubText}</div>
        ) : null}
      </div>

      {canFeedback ? (
        <section className="return-form-card">
          <div className="return-form-field">
            <label>{t('问题补充')}</label>
            <textarea value={logInfo} onChange={(e) => setLogInfo(e.target.value)} rows={4} placeholder={t('请输入问题补充')} />
          </div>
          {status === 4 ? (
            <>
              <div className="return-form-field">
                <label>{t('回寄地址')}</label>
                <textarea value={returnAddress} readOnly rows={3} />
              </div>
              <div className="return-form-field">
                <label>{t('快递公司')}<i className="required">*</i></label>
                <input value={logisticsName} onChange={(e) => setLogisticsName(e.target.value)} placeholder={t('请输入快递公司')} />
              </div>
              <div className="return-form-field">
                <label>{t('快递单号')}<i className="required">*</i></label>
                <input value={trackingNo} onChange={(e) => setTrackingNo(e.target.value)} placeholder={t('请输入快递单号')} />
              </div>
            </>
          ) : null}
          <div className="return-form-field">
            <label>{t('上传凭证')}</label>
            <div className="return-upload">
              <input type="file" accept="image/jpeg,image/png" multiple disabled={uploading || returnPic.length >= 5} onChange={(e) => void upload(e.target.files)} />
              {uploading ? <span>{t('上传中...')}</span> : null}
              <div className="return-upload-list">
                {returnPic.map((url, index) => (
                  <div className="return-upload-item" key={`${url}-${index}`}>
                    <img src={url} alt="" onClick={() => setPreviewUrl(url)} />
                    <button type="button" onClick={() => setReturnPic((current) => current.filter((_, i) => i !== index))}>{t('删除')}</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="return-form-actions">
            <Button type="primary" loading={submitting} onClick={() => void submitFeedback()}>{t('提交')}</Button>
          </div>
        </section>
      ) : null}

      <section className="return-info-card">
        <table className="return-table">
          <thead>
            <tr>
              <th>{t('商品名称')}</th>
              <th style={{ width: 80 }}>{t('商品价格')}</th>
              <th style={{ width: 80 }}>{t('购买数量')}</th>
              <th style={{ width: 80 }}>{t('小计')}</th>
              <th style={{ width: 80 }}>{t('售后数量')}</th>
            </tr>
          </thead>
          <tbody>
            {items.length ? items.map((item, index) => (
              <tr key={item.aftersalesItemId || item.orderItemId || index}>
                <td>
                  <Link href={item.productId ? `/product/${item.productId}` : '/search'} target="_blank" className="return-product">
                    <img src={item.picThumb || ''} alt={item.productName || ''} />
                    <div>
                      <div className="return-product__sn">货号：{item.productSn || '-'}</div>
                      <div className="return-product__name">{item.productName || '-'}</div>
                      {item.skuValue ? <div className="return-product__sku">{item.skuValue}</div> : null}
                    </div>
                  </Link>
                </td>
                <td>¥{money(item.price)}</td>
                <td>{item.quantity ?? 0}</td>
                <td>¥{money(item.subtotal ?? Number(item.price || 0) * Number(item.quantity || 0))}</td>
                <td>{item.number ?? 0}</td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="return-empty">{t('暂无售后商品')}</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="return-info-card">
        <table className="return-table return-table--detail">
          <tbody>
            <tr><td>{t('买家问题描述')}</td><td>{detail.description || '-'}</td></tr>
            <tr><td>{t('售后类型')}</td><td>{detail.aftersalesTypeName || '-'}</td></tr>
            <tr><td>{t('退款金额')}</td><td>¥{money(detail.refundAmount)}</td></tr>
            <tr><td>{t('售后原因')}</td><td>{detail.aftersaleReason || '-'}</td></tr>
            {status === 4 ? <tr><td>{t('退货地址')}</td><td>{detail.returnAddress || '-'}</td></tr> : null}
            <tr>
              <td>{t('上传凭证')}</td>
              <td>
                <div className="return-pics">
                  {pics.length ? pics.map((pic, index) => (
                    <img
                      key={index}
                      src={imageUrl(pic)}
                      alt=""
                      style={{ width: 80, height: 80, objectFit: 'cover', cursor: 'zoom-in' }}
                      onClick={() => setPreviewUrl(imageUrl(pic))}
                    />
                  )) : '-'}
                </div>
              </td>
            </tr>
            {refund && Number(refund.isOnline) > 0 ? <tr><td>{t('线上退款金额')}</td><td>¥{money(refund.onlineBalance)}</td></tr> : null}
            {refund && Number(refund.isOffline) > 0 ? <tr><td>{t('线下退款金额')}</td><td>¥{money(refund.offlineBalance)}</td></tr> : null}
            {refund && Number(refund.isReceive) > 0 ? <tr><td>{t('余额退款金额')}</td><td>¥{money(refund.refundBalance)}</td></tr> : null}
            <tr><td>{t('售后单号')}</td><td>{detail.aftersalesSn || '-'}</td></tr>
            <tr><td>{t('关联订单')}</td><td>{detail.orderSn || '-'}</td></tr>
            <tr><td>{t('申请时间')}</td><td>{detail.addTime || '-'}</td></tr>
          </tbody>
        </table>
      </section>

      <section className="return-info-card">
        <table className="return-table">
          <thead>
            <tr>
              <th style={{ width: 120 }}>{t('发言人')}</th>
              <th style={{ width: 180 }}>{t('时间')}</th>
              <th>{t('信息')}</th>
            </tr>
          </thead>
          <tbody>
            {logs.length ? logs.map((log, index) => (
              <tr key={index}>
                <td>{log.userName || log.adminName || '-'}</td>
                <td>{log.addTime || '-'}</td>
                <td>
                  <div className="return-log-message">
                    <div>{log.logInfo || ''}</div>
                    <div className="return-pics">
                      {(log.returnPic || []).map((pic, picIndex) => (
                        <img
                          key={picIndex}
                          src={imageUrl(pic)}
                          alt=""
                          style={{ width: 80, height: 80, objectFit: 'cover', cursor: 'zoom-in' }}
                          onClick={() => setPreviewUrl(imageUrl(pic))}
                        />
                      ))}
                    </div>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={3} className="return-empty">{t('暂无协商记录')}</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <div className="return-loginfo-links">
        <Link href="/member/aftersales">{t('售后申请')}</Link>
        <Link href="/member/return/log">{t('申请记录')}</Link>
        {detail.orderId ? <Link href={`/member/order/detail?id=${detail.orderId}`}>{t('查看订单')}</Link> : null}
      </div>

      <Modal
        visible={!!previewUrl}
        footer={null}
        title={t('查看图片')}
        onCancel={() => setPreviewUrl('')}
        width={640}
      >
        {previewUrl ? <img src={previewUrl} alt="" style={{ width: '100%', display: 'block' }} /> : null}
      </Modal>
    </div>
  );
}
