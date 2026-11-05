'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

interface CommentItem {
  productId: number;
  orderId: number;
  itemId: number;
  shopId?: number;
  productName?: string;
  picThumb?: string;
  seoLink?: string;
  isCommentInfo?: boolean;
  commentInfo?: { commentRank?: number; content?: string; commentTag?: string[] };
  [key: string]: unknown;
}

export default function CommentInfoClient({ orderId }: { orderId: number }) {
  const [items, setItems] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [forms, setForms] = useState<Record<number, { rank: number; content: string; anonymous: boolean }>>({});

  const load = () => {
    setLoading(true);
    apiGet<{ items?: CommentItem[] }>('user/comment/detail', { id: orderId })
      .then((result) => {
        const list = Array.isArray(result?.items) ? result.items : [];
        setItems(list);
        const next: Record<number, { rank: number; content: string; anonymous: boolean }> = {};
        list.forEach((item, index) => {
          next[index] = {
            rank: Number(item.commentInfo?.commentRank || 0),
            content: String(item.commentInfo?.content || ''),
            anonymous: false,
          };
        });
        setForms(next);
      })
      .catch((error) => Toast.error({ content: error instanceof Error ? error.message : '评价详情加载失败' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [orderId]);

  const submit = async (item: CommentItem, index: number) => {
    const form = forms[index];
    if (!form?.rank) return Toast.error({ content: '请选择评分' });
    if (!form.content.trim()) return Toast.error({ content: '请输入评价内容' });
    if (form.content.trim().length < 10) return Toast.error({ content: '购买心得最少 10 个字' });
    setSaving(index);
    try {
      await apiPost('user/comment/evaluate', {
        productId: item.productId,
        orderId: item.orderId,
        orderItemId: item.itemId,
        shopId: item.shopId,
        commentRank: form.rank,
        commentTag: [],
        content: form.content.trim(),
        isAnonymous: form.anonymous ? 1 : 0,
      });
      Toast.success({ content: '评价成功' });
      load();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '评价提交失败' });
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card className="member-card comment-info-card" loading={loading}>
      {items.length ? items.map((item, index) => (
        <section className="comment-item" key={`${item.orderId}-${item.itemId}-${item.productId}`}>
          <div className="comment-item__head">
            <Link href={`/product/${item.productId}`}>
              <img src={item.picThumb || ''} alt={item.productName || ''} />
              <span>{item.productName || '商品'}</span>
            </Link>
          </div>
          <div className="comment-item__stars">
            <span>评分</span>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                disabled={Boolean(item.isCommentInfo)}
                className={value <= (forms[index]?.rank || 0) ? 'is-active' : ''}
                onClick={() => setForms({ ...forms, [index]: { ...forms[index], rank: value } })}
              >★</button>
            ))}
          </div>
          <textarea
            value={forms[index]?.content || ''}
            disabled={Boolean(item.isCommentInfo)}
            onChange={(event) => setForms({ ...forms, [index]: { ...forms[index], content: event.target.value } })}
            placeholder="请填写购买心得（至少 10 个字）"
            rows={5}
          />
          {!item.isCommentInfo ? (
            <div className="comment-item__foot">
              <label><input type="checkbox" checked={forms[index]?.anonymous || false} onChange={(event) => setForms({ ...forms, [index]: { ...forms[index], anonymous: event.target.checked } })} /> 匿名评价</label>
              <Button theme="solid" type="primary" loading={saving === index} onClick={() => void submit(item, index)}>提交评价</Button>
            </div>
          ) : <div className="comment-item__done">已评价</div>}
        </section>
      )) : <div className="comment-empty">暂无可评价商品</div>}
      <div className="comment-info-back"><Link href="/member/comment">返回评价中心</Link></div>
    </Card>
  );
}
