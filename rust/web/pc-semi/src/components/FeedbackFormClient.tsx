'use client';

import { useState } from 'react';
import { Button, Card, Toast } from '@douyinfe/semi-ui';
import { apiPost } from '@/lib/client-api';

// 与后端 UserFeedbackType 枚举一致：0建议 / 1投诉 / 2商品 / 3其他 / 4店铺投诉 / 5订单问题 / 6订单咨询
const TYPES = [
  { value: 0, label: '建议' },
  { value: 1, label: '投诉' },
  { value: 2, label: '商品' },
  { value: 3, label: '其他' },
  { value: 4, label: '店铺投诉' },
  { value: 5, label: '订单问题' },
  { value: 6, label: '订单咨询' },
];

export default function FeedbackFormClient({ orderId = 0, orderSn = '' }: { orderId?: number; orderSn?: string }) {
  const [type, setType] = useState(0);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!orderId && !title.trim()) return Toast.error({ content: '请输入主题' });
    if (!content.trim()) return Toast.error({ content: '请输入留言内容' });
    setLoading(true);
    try {
      await apiPost('user/feedback/submit', {
        type: orderId ? 6 : type,
        orderId: orderId || undefined,
        orderSn: orderSn || undefined,
        title: title.trim(),
        content: content.trim(),
      });
      Toast.success({ content: '提交成功' });
      setTitle('');
      setContent('');
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '提交失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="member-card feedback-form">
      <h2>新增留言</h2>
      <div className="security-form">
        {orderId ? (
          <>
            <label>订单编号</label>
            <input value={orderSn || String(orderId)} disabled />
          </>
        ) : (
          <>
            <label>留言类型</label>
            <div className="feedback-form__types">
              {TYPES.map((item) => (
                <button key={item.value} type="button" className={type === item.value ? 'is-active' : ''} onClick={() => setType(item.value)}>{item.label}</button>
              ))}
            </div>
          </>
        )}
        <label>主题</label>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="请输入主题" />
        <label>留言内容</label>
        <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={5} placeholder="请输入留言内容" />
        <Button theme="solid" type="primary" loading={loading} onClick={() => void submit()}>提交留言</Button>
      </div>
    </Card>
  );
}
