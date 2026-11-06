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

/** 消息类型：源码 ChatMessageList 支持 text/image/product/order 卡片 */
function messageKind(message: ChatMessage): string {
  if (typeof message.content === 'object' && message.content?.messageType) {
    return String(message.content.messageType);
  }
  return String(message.messageType || 'text');
}

/** 取出商品/订单卡片负载（源码 messageType=product|order 时 content 内嵌对象） */
function cardOf(message: ChatMessage, kind: 'product' | 'order'): Record<string, unknown> | null {
  if (messageKind(message) !== kind) return null;
  if (typeof message.content !== 'object' || !message.content) return null;
  const raw = (message.content as Record<string, unknown>)[kind];
  return (raw as Record<string, unknown>) || null;
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
    if (typeof window !== 'undefined' && !localStorage.getItem('accessToken')) {
      setLoading(false);
      window.location.replace(`/login?redirect=${encodeURIComponent('/chat')}`);
      return;
    }
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

  /** 源码 chat/src/ChatInput.vue：图片/视频上传后以 messageType=image 发送 */
  const uploadImage = async (file: File) => {
    if (!active?.conversationId) return;
    if (file.size > 10 * 1024 * 1024) {
      Toast.error({ content: '只能上传 10M 以内的图片' });
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
      await apiPost('im/conversation/message/send', {
        conversationId: active.conversationId,
        shopId: active.shopId || 0,
        content: { messageType: 'image', content: url },
      });
      loadMessages(active);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '图片发送失败' });
    }
  };

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
              <b>{item.shopTitle || (item.shopId ? '店铺客服' : '平台自营')}</b>
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
            const kind = messageKind(message);
            const product = cardOf(message, 'product');
            const order = cardOf(message, 'order');
            return (
              <div key={message.id || index} className={`chat-message${self ? ' is-self' : ''}`}>
                <div className="chat-message__bubble">
                  {kind === 'image' ? (
                    <img className="chat-message__image" src={textOf(message)} alt="图片消息" />
                  ) : product ? (
                    <a className="chat-message__card" href={`/product/${String(product.productId || product.id || '')}`} target="_blank" rel="noreferrer">
                      <img src={String(product.picThumb || product.pic || '')} alt="" />
                      <div>
                        <div className="chat-message__card-name">{String(product.productName || product.name || '')}</div>
                        <div className="chat-message__card-price">¥{Number(product.price || 0).toFixed(2)}</div>
                      </div>
                    </a>
                  ) : order ? (
                    <div className="chat-message__card">
                      <div>
                        <div className="chat-message__card-name">订单 {String(order.orderSn || '')}</div>
                        <div className="chat-message__card-price">¥{Number(order.orderAmount || 0).toFixed(2)}</div>
                      </div>
                    </div>
                  ) : (
                    textOf(message) || '[非文本消息]'
                  )}
                </div>
                <div className="chat-message__time">{message.sendTime || message.addTime || ''}</div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        <div className="chat-input">
          <div className="chat-input__tools">
            <label className="chat-input__tool">
              图片
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.gif,.bmp,.webp"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadImage(file);
                  event.target.value = '';
                }}
              />
            </label>
            <span className="chat-input__tips">按 Shift + Enter 换行</span>
          </div>
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
