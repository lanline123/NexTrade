'use client';

/**
 * 发表评价页（PC 会员中心）
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/comment/Info.vue
 *
 * 旧版字段与交互：
 * - 1-5 星评分（el-rate）+ 星级文字（1分 ~ 5分）；
 * - 预设评价标签（labelList 9 项）+「自定义」标签输入（isShowadd → tabAdd 写入 allCommentTag）；
 * - 购物心得 textarea（≥10 字）+ 晒单图片（最多 9 张，jpeg/png）；
 * - 匿名评价勾选（D1146：仅在商品评价总开关与匿名开关都开启且未评价时出现）；
 * - 提交（POST /user/comment/evaluate）。
 *
 * 本次补齐的字段（旧版有、新版缺）：
 * - 「自定义」标签输入（旧版 Info.vue:70-79 `tabAdd` 写入 allCommentTag）；
 * - 星级文字（旧版 el-rate `:texts="desc" show-text`）；
 * - 匿名勾选按 `anonymousCommentEnabled` 开关显示（旧版 Info.vue:159）。
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
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

/** 旧版 Info.vue 的默认预设标签（labelList） */
const DEFAULT_COMMENT_TAGS = [
  '送货快',
  '质量很好',
  '服务周到',
  '正品',
  '很划算',
  '包装仔细',
  '价格实惠',
  '还可以',
  '相当好',
];

/** 旧版 Info.vue：星级文字（desc） */
const RANK_TEXTS = ['1分', '2分', '3分', '4分', '5分'];

interface CommentForm {
  rank: number;
  content: string;
  anonymous: boolean;
  tags: string[];
  pics: Array<Record<string, unknown>>;
  /** 可选标签池（后端 allCommentTag 优先，否则回落默认预设标签） */
  tagPool: string[];
  /** 「自定义」标签输入框内容 */
  customTagInput: string;
  /** 「自定义」标签输入框是否展开 */
  customTagOpen: boolean;
}

