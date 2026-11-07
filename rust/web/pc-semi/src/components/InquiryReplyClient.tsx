'use client';

import { useState } from 'react';
import { Button, Toast } from '@douyinfe/semi-ui';
import { apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
export default function InquiryReplyClient({ id }: { id: number }) {
    const { t } = useTranslation();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const reply = async () => {
    if (!content.trim()) return Toast.error({ content: '请输入回复内容' });
    setLoading(true);
    try {
      await apiPost('user/priceInquiry/reply', { id, remark: content.trim() });
      Toast.success({ content: '回复成功' });
      window.location.reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '回复失败' });
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('确认删除这条咨询吗？')) return;
    setLoading(true);
    try {
      await apiPost('user/priceInquiry/del', { id });
      Toast.success({ content: '已删除' });
      window.location.href = '/member/inquiry';
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '删除失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inquiry-reply-form">
      <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={4} placeholder={t('请输入回复内容')} />
      <div className="inquiry-reply-actions">
        <Button theme="solid" type="primary" loading={loading} onClick={() => void reply()}>{t('回复咨询')}</Button>
        <Button type="danger" loading={loading} onClick={() => void remove()}>{t('删除咨询')}</Button>
      </div>
    </div>
  );
}
