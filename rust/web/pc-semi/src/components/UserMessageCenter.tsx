'use client';

/**
 * 站内消息中心
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/usermessage/List.vue
 * - 左侧「消息中心 / 账户信息」导航
 * - 工具栏：只看未读、全部标记为已读
 * - 消息卡：系统通知 + 未读圆点 + 日期 + 标题 + 正文 + 删除
 * 接口：GET  /api/user/message/list
 *       POST /api/user/message/updateAllRead
 *       POST /api/user/message/del
 *       POST /api/user/message/updateMessageRead（单条已读）
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
interface MessageItem {
  messageId?: number;
  title?: string;
  content?: string;
  addTime?: string;
  addTimeDate?: string;
  isRead?: number | boolean;
  type?: number;
}

export default function UserMessageCenter() {
    const { t } = useTranslation();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  /** 源码 unreadReadFn：只看未读 */
  const [onlyUnread, setOnlyUnread] = useState(false);
  const size = 10;

  const load = useCallback(async (nextPage: number, unread: boolean) => {
    setLoading(true);
    try {
      const data = await apiGet<{ records?: MessageItem[]; list?: MessageItem[]; total?: number } | MessageItem[]>(
        'user/message/list',
        { page: nextPage, size, ...(unread ? { isRead: 0 } : {}) },
      );
      const list = Array.isArray(data) ? data : (data?.records || data?.list || []);
      const filtered = unread ? list.filter((item) => !item.isRead) : list;
      setMessages(filtered);
      setTotal(Array.isArray(data) ? filtered.length : Number(data?.total || filtered.length));
      setPage(nextPage);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '消息加载失败' });
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1, onlyUnread);
  }, [load, onlyUnread]);

  const markAllRead = async () => {
    try {
      await apiPost('user/message/updateAllRead', {});
      Toast.success({ content: '已全部标记为已读' });
      await load(page, onlyUnread);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '操作失败' });
    }
  };

  const readItem = async (item: MessageItem) => {
    if (item.isRead || !item.messageId) return;
    try {
      await apiPost('user/message/updateMessageRead', { messageId: item.messageId });
      setMessages((current) => current.map((row) => (row.messageId === item.messageId ? { ...row, isRead: 1 } : row)));
    } catch {
      /* 单条已读失败不打断浏览 */
    }
  };

  const remove = async (messageId?: number) => {
    if (!messageId) return;
    try {
      await apiPost('user/message/del', { messageId });
      Toast.success({ content: '已删除' });
      await load(page, onlyUnread);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '删除失败' });
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / size));

  return (
    <div className="msg-center">
      <aside className="msg-center__side">
        <b className="msg-center__side-title">{t('消息中心')}</b>
        <div className="msg-center__side-item is-active">{t('账户信息')}</div>
      </aside>

      <div className="msg-center__main">
        <div className="msg-center__toolbar">
          <Button theme={onlyUnread ? 'solid' : 'light'} type={onlyUnread ? 'primary' : 'tertiary'} onClick={() => setOnlyUnread((value) => !value)}>{t('只看未读')}</Button>
          <Button onClick={() => void markAllRead()}>{t('全部标记为已读')}</Button>
        </div>

        {loading ? <Card className="cart-state">{t('加载中...')}</Card> : null}

        {!loading && !messages.length ? <Card className="cart-state">{t('暂无消息')}</Card> : null}

        {!loading && messages.map((item) => (
          <div
            className={`msg-card${item.isRead ? ' is-read' : ' is-unread'}`}
            key={item.messageId}
            onClick={() => void readItem(item)}
          >
            <div className="msg-card__head">
              <span className="msg-card__source">{t('系统通知')}</span>
              <span className="msg-card__date">{item.addTimeDate || item.addTime || ''}</span>
            </div>
            <h3 className="msg-card__title">
              {!item.isRead ? <i className="msg-card__dot" /> : null}
              {item.title || t('消息')}
            </h3>
            <p className="msg-card__text">{item.content || ''}</p>
            <button
              type="button"
              className="msg-card__del"
              onClick={(event) => { event.stopPropagation(); void remove(item.messageId); }}
            >{t('删除')}</button>
          </div>
        ))}

        {totalPages > 1 ? (
          <div className="comment-pagination">
            <button type="button" disabled={page <= 1} onClick={() => void load(page - 1, onlyUnread)}>{t('上一页')}</button>
            <span>{page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => void load(page + 1, onlyUnread)}>{t('下一页')}</button>
          </div>
        ) : null}

        <div className="comment-info-back"><Link href="/member">{t('返回会员中心')}</Link></div>
      </div>
    </div>
  );
}