export default function CommentInfoClient({ orderId }: { orderId: number }) {
    const { t } = useTranslation();
    const [items, setItems] = useState<CommentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<number | null>(null);
    const [forms, setForms] = useState<Record<number, CommentForm>>({});
    /** D1146：匿名评价开关（commonStore.anonymousCommentEnabled） */
    const [anonymousEnabled, setAnonymousEnabled] = useState(1);

    useEffect(() => {
        apiGet<Record<string, any>>('common/config/base')
            .then((config) => setAnonymousEnabled(Number(config?.anonymousCommentEnabled ?? 1)))
            .catch(() => setAnonymousEnabled(1));
    }, []);

    const load = () => {
        setLoading(true);
        apiGet<{ items?: CommentItem[] }>('user/comment/detail', { id: orderId })
      .then((result) => {
        const list = Array.isArray(result?.items) ? result.items : [];
        setItems(list);
        const next: Record<number, CommentForm> = {};
        list.forEach((item, index) => {
          next[index] = {
            rank: Number(item.commentInfo?.commentRank || 0),
            content: String(item.commentInfo?.content || ''),
            anonymous: false,
          tags: Array.isArray(item.commentInfo?.commentTag) ? item.commentInfo.commentTag : [],
          pics: Array.isArray(item.showPics) ? item.showPics : [],
          // 后端未下发 allCommentTag 时回落旧版默认预设标签
          tagPool: Array.isArray(item.allCommentTag) && item.allCommentTag.length ? item.allCommentTag : DEFAULT_COMMENT_TAGS,
          customTagInput: '',
          customTagOpen: false,
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
        Toast.error({ content: String(json?.msg || json?.message || t('上传失败')) });
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

  /** 旧版 Info.vue：checkTag —— 标签点选 / 取消 */
  const toggleTag = (index: number, tag: string) => {
    setForms((current) => {
      const form = current[index];
      const tags = form?.tags || [];
      const next = tags.includes(tag) ? tags.filter((value) => value !== tag) : [...tags, tag];
      return { ...current, [index]: { ...form, tags: next } };
    });
  };

  /** 旧版 Info.vue：tabAdd ——「自定义」标签确认后写入 allCommentTag 并自动选中 */
  const addCustomTag = (index: number) => {
    const value = (forms[index]?.customTagInput || '').trim();
    if (!value) {
      setForms((current) => ({ ...current, [index]: { ...current[index], customTagOpen: false } }));
      return;
    }
    setForms((current) => {
      const form = current[index];
      const pool = form?.tagPool || [];
      const nextPool = pool.includes(value) ? pool : [...pool, value];
      const tags = form?.tags || [];
      const nextTags = tags.includes(value) ? tags : [...tags, value];
      return { ...current, [index]: { ...form, tagPool: nextPool, tags: nextTags, customTagInput: '', customTagOpen: false } };
    });
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
        // D1146：匿名开关关闭时恒传 0，后端也会再兜一层
        isAnonymous: anonymousEnabled === 1 && form.anonymous ? 1 : 0,
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
              <span>{item.productName || t('商品')}</span>
            </Link>
          </div>
          <div className="comment-item__stars">
            <span>{t('商品评分')}：</span>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                disabled={Boolean(item.isCommentInfo)}
                className={value <= (forms[index]?.rank || 0) ? 'is-active' : ''}
                onClick={() => setForms({ ...forms, [index]: { ...forms[index], rank: value } })}
              >★</button>
            ))}
            {/* 旧版 Info.vue：el-rate `:texts="desc" show-text` 星级文字 */}
            <span className="comment-item__rank-text">
              {forms[index]?.rank ? t(RANK_TEXTS[forms[index].rank - 1]) : ''}
            </span>
          </div>
          {/* 源码 comment/Info.vue：评价标签 + 自定义标签 + 晒单图片 */}
          <div className="comment-item__tags">
            <span>{t('评价标签')}：</span>
            {(forms[index]?.tagPool || []).map((tag) => {
              const picked = (forms[index]?.tags || []).includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  disabled={Boolean(item.isCommentInfo)}
                  className={picked ? 'is-active' : ''}
                  onClick={() => toggleTag(index, tag)}
                >
                  {tag}
                </button>
              );
            })}
            {/* 旧版 Info.vue:70-79：label-edit / label-edit-input 自定义标签 */}
            {!item.isCommentInfo ? (
              forms[index]?.customTagOpen ? (
                <span className="comment-item__custom-tag">
                  <input
                    value={forms[index]?.customTagInput || ''}
                    autoFocus
                    placeholder={t('请输入自定义标签')}
                    onChange={(event) => setForms({ ...forms, [index]: { ...forms[index], customTagInput: event.target.value } })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addCustomTag(index);
                      }
                    }}
                  />
                  <button type="button" onClick={() => addCustomTag(index)}>{t('确定')}</button>
                </span>
              ) : (
                <button
                  type="button"
                  className="comment-item__custom-add"
                  onClick={() => setForms({ ...forms, [index]: { ...forms[index], customTagOpen: true } })}
                >
                  {t('自定义')}
                </button>
              )
            ) : null}
          </div>

          {!item.isCommentInfo ? (
            <div className="comment-item__pics">
              {(forms[index]?.pics || []).map((pic, picIndex) => (
                <span className="comment-item__pic" key={picIndex}>
                  <img src={String(pic.picThumb || pic.picUrl || '')} alt={t('晒单')} />
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
                <label className="comment-item__pic-pick">{t('+ 晒单')}<input
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
                    placeholder={t('商品是否给力？快分享你的购买心得吧~')}
                    rows={5}
                  />
                  {!item.isCommentInfo ? (
                    <div className="comment-item__foot">
                      {/* D1146：匿名开关关闭时不展示匿名勾选 */}
                      {anonymousEnabled === 1 ? (
                        <label><input type="checkbox" checked={forms[index]?.anonymous || false} onChange={(event) => setForms({ ...forms, [index]: { ...forms[index], anonymous: event.target.checked } })} />{t('匿名评价')}</label>
                      ) : null}
                      <Button theme="solid" type="primary" loading={saving === index} onClick={() => void submit(item, index)}>{t('提交评价')}</Button>
                    </div>
                  ) : <div className="comment-item__done">{t('已评价')}</div>}
        </section>
      )) : <div className="comment-empty">{t('暂无可评价商品')}</div>}
      <div className="comment-info-back"><Link href="/member/comment">{t('返回评价中心')}</Link></div>
    </Card>
  );
}
