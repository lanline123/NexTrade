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
  /** 源码 comment/Info.vue：可选标签池 + 晒单图片 */
  allCommentTag?: string[];
  showPics?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export default function CommentInfoClient({ orderId }: { orderId: number }) {
  const [items, setItems] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [forms, setForms] = useState<Record<number, { rank: number; content: string; anonymous: boolean; tags: string[]; pics: Array<Record<string, unknown>> }>>({});

  const load = () => {
    setLoading(true);
    apiGet<{ items?: CommentItem[] }>('user/comment/detail', { id: orderId })
      .then((result) => {
        const list = Array.isArray(result?.items) ? result.items : [];
        setItems(list);
        const next: Record<number, { rank: number; content: string; anonymous: boolean; tags: string[]; pics: Array<Record<string, unknown>> }> = {};
        list.forEach((item, index) => {
          next[index] = {
            rank: Number(item.commentInfo?.commentRank || 0),
            content: String(item.commentInfo?.content || ''),
            anonymous: false,
          tags: Array.isArray(item.commentInfo?.commentTag) ? item.commentInfo.commentTag : [],
          pics: Array.isArray(item.showPics) ? item.showPics : [],
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

  /** 源码 UploadImage：晒单图片上传（最多 9 张，jpeg/png） */
  const uploadPic = async (index: number, file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      Toast.error({ content: '只能上传 2M 以内的图片' });
      return;
    }
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
      if (!url) return;
      const current = forms[index]?.pics || [];
      setForms({ ...forms, [index]: { ...forms[index], pics: [...current, { picUrl: url, picThumb: String(data?.picThumb || url) }] } });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '上传失败' });
    }
  };

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
        commentTag: form.tags || [],
        showPics: form.pics || [],
        content: form.content.trim(),
        isAnonymous: form.anonymous ? 1 : 0,
      });
      Toast.success({ content: '评价成功' });
      // 通知左侧 MemberNav 刷新角标（待评价数已变化）
      window.dispatchEvent(new Event('member-badges-changed'));
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
          {/* 源码 comment/Info.vue：评价标签 + 晒单图片 */}
          {Array.isArray(item.allCommentTag) && item.allCommentTag.length ? (
            <div className="comment-item__tags">
              <span>评价标签</span>
              {item.allCommentTag.map((tag) => {
                const picked = (forms[index]?.tags || []).includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    disabled={Boolean(item.isCommentInfo)}
                    className={picked ? 'is-active' : ''}
                    onClick={() => {
                      const current = forms[index]?.tags || [];
                      const next = picked ? current.filter((value) => value !== tag) : [...current, tag];
                      setForms({ ...forms, [index]: { ...forms[index], tags: next } });
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          ) : null}

          {!item.isCommentInfo ? (
            <div className="comment-item__pics">
              {(forms[index]?.pics || []).map((pic, picIndex) => (
                <span className="comment-item__pic" key={picIndex}>
                  <img src={String(pic.picThumb || pic.picUrl || '')} alt="晒单" />
                  <button
                    type="button"
                    onClick={() => {
                      const current = forms[index]?.pics || [];
                      setForms({ ...forms, [index]: { ...forms[index], pics: current.filter((_, i) => i !== picIndex) } });
                    }}
                  >×</button>
                </span>
              ))}
              {(forms[index]?.pics || []).length < 9 ? (
                <label className="comment-item__pic-pick">
                  + 晒单
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadPic(index, file);
                      event.target.value = '';
                    }}
                  />
                </label>
              ) : null}
            </div>
          ) : null}

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
