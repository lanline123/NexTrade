'use client';

/**
 * 我的留言 / 订单咨询
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/feedback/
 *   List.vue（我的留言 type=1）、AskList.vue（订单咨询 type=2）、Info.vue（新增留言）
 * 接口：GET  /api/user/feedback/list
 *       POST /api/user/feedback/submit
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Input, Toast, Typography } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

interface FeedbackItem {
  id: number;
  type?: number;
  typeName?: string;
  title: string;
  content: string;
  statusText?: string;
  addTime?: string;
  product?: { productName?: string };
  reply?: { content?: string; addTime?: string; username?: string } | null;
}

type Tab = 1 | 2;

const TABS: Array<{ value: Tab; label: string; empty: string }> = [
  { value: 1, label: '我的留言', empty: '您还没有留言过' },
  { value: 2, label: '订单咨询', empty: '您还没有订单咨询' },
];

export default function FeedbackClient() {
  const [tab, setTab] = useState<Tab>(1);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const size = 20;

  const load = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await apiGet<any>('user/feedback/list', { page, size, type: tab });
      const records = data?.records || data?.list || [];
      setItems(Array.isArray(records) ? records : []);
      setTotal(Number(data?.total || records.length || 0));
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '留言加载失败' });
      setItems([]);
    } finally {
      setListLoading(false);
    }
  }, [page, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!content.trim()) {
      Toast.warning({ content: '请输入留言内容' });
      return;
    }
    setLoading(true);
    try {
      await apiPost('user/feedback/submit', {
        type: tab,
        title: title.trim() || content.trim().slice(0, 20),
        content: content.trim(),
      });
      Toast.success({ content: '提交成功' });
      setTitle('');
      setContent('');
      setPage(1);
      await load();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '提交失败' });
    } finally {
      setLoading(false);
    }
  };

  const active = TABS.find((item) => item.value === tab) || TABS[0];
  const pages = Math.max(1, Math.ceil(total / size));

  return (
    <>
      <div className="feedback-tabs">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={tab === item.value ? 'is-active' : ''}
            onClick={() => { setTab(item.value); setPage(1); }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Input value={title} onChange={setTitle} placeholder="标题（选填）" style={{ marginBottom: 10 }} />
        <Input value={content} onChange={setContent} placeholder="请输入您的留言内容" style={{ marginBottom: 10 }} />
        <Button theme="solid" type="primary" loading={loading} onClick={() => void submit()}>添加新留言</Button>
      </Card>

      {listLoading ? <Card className="cart-state">加载中...</Card> : null}

      {!listLoading && items.length ? items.map((item) => (
        <Card key={item.id} style={{ marginBottom: 12 }}>
          <Typography.Title heading={5} style={{ margin: 0 }}>
            {item.typeName || active.label}：{Number(item.type) === 2 ? item.product?.productName || item.title : item.title}
          </Typography.Title>
          <Typography.Paragraph style={{ margin: '8px 0' }}>{item.content}</Typography.Paragraph>
          <Typography.Text type="tertiary">{item.addTime || ''} · {item.statusText || ''}</Typography.Text>
          {item.reply?.content ? (
            <div style={{ marginTop: 10, padding: 10, background: '#f8fafc', borderRadius: 8 }}>
              <b>客服回复{item.reply.addTime ? `（${item.reply.addTime}）` : ''}：</b>{item.reply.content}
            </div>
          ) : null}
        </Card>
      )) : null}

      {!listLoading && !items.length ? <Card className="cart-state">{active.empty}</Card> : null}

      {pages > 1 ? (
        <div className="comment-pagination">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>上一页</button>
          <span>{page} / {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>下一页</button>
        </div>
      ) : null}

      <div className="comment-info-back"><Link href="/member">返回会员中心</Link></div>
    </>
  );
}
