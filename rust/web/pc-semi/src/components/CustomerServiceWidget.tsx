'use client';

import { useEffect, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';
interface ImMessage {
  id?: number;
  conversationId?: number;
  messageType?: string;
  type?: number;
  content?: {
    messageType?: string;
    content?: string;
    pic?: string;
  };
  sendTime?: string;
  userId?: number;
  servantId?: number;
}

export default function CustomerServiceWidget() {
    const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ImMessage[]>([]);
  const [conversationId, setConversationId] = useState<number>(0);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const token = () => (typeof window === 'undefined' ? '' : localStorage.getItem('accessToken') || '');

  const loadConversation = async () => {
    const accessToken = token();
    if (!accessToken) {
      setError('请先登录后使用在线客服');
      return;
    }
    const resp = await fetch('/im/conversation/conversation/list?page=1&size=1', {
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: 'include',
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || (json.code !== undefined && json.code !== 0)) {
      throw new Error(json.msg || json.message || t('会话加载失败'));
    }
    const data = json.data || {};
    const records = data.records || data.list || [];
    if (records.length) {
      setConversationId(Number(records[0].id || records[0].conversationId || 0));
    }
  };

  const loadMessages = async (cid: number) => {
    if (!cid) return;
    const accessToken = token();
    if (!accessToken) return;
    const resp = await fetch(`/im/conversation/message/list?conversationId=${cid}&shopId=0&page=1&size=50`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: 'include',
    });
    const json = await resp.json().catch(() => ({}));
    if (resp.ok && (json.code === undefined || json.code === 0)) {
      const data = json.data || {};
      const records: ImMessage[] = data.records || data.list || [];
      setMessages([...records].sort((a, b) => Number(a.id || 0) - Number(b.id || 0)));
    }
  };

  useEffect(() => {
    if (!open) return;
    setError('');
    loadConversation()
      .then(async () => {
        if (conversationId) await loadMessages(conversationId);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : '客服加载失败'));
    timerRef.current = setInterval(async () => {
      try {
        if (conversationId) await loadMessages(conversationId);
      } catch {
        /* 轮询失败忽略 */
      }
    }, 4000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [open, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const content = text.trim();
    if (!content) return;
    if (!token()) {
      setError('请先登录后使用在线客服');
      return;
    }
    setSending(true);
    setError('');
    try {
      const resp = await fetch('/im/conversation/message/send', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Type': 'pc',
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({
          conversationId: conversationId || undefined,
          shopId: 0,
          type: 1,
          content: { messageType: 'text', content },
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || (json.code !== undefined && json.code !== 0)) {
        throw new Error(json.msg || json.message || t('发送失败'));
      }
      const sent = json.data as ImMessage | undefined;
      if (sent?.conversationId && !conversationId) setConversationId(Number(sent.conversationId));
      setText('');
      if (sent) setMessages((prev) => [...prev, sent]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '发送失败');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="pc-cs">
      {open ? (
        <div className="pc-cs__panel">
          <div className="pc-cs__head">
            <b>{t('在线客服')}</b>
            <button type="button" onClick={() => setOpen(false)}>×</button>
          </div>
          <div className="pc-cs__body">
            {!messages.length ? <div className="pc-cs__tip">{t('您好，有什么可以帮您？')}</div> : null}
            {messages.map((message, index) => {
              const mine = message.type === 1;
              const body = (message.content?.content || '')
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .trim();
              return (
                <div key={message.id || index} className={`pc-cs__msg ${mine ? 'is-mine' : ''}`}>
                  {body}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
          {error ? <div className="pc-cs__error">{t(error)}</div> : null}
          <div className="pc-cs__input">
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') send();
              }}
              placeholder={t('请输入消息')}
            />
            <button type="button" disabled={sending} onClick={send}>{t('发送')}</button>
          </div>
        </div>
      ) : null}
      <button type="button" className="pc-cs__fab" onClick={() => setOpen((value) => !value)}>{t('客服')}</button>
    </div>
  );
}
