'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Card, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

interface Conversation {
  conversationId?: number;
  shopId?: number;
  shopTitle?: string;
  shopLogo?: string;
  lastMessage?: string;
  lastTime?: string;
  unreadCount?: number;
  [key: string]: unknown;
}

interface ChatMessage {
  id?: number;
  content?: string | { content?: string; messageType?: string };
  sendTime?: string;
  addTime?: string;
  isSelf?: boolean;
  senderType?: number;
  [key: string]: unknown;
}

function textOf(message: ChatMessage): string {
  if (typeof message.content === 'string') return message.content;
  return String(message.content?.content || '');
}

export default function ChatClient() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const activeRef = useRef<Conversation | null>(null);
  const closedRef = useRef(false);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    closedRef.current = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const connect = () => {
      if (closedRef.current) return;
      const token = localStorage.getItem('accessToken') || '';
      if (!token) return;
      const base = process.env.NEXT_PUBLIC_SOCKET_URL
        || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
      const url = `${base}${base.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}&platform=pc`;
      try {
        const socket = new WebSocket(url);
        socketRef.current = socket;
        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(String(event.data || '{}'));
            if (payload?.type !== 'message') return;
            const incoming: ChatMessage[] = Array.isArray(payload.data) ? payload.data : [payload.data];
            const activeId = activeRef.current?.conversationId;
            setMessages((current) => {
              const next = [...current];
              incoming.forEach((message) => {
                const messageConversation = Number((message as any).conversationId || 0);
                if (activeId && messageConversation && messageConversation !== activeId) return;
                if (message.id && next.some((item) => item.id === message.id)) return;
                next.push(message);
              });
              return next;
            });
            loadConversations();
          } catch {
            // ignore malformed socket payload
          }
        };
        socket.onclose = () => {
          if (closedRef.current) return;
          retry = setTimeout(connect, 3000);
        };
        socket.onerror = () => socket.close();
      } catch {
        retry = setTimeout(connect, 3000);
      }
    };
    connect();
    return () => {
      closedRef.current = true;
      if (retry) clearTimeout(retry);
      socketRef.current?.close();
    };
  }, []);

  const loadConversations = () => {
    apiGet<{ records?: Conversation[] }>('im/conversation/conversation/list', { page: 1, size: 50 })
      .then((result) => {
        const list = Array.isArray(result?.records) ? result.records : [];
        setConversations(list);
        setActive((current) => current || list[0] || null);
      })
      .catch(() => setConversations([]))
      .finally(() => setLoading(false));
  };

  const loadMessages = (conversation: Conversation | null) => {
    if (!conversation) return;
    apiGet<{ records?: ChatMessage[] }>('im/conversation/message/list', {
      shopId: conversation.shopId || 0,
      conversationId: conversation.conversationId || 0,
      sortOrder: 'asc',
    })
      .then((result) => setMessages(Array.isArray(result?.records) ? result.records : []))
      .catch(() => setMessages([]));
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    loadMessages(active);
    const timer = window.setInterval(() => loadMessages(active), 5000);
    return () => window.clearInterval(timer);
  }, [active]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!active || !input.trim()) return;
    setSending(true);
    try {
      await apiPost('im/conversation/message/send', {
        conversationId: active.conversationId,
        shopId: active.shopId || 0,
        content: { messageType: 'text', content: input.trim() },
      });
      setInput('');
      loadMessages(active);
      loadConversations();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '发送失败' });
    } finally {
      setSending(false);
    }
  };

  if (loading) return <Card className="member-card">会话加载中...</Card>;
  if (!conversations.length) return <Card className="member-card">暂无会话。进入商品或店铺后点击客服即可发起咨询。</Card>;

  return (
    <div className="chat-layout">
      <aside className="chat-conversations">
        {conversations.map((item) => (
          <button
            type="button"
            key={item.conversationId}
            className={active?.conversationId === item.conversationId ? 'is-active' : ''}
            onClick={() => setActive(item)}
          >
            <img src={item.shopLogo || ''} alt={item.shopTitle || ''} />
            <div>
              <b>{item.shopTitle || '店铺客服'}</b>
              <span>{item.lastMessage || ''}</span>
            </div>
            {Number(item.unreadCount || 0) > 0 ? <i>{item.unreadCount}</i> : null}
          </button>
        ))}
      </aside>
      <section className="chat-panel">
        <header>{active?.shopTitle || '客服会话'}</header>
        <div className="chat-messages">
          {messages.map((message, index) => {
            const self = Boolean(message.isSelf) || Number(message.senderType) === 1;
            return (
              <div key={message.id || index} className={`chat-message${self ? ' is-self' : ''}`}>
                <div className="chat-message__bubble">{textOf(message) || '[非文本消息]'}</div>
                <div className="chat-message__time">{message.sendTime || message.addTime || ''}</div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        <div className="chat-input">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="输入消息，按发送"
            rows={3}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <Button theme="solid" type="primary" loading={sending} onClick={() => void send()}>发送</Button>
        </div>
      </section>
    </div>
  );
}
