'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Input, Select, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

interface ApplyItem {
  itemId: number;
  productName?: string;
  picThumb?: string;
  price?: number;
  quantity?: number;
  canApplyQuantity?: number;
  skuData?: Array<{ value?: string }>;
}

interface ApplyData {
  list?: ApplyItem[];
  order?: { orderId?: number; orderSn?: string; totalAmount?: number };
}

interface ApplyConfig {
  aftersaleType?: Record<string, string>;
  aftersaleReason?: string[];
  afterSalesReasonEnabled?: number;
}

export default function AfterSalesApplyClient({ orderId, itemId }: { orderId: number; itemId: number }) {
  const [data, setData] = useState<ApplyData | null>(null);
  const [config, setConfig] = useState<ApplyConfig>({});
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [type, setType] = useState(1);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  /** 源码 return/Info.vue 问题描述凭证图片 pics */
  const [pics, setPics] = useState<Array<Record<string, unknown>>>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);

  useEffect(() => {
    Promise.all([
      apiGet<ApplyConfig>('user/aftersales/config', { orderId }),
      apiGet<ApplyData>('user/aftersales/applyData', { orderId, itemId: itemId || undefined }),
    ])
      .then(([configResult, dataResult]) => {
        setConfig(configResult || {});
        setData(dataResult || {});
        const initial: Record<number, number> = {};
        (dataResult?.list || []).forEach((item) => {
          if (itemId && item.itemId === itemId) initial[item.itemId] = 1;
        });
        setQuantities(initial);
        setReason(configResult?.aftersaleReason?.[0] || '');
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : '';
        setNeedLogin(message.includes('登录') || message.includes('401'));
        Toast.error({ content: message || '售后数据加载失败' });
      })
      .finally(() => setLoading(false));
  }, [orderId, itemId]);

  const selectedItems = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, number]) => Number(number) > 0)
        .map(([id, number]) => ({ orderItemId: Number(id), number: Number(number) })),
    [quantities],
  );

  const toggleItem = (item: ApplyItem, checked: boolean) => {
    setQuantities((current) => {
      const next = { ...current };
      if (checked) next[item.itemId] = 1;
      else delete next[item.itemId];
      return next;
    });
  };

  /** 源码 form/src/UploadImage.vue：凭证上传 /api/user/user/uploadImg */
  const uploadPic = async (file: File) => {
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
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body,
        credentials: 'include',
      });
      const json = await response.json();
      if (json?.code !== undefined && json.code !== 0) {
        Toast.error({ content: String(json?.msg || json?.message || '上传失败') });
        return;
      }
      const data = json?.data;
      const url = typeof data === 'string' ? data : String(data?.picUrl || data?.url || '');
      if (url) setPics((current) => [...current, { picUrl: url, picThumb: String(data?.picThumb || url) }]);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '上传失败' });
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!selectedItems.length) {
      Toast.warning({ content: '请选择售后商品' });
      return;
    }
    setSubmitting(true);
    try {
      await apiPost('user/aftersales/create', {
        orderId,
        aftersaleType: type,
        aftersaleReason: reason,
        description,
        pics,
        items: selectedItems,
      });
      Toast.success({ content: '售后申请已提交' });
      window.location.replace('/member/aftersales');
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '提交失败' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Card className="cart-state">售后申请数据加载中...</Card>;
  if (needLogin) {
    return (
      <Card className="cart-state">
        <h2>登录后申请售后</h2>
        <Link href={`/login?redirect=/member/aftersales/apply?orderId=${orderId}`}><Button theme="solid" type="primary">去登录</Button></Link>
      </Card>
    );
  }

  return (
    <div className="member-aftersales-apply">
      <Card className="member-card" title={`订单 ${data?.order?.orderSn || orderId}`}>
        <div className="member-aftersales-apply__items">
          {(data?.list || []).map((item) => {
            const checked = Boolean(quantities[item.itemId]);
            const max = Number(item.canApplyQuantity || item.quantity || 1);
            return (
              <div key={item.itemId} className="member-aftersales-apply__item">
                <input type="checkbox" checked={checked} onChange={(event) => toggleItem(item, event.target.checked)} />
                <img src={item.picThumb || ''} alt={item.productName || ''} />
                <div>
                  <b>{item.productName}</b>
                  <span>{item.skuData?.map((sku) => sku.value).filter(Boolean).join(' / ')}</span>
                  <span>可申请数量：{max}</span>
                </div>
                <span>¥ {Number(item.price || 0).toFixed(2)}</span>
                <Input
                  type="number"
                  value={String(quantities[item.itemId] || 1)}
                  disabled={!checked}
                  onChange={(value) => {
                    const number = Math.max(1, Math.min(max, Number(value) || 1));
                    setQuantities((current) => ({ ...current, [item.itemId]: number }));
                  }}
                />
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="member-card" title="售后信息">
        <div className="member-aftersales-apply__form">
          <label>售后类型</label>
          <Select value={type} onChange={(value) => setType(Number(value))}>
            {Object.entries(config.aftersaleType || { '1': '退货/退款', '2': '仅退款' }).map(([key, label]) => (
              <Select.Option key={key} value={Number(key)}>{label}</Select.Option>
            ))}
          </Select>
          <label>售后原因</label>
          {Number(config.afterSalesReasonEnabled ?? 1) === 1 && config.aftersaleReason?.length ? (
            <Select value={reason} onChange={(value) => setReason(String(value))}>
              {config.aftersaleReason.map((item) => <Select.Option key={item} value={item}>{item}</Select.Option>)}
            </Select>
          ) : (
            <Input value={reason} onChange={setReason} placeholder="请输入售后原因" />
          )}
          <label>问题描述</label>
          <Input value={description} onChange={setDescription} placeholder="请描述遇到的问题" />
        </div>

        {/* 源码 return/Info.vue：上传凭证图片（最多 5 张，单张 2M） */}
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8, color: '#666', fontSize: 13 }}>上传凭证</div>
          <div className="aftersales-pics">
            {pics.map((pic, index) => (
              <span className="aftersales-pics__item" key={index}>
                <img src={String(pic.picThumb || pic.picUrl || '')} alt="凭证" />
                <button type="button" onClick={() => setPics((current) => current.filter((_, i) => i !== index))}>×</button>
              </span>
            ))}
            {pics.length < 5 ? (
              <label className="aftersales-pics__pick">
                {uploading ? '上传中...' : '+ 上传'}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadPic(file);
                    event.target.value = '';
                  }}
                />
              </label>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="member-aftersales-apply__actions">
        <Link href="/member/aftersales">返回售后列表</Link>
        <Button theme="solid" type="primary" size="large" loading={submitting} disabled={!selectedItems.length} onClick={submit}>
          提交申请
        </Button>
      </div>
    </div>
  );
}
