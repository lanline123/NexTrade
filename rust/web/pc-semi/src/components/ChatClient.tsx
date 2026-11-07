'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Card, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';
import { EMOJI_BASE, emojiElements, splitEmoji } from '@/components/emojiElements';

import { useTranslation } from 'react-i18next';
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

/** 文本渲染：`[表情名]` → OSS 表情图（源码 EmojiHtml.replaceEmojiToHtml） */
function TextWithEmoji({ text }: { text: string }) {
  return (
    <>
      {splitEmoji(text).map((part, index) =>
        part.type === 'emoji' ? (
          <img
            key={index}
            className="chat-emoji"
            src={`${EMOJI_BASE}${emojiElements.find((item) => item.name === part.value)?.id || ''}.png`}
            alt={part.value}
          />
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </>
  );
}

export default function ChatClient() {
    const { t } = useTranslation();
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
  // 源码 ChatInput.vue：表情选择器（[表情名] 标记插入输入框）
  const [emojiOpen, setEmojiOpen] = useState(false);
  // 源码 ChatRight.vue：右侧信息栏（店铺 / 咨询商品 / 相关订单卡片）
  const [pendingProduct, setPendingProduct] = useState<Record<string, any> | null>(null);
  const [pendingOrder, setPendingOrder] = useState<Record<string, any> | null>(null);
  // 历史消息分页（源码 ChatMessageList：first_id 向前翻页），与 5s 轮询的增量列表分开存放
  const [olderMessages, setOlderMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

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

  /** 切换会话时清空已加载的历史页 */
  const resetHistory = () => {
    setOlderMessages([]);
    setHasMore(false);
  };

  /** 源码 ChatMessageList：以当前最早一条消息 id 向前翻历史页（first_id + desc 取 20 条再倒序） */
  const loadOlder = async () => {
    const conversation = active;
    if (!conversation || loadingMore) return;
    const firstId = Number(olderMessages[0]?.id || messages[0]?.id || 0);
    if (!firstId) return;
    setLoadingMore(true);
    try {
      const result = await apiGet<{ records?: ChatMessage[] }>('im/conversation/message/list', {
        shopId: conversation.shopId || 0,
        conversationId: conversation.conversationId || 0,
        firstId,
        sortOrder: 'desc',
        size: 20,
      });
      const records = (result?.records || []).slice().reverse();
      setOlderMessages((current) => [...records, ...current]);
      setHasMore(records.length >= 20);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('accessToken')) {
      setLoading(false);
      window.location.replace(`/login?redirect=${encodeURIComponent('/chat')}`);
      return;
    }
    loadConversations();
    // 源码 chat/index.vue:660-680：商详/订单页跳转携带 shopId/productId/orderId，
    // 自动取详情并推送商品/订单卡片发起会话
    const params = new URLSearchParams(window.location.search);
    const shopIdParam = Number(params.get('shopId')) || 0;
    const productIdParam = Number(params.get('productId')) || 0;
    const orderIdParam = Number(params.get('orderId')) || 0;
    if (productIdParam) {
      apiGet<Record<string, any>>('product/product/detail', { id: productIdParam })
        .then((result) => {
          const row = result?.item || {};
          const card = {
            messageType: 'custom',
            productId: row.productId,
            picUrl: row.picThumb || row.picUrl || '',
            productName: row.productName || '',
            productSn: row.productSn || '',
            productPrice: Number(row.productPrice || 0),
          };
          setPendingProduct(card);
          void sendCard(card, shopIdParam);
        })
        .catch(() => undefined);
    }
    if (orderIdParam) {
      apiGet<Record<string, any>>('user/order/detail', { id: orderIdParam })
        .then((result) => {
          const items = Array.isArray(result?.items) ? result.items : [];
          const card = {
            orderId: result?.orderId,
            orderSn: result?.orderSn || '',
            picUrl: items[0]?.picThumb || '',
            productName: items[0]?.productName || '',
            productNum: items.length,
            totalAmount: Number(result?.totalAmount || 0),
            orderStatusName: result?.orderStatusName || '',
          };
          setPendingOrder(card);
          void sendCard(card, shopIdParam, 'order');
        })
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 源码 chat/index.vue handleSendProduct/handleSendOrder：custom 卡片消息（新会话不带 conversationId） */
  const sendCard = async (card: Record<string, any>, shopIdParam?: number, kind: 'product' | 'order' = 'product') => {
    if (typeof window !== 'undefined' && !localStorage.getItem('accessToken')) return;
    try {
      const isNew = !active || Number(active.conversationId) === -1;
      const payload: Record<string, any> = {
        shopId: shopIdParam ?? active?.shopId ?? 0,
        content: kind === 'product'
          ? { messageType: 'custom', product: card }
          : { messageType: 'custom', order: card },
      };
      if (!isNew && active?.conversationId) payload.conversationId = active.conversationId;
      else if (shopIdParam !== undefined) payload.conversationId = undefined;
      await apiPost('im/conversation/message/send', payload);
      loadConversations();
    } catch {
      // 新会话首条卡片发送失败不打断页面
    }
  };

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
        Toast.error({ content: String(json?.msg || json?.message || t('上传失败')) });
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

  if (loading) return <Card className="member-card">{t('会话加载中...')}</Card>;
  if (!conversations.length) return <Card className="member-card">{t('暂无会话。进入商品或店铺后点击客服即可发起咨询。')}</Card>;

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
              <b>{item.shopTitle || (item.shopId ? t('店铺客服') : '平台自营')}</b>
              <span>{item.lastMessage || ''}</span>
            </div>
            {Number(item.unreadCount || 0) > 0 ? <i>{item.unreadCount}</i> : null}
          </button>
        ))}
      </aside>
      <section className="chat-panel">
        <header>{active?.shopTitle || t('客服会话')}</header>
        <div className="chat-messages">
          {hasMore || olderMessages.length ? (
            <button type="button" className="chat-load-more" disabled={loadingMore} onClick={() => void loadOlder()}>
              {loadingMore ? t('加载中...') : hasMore ? t('查看更多消息') : ''}
            </button>
          ) : null}
          {[...olderMessages, ...messages].map((message, index) => {
            const self = Boolean(message.isSelf) || Number(message.senderType) === 1;
            const kind = messageKind(message);
            const product = cardOf(message, 'product');
            const order = cardOf(message, 'order');
            return (
              <div key={message.id || index} className={`chat-message${self ? ' is-self' : ''}`}>
                <div className="chat-message__bubble">
                  {kind === 'image' ? (
                    <img className="chat-message__image" src={textOf(message)} alt={t('图片消息')} />
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
                    <TextWithEmoji text={textOf(message) || t('[非文本消息]')} />
                  )}
                </div>
                <div className="chat-message__time">{message.sendTime || message.addTime || ''}</div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        {pendingProduct || pendingOrder ? (
          <aside className="chat-side">
            {pendingProduct ? (
              <div className="chat-side__section">
                <div className="chat-side__title">{t('咨询商品')}</div>
                <div className="chat-side__card">
                  <img src={String(pendingProduct.picUrl || '')} alt="" />
                  <div>
                    <div className="chat-side__name">{String(pendingProduct.productName || '')}</div>
                    <div className="chat-side__price">¥{Number(pendingProduct.productPrice || 0).toFixed(2)}</div>
                  </div>
                </div>
              </div>
            ) : null}
            {pendingOrder ? (
              <div className="chat-side__section">
                <div className="chat-side__title">{t('相关订单')}</div>
                <div className="chat-side__card">
                  <img src={String(pendingOrder.picUrl || '')} alt="" />
                  <div>
                    <div className="chat-side__name">{String(pendingOrder.productName || '')}</div>
                    <div className="chat-side__price">
                      ¥{Number(pendingOrder.totalAmount || 0).toFixed(2)} · {String(pendingOrder.orderStatusName || '')}
                    </div>
                  </div>
                </div>
                <Button size="small" onClick={() => void sendCard(pendingOrder, active?.shopId ?? 0, 'order')}>{t('再次发送订单卡片')}</Button>
              </div>
            ) : null}
          </aside>
        ) : null}
        <div className="chat-input">
          <div className="chat-input__tools">
            <label className="chat-input__tool">{t('图片')}<input
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
            {/* 源码 ChatInput/Emoji.vue：表情选择器，插入 [表情名] 标记 */}
            <button type="button" className="chat-input__tool" onClick={() => setEmojiOpen((open) => !open)}>{t('表情')}</button>
            <span className="chat-input__tips">{t('按 Shift + Enter 换行')}</span>
            {emojiOpen ? (
              <div className="chat-emoji-picker">
                {emojiElements.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    title={item.name}
                    onClick={() => {
                      setInput((current) => `${current}[${item.name}]`);
                      setEmojiOpen(false);
                    }}
                  >
                    <img src={`${EMOJI_BASE}${item.id}.png`} alt={item.name} />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={t('输入消息，按发送')}
            rows={3}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <Button theme="solid" type="primary" loading={sending} onClick={() => void send()}>{t('发送')}</Button>
        </div>
      </section>
    </div>
  );
}
