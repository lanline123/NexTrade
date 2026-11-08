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
import { Toast } from '@douyinfe/semi-ui';
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
      // 后端 UserMessageIdDTO 的字段是 `id`（crates/core/src/models/member/user_message.rs），
      // 传 `messageId` 会被忽略导致「单条已读」不生效。
      await apiPost('user/message/updateMessageRead', { id: item.messageId });
      setMessages((current) => current.map((row) => (row.messageId === item.messageId ? { ...row, isRead: 1 } : row)));
    } catch {
      /* 单条已读失败不打断浏览 */
    }
  };

  const remove = async (messageId?: number) => {
    if (!messageId) return;
    try {
      await apiPost('user/message/del', { id: messageId });
      Toast.success({ content: '已删除' });
      await load(page, onlyUnread);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '删除失败' });
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / size));

  return (
    <div className="mp-usermessage-list">
      <div className="message_center">
        <div className="mc_side_bar">
          <div className="nav_card">
            <div className="nav_group__title">{t('消息中心')}</div>
            <div className="nav_item active">
              <span className="nav_item__name">{t('账户信息')}</span>
            </div>
          </div>
        </div>

        <div className="msg_list">
          <div className="flex justify-end msg_list__toolbar">
            <button type="button" className="mp-el-button" onClick={() => setOnlyUnread((value) => !value)}>{t('只看未读')}</button>
            <button type="button" className="mp-el-button" onClick={() => void markAllRead()}>{t('全部标记为已读')}</button>
          </div>
          <div className="list">

            {loading ? <div className="no-result">{t('加载中...')}</div> : null}

            {!loading && !messages.length ? <div className="no-result">{t('暂无消息')}</div> : null}

            {!loading && messages.map((item) => (
              <div className={`item ${item.isRead ? 'is-read' : 'is-unread'}`} key={item.messageId} onClick={() => void readItem(item)}>
                <div className="msg_card">
                  <div className="msg_card__head">
                    <div className="msg_card__source">
                      <span className="msg_card__icon"><i className="iconfont-pc icon-xiaoxi" /></span>
                      <span className="msg_card__label">{t('系统通知')}</span>
                      {!item.isRead ? <span className="msg_card__dot" /> : null}
                    </div>
                    <div className="msg_card__date">{item.addTimeDate || item.addTime || ''}</div>
                  </div>
                  <h3 className="msg_card__title">{item.title || t('消息')}</h3>
                  <p className="msg_card__txt">{item.content || ''}</p>
                  <button
                    type="button"
                    className="msg_card__del"
                    aria-label={t('删除')}
                    onClick={(event) => { event.stopPropagation(); void remove(item.messageId); }}
                  >×</button>
                </div>
              </div>
            ))}

            {totalPages > 1 ? (
              <div className="el-page flex justify-end">
                <div className="pagination">
                  <button type="button" aria-label={t('上一页')} disabled={page <= 1} onClick={() => void load(page - 1, onlyUnread)}>{'<'}</button>
                  <span className="total">{page} / {totalPages}</span>
                  <button type="button" aria-label={t('下一页')} disabled={page >= totalPages} onClick={() => void load(page + 1, onlyUnread)}>{'>'}</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
