'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

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
        if (!response.ok || (json.code !== undefined && json.code !== 0)) throw new Error(json.msg || '上传失败');
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

  if (loading) return <Card className="member-card">加载中...</Card>;
  if (!claim && !editing) return <Card className="member-card">暂无认款信息</Card>;

  const status = Number(claim?.status);
  const statusText = claim?.statusName || (status === 0 ? '待审核' : status === 1 ? '审核通过' : status === 2 ? '审核驳回' : '-');

  return (
    <Card className="member-card claim-card">
      {claim && !editing ? (
        <div className="claim-detail">
          <div className="claim-summary">
            <span>订单号：{claim.orderSn || claim.orderId || '-'}</span>
            <span>审核状态：{statusText}</span>
          </div>
          {status === 0 ? <div className="claim-tip">您已提交汇款凭证，等待财务人员核对流水，我们尽快完成审核。</div> : null}
          {status === 1 && claim.auditRemark ? <div className="claim-tip">审核备注：{claim.auditRemark}</div> : null}
          {status === 2 && claim.rejectReason ? <div className="claim-tip is-reject">认款审核未通过：{claim.rejectReason}</div> : null}
          <div className="claim-row"><span>付款金额</span><b>¥ {Number(claim.claimedAmount || 0).toFixed(2)}</b></div>
          <div className="claim-row"><span>转账时间</span><b>{claim.transferTime ? new Date(claim.transferTime).toLocaleString('zh-CN') : '-'}</b></div>
          <div className="claim-row"><span>付款人</span><b>{claim.payerName || '-'}</b></div>
          <div className="claim-row"><span>转账流水号</span><b>{claim.bankSerialNo || '-'}</b></div>
          <div className="claim-row"><span>付款凭证</span><div className="claim-vouchers">{claim.voucherUrls?.length ? claim.voucherUrls.map((url) => <img key={url} src={url} alt="付款凭证" />) : <i>暂无付款凭证</i>}</div></div>
          {status === 2 ? <Button theme="solid" type="primary" onClick={() => setEditing(true)}>修改申请</Button> : null}
        </div>
      ) : (
        <div className="security-form claim-form">
          <label>付款金额</label>
          <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="请输入付款金额" inputMode="decimal" />
          <label>转账时间</label>
          <input type="datetime-local" value={transferTime} onChange={(event) => setTransferTime(event.target.value)} />
          <label>付款人</label>
          <input value={payerName} onChange={(event) => setPayerName(event.target.value)} placeholder="请输入付款人" />
          <label>转账流水号</label>
          <input value={bankSerialNo} onChange={(event) => setBankSerialNo(event.target.value)} placeholder="请输入转账流水号" />
          <label>付款凭证（最多 5 张）</label>
          <input type="file" accept="image/*" multiple disabled={uploading || vouchers.length >= 5} onChange={(event) => void upload(event.target.files)} />
          {uploading ? <span className="claim-uploading">上传中...</span> : null}
          {vouchers.length ? <div className="claim-vouchers">{vouchers.map((url) => <img key={url} src={url} alt="付款凭证" />)}</div> : null}
          <Button theme="solid" type="primary" loading={saving} onClick={() => void submit()}>提交认款</Button>
        </div>
      )}
    </Card>
  );
}
