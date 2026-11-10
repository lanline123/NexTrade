'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Card, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';
import { EMOJI_BASE, emojiElements, splitEmoji } from '@/components/emojiElements';

import { useTranslation } from 'react-i18next';
import { formatPrice } from '@/lib/currency';
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

  if (loading) {
    return (
      <div className="pg-chat-index">
        <div className="im-page" id="im-body">
          <div className="im-container">
            <div className="pg-chat-list">
              <div className="chat-list-container">
                <div className="list-content">
                  <div className="loading-wrapper">
                    <span>{t('加载中...')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pg-chat-index">
      <div className="im-page" id="im-body">
        <div className="im-container">
          {/* 左侧：会话列表（源码 ChatList.vue） */}
          <div className="pg-chat-list">
            <div className="chat-list-container">
              <div className="title-box">
                <div className="title-text">{t('聊天列表')}</div>
              </div>
              <div className="list-content">
                {conversations.map((item) => (
                  <div
                    key={item.conversationId}
                    className={`chat-item${active?.conversationId === item.conversationId ? ' active' : ''}`}
                    onClick={() => setActive(item)}
                  >
                    <div className="avatar-wrapper">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className={`avatar${item.shopId ? '' : ' self-operated'}`} src={item.shopLogo || ''} alt={item.shopTitle || ''} />
                      {Number(item.unreadCount || 0) > 0 ? (
                        <span className="badge">{Number(item.unreadCount) > 99 ? '99+' : String(item.unreadCount)}</span>
                      ) : null}
                    </div>
                    <div className="info-wrapper">
                      <div className="top-row">
                        <span className="name">{item.shopTitle || (item.shopId ? t('店铺客服') : t('平台自营'))}</span>
                        <span className="time">{item.lastTime || ''}</span>
                      </div>
                      <div className="bottom-row">
                        <span className="last-msg">{item.lastMessage || ''}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {!conversations.length ? (
                  <div className="empty-wrapper">
                    <span>{t('暂无消息')}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {active ? (
            <>
              {/* 中间：聊天区域（源码 index.vue + ChatMessageList.vue + ChatInput.vue） */}
              <div className="chat-main">
                <div className="chat-header">
                  <span className="title">{active.shopTitle || t('客服会话')}</span>
                  {active.shopId ? null : <span className="official-tag">{t('平台自营')}</span>}
                </div>

                <div className="pg-chat-message-list">
                  <div className="message-list-container">
                    {loadingMore ? (
                      <div className="loading-more">
                        <span>{t('加载中...')}</span>
                      </div>
                    ) : null}
                    {hasMore && !loadingMore ? (
                      <div className="load-end" onClick={() => void loadOlder()} style={{ cursor: 'pointer' }}>
                        <span>{t('查看更多消息')}</span>
                      </div>
                    ) : null}

                    {[...olderMessages, ...messages].map((message, index) => {
                      const self = Boolean(message.isSelf) || Number(message.senderType) === 1;
                      const kind = messageKind(message);
                      const product = cardOf(message, 'product');
                      const order = cardOf(message, 'order');
                      return (
                        <div className="message-item" key={message.id || index}>
                          {kind === 'system' ? (
                            <div className="system-msg">
                              <span>{textOf(message)}</span>
                            </div>
                          ) : (
                            <div className={`msg-row ${self ? 'right' : 'left'}`}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                className={`avatar${self ? '' : ' shop-avatar'}`}
                                src={self ? '' : active.shopLogo || ''}
                                alt=""
                              />
                              <div className="msg-content-wrapper">
                                <div className="msg-header">
                                  <span className="name">{self ? '' : active.shopTitle || t('平台自营')}</span>
                                  <span className="time" style={self ? { marginRight: 8 } : { marginLeft: 8 }}>
                                    {message.sendTime || message.addTime || ''}
                                  </span>
                                </div>
                                {kind === 'image' ? (
                                  <div className={`bubble ${self ? 'blue' : 'white'} image-bubble`}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img className="msg-image" src={textOf(message)} alt={t('图片消息')} />
                                  </div>
                                ) : product ? (
                                  <div className="product-card">
                                    <div className="product-img">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={String(product.picThumb || product.pic || '')} alt="" />
                                    </div>
                                    <div className="product-info">
                                      <div className="product-name">{String(product.productName || product.name || '')}</div>
                                      <div className="product-price">{formatPrice(Number(product.price || 0))}</div>
                                    </div>
                                  </div>
                                ) : order ? (
                                  <div className="order-card">
                                    <div className="order-header">{String(order.orderStatusName || '')}</div>
                                    <div className="order-body">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img className="order-img" src={String(order.picThumb || order.pic || '')} alt="" />
                                      <div className="order-info">
                                        <div className="order-name">{String(order.productName || '')}</div>
                                        <div className="order-detail">
                                          {t('共')} {String(order.productNum || '')} {t('件商品')}，{t('合计')}{formatPrice(Number(order.totalAmount || order.orderAmount || 0))}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className={`bubble ${self ? 'blue' : 'white'}`}>
                                    <TextWithEmoji text={textOf(message) || t('[非文本消息]')} />
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                </div>

                {/* 输入框（源码 ChatInput.vue + Emoji.vue） */}
                <div className="pg-chat-input">
                  <div className="chat-input-container">
                    <div className="toolbar">
                      <div className="tool-btn emoji-btn" title={t('表情')} onClick={() => setEmojiOpen((open) => !open)}>
                        <span>☺</span>
                      </div>
                      <label className="tool-btn image-btn" title={t('图片')}>
                        <span>▧</span>
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
                    </div>

                    {emojiOpen ? (
                      <div className="emoji-picker-wrapper">
                        <div className="pg-chat-emoji">
                          <div className="emoji-picker">
                            <div className="emoji-list">
                              {emojiElements.map((item) => (
                                <div
                                  className="emoji-item"
                                  key={item.id}
                                  title={item.name}
                                  onClick={() => {
                                    setInput((current) => `${current}[${item.name}]`);
                                    setEmojiOpen(false);
                                  }}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img className="emoji-img" src={`${EMOJI_BASE}${item.id}.png`} alt={item.name} />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="input-area">
                      <textarea
                        className="msg-input"
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        placeholder={t('请输入消息，按Enter键或 点击发送按钮发送')}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            void send();
                          }
                        }}
                      />
                    </div>

                    <div className="action-area">
                      <span className="tips">{t('按 Shift + Enter 换行')}</span>
                      <button className="send-btn" type="button" disabled={!input.trim() || sending} onClick={() => void send()}>
                        {t('发送')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 右侧：信息面板（源码 ChatRight.vue） */}
              <div className="pg-chat-right">
                <div className="chat-right-container">
                  <div className="shop-card">
                    <div className="shop-header">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className={`shop-avatar${active.shopId ? '' : ' shop-avatar--contain'}`}
                        src={active.shopLogo || ''}
                        alt=""
                      />
                      <div className={`shop-info${active.shopId ? '' : ' centered'}`}>
                        <div className="flex" style={{ alignItems: 'center' }}>
                          <span className="shop-name">{active.shopTitle || t('平台自营')}</span>
                          {active.shopId ? null : <span className="official-tag">{t('官方')}</span>}
                        </div>
                        <div className="shop-actions">
                          {active.shopId ? (
                            <a className="enter-shop-btn" href={`/shop/${active.shopId}`}>
                              {t('进入店铺')}
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  {pendingProduct ? (
                    <div className="info-section">
                      <div className="section-title">{t('咨询商品')}</div>
                      <a className="product-card" href={`/product/${String(pendingProduct.productId || '')}`} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="product-img" src={String(pendingProduct.picUrl || '')} alt="" />
                        <div className="product-details">
                          <div className="product-name">{String(pendingProduct.productName || '')}</div>
                          <div className="product-price">{formatPrice(Number(pendingProduct.productPrice || 0))}</div>
                        </div>
                      </a>
                    </div>
                  ) : null}

                  {pendingOrder ? (
                    <div className="info-section">
                      <div className="section-title">{t('相关订单')}</div>
                      <div className="order-card">
                        <div className="order-header">
                          <span className="order-sn">{String(pendingOrder.orderSn || '')}</span>
                          <span className="order-status">{String(pendingOrder.orderStatusName || '')}</span>
                        </div>
                        <div className="order-body">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img className="product-img" src={String(pendingOrder.picUrl || '')} alt="" />
                          <div className="order-details">
                            <div className="order-name">{String(pendingOrder.productName || '')}</div>
                            <div className="order-detail">{formatPrice(Number(pendingOrder.totalAmount || 0))}
                            </div>
                          </div>
                        </div>
                      </div>
                      <button
                        className="send-btn"
                        type="button"
                        onClick={() => void sendCard(pendingOrder, active?.shopId ?? 0, 'order')}
                      >
                        {t('再次发送订单卡片')}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            /* 没有选中会话时的默认面板（源码 index.vue 的 .im-layout > .im-default-box） */
            <div className="im-layout">
              <div className="im-default-box">
                <div className="im-default">
                  <div className="im-default-icon">
                    <span className="iconfont-pc icon-xiaoxi" />
                  </div>
                  <div className="im-default-text">
                    <span>{t('没有选中会话哦')}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

