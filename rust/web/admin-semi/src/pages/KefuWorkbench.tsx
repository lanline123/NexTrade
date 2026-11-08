/**
 * 客服工作台（KefuWorkbench）+ 历史会话列表（KefuHistory）。
 *
 * 对应原版 views/im/Index.vue（1803 行工作台）+ views/im/History.vue（历史会话）
 * + views/im/src/QueueList.vue（待接入队列）+ views/im/src/HistoryInfo.vue（会话详情）。
 *
 * 后端契约（Rust root/im 全部已实现）：
 * - GET  /im/conversation/conversation/list?status=1|2   会话列表（进行中/已结束）
 * - GET  /im/conversation/conversation/waitServantList   待接入队列
 * - POST /im/conversation/conversation/transfer          接入/转接会话
 * - POST /im/conversation/conversation/del               删除会话
 * - GET  /im/conversation/message/list                   会话消息
 * - POST /im/conversation/message/send                   发送消息（服务端覆盖 type/servantId）
 * - POST /im/conversation/message/setRead                设置已读
 * - GET  /im/servant/servant/getStatus                   客服状态（1 在线 / 2 忙 / 3 离开）
 * - POST /im/servant/servant/modifyStatus                修改客服状态
 * - GET  /im/conversation/conversation/consultHistory    历史会话列表
 * - POST /im/conversation/conversation/updateField       结束会话（field=status，val=2）
 *
 * 旧版补齐（2026-11-07）：结束会话、表情面板（Emoji.vue）、新消息提示音
 * （promptTone.vue，WebAudio 合成）、会员最近订单侧栏（OrderImList，复用
 * /order/order/list?userId=）。
 *
 * 实时性：Rust 后端未迁移 WebSocket 推送，本页以 5s 轮询兜底，
 * 同时尝试连接 /ws（老版独立 IM 服务），连接成功后收到消息即时刷新。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Avatar,
  Badge,
  Button,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  TextArea,
  Toast,
} from '@douyinfe/semi-ui';
import { IconSearch, IconRefresh } from '@douyinfe/semi-icons';
import { apiGet, apiPost, getToken } from '../api';
import { useI18n } from '../i18n';
import type { ColumnConfig } from '../framework/types';

/* ============================== 类型 ============================== */

interface ImUserVO {
  userId?: number;
  username?: string;
  nickname?: string;
  avatar?: string;
}

interface ContentVO {
  messageType?: string;
  content?: string;
  pic?: string;
  videoUrl?: string;
  videoCover?: string;
  contentCategory?: string;
  order?: {
    orderId?: number;
    orderSn?: string;
    picUrl?: string;
    productName?: string;
    productNum?: number;
    totalAmount?: number | string;
    orderStatusName?: string;
  };
  product?: {
    productId?: number;
    picUrl?: string;
    productName?: string;
    productSn?: string;
    productPrice?: number | string;
  };
}

interface ConversationRow {
  id?: number;
  conversationId?: number;
  userId?: number;
  lastServantId?: number;
  addTime?: string;
  lastUpdateTime?: string;
  userFrom?: string;
  status?: number;
  remark?: string;
  unreadMessageCount?: number;
  unreadServantMessageCount?: number;
  user?: ImUserVO | null;
  lastMessage?: Array<{ content?: ContentVO; sendTime?: string; type?: number }> | null;
}

interface MessageRow {
  id?: number;
  conversationId?: number;
  content?: ContentVO;
  type?: number;
  userId?: number;
  servantId?: number;
  sendTime?: string;
  isRead?: number;
  user?: { username?: string; nickname?: string; avatar?: string } | null;
  servant?: { username?: string; avatar?: string } | null;
}

interface WaitServantRow {
  id?: number;
  conversationId?: number;
  userId?: number;
  addTime?: string;
  userFrom?: string;
  user?: ImUserVO | null;
}

type Translate = (key: string, params?: Record<string, string | number>) => string;

/* ============================== 通用 ============================== */

/**
 * 旧版表情码表（components/emoji/src/emojiElements.ts 139 项逐字对齐）：
 * 消息文本中白名单 `[表情名]` 渲染为 oss 表情图（旧版 emojiHtml 同款）。
 */
const EMOJI_CODES: Array<[string, string]> = [
  ['微笑', '1'], ['龇牙', '2'], ['色', '3'], ['发呆', '4'], ['可怜', '5'],
  ['流泪', '6'], ['害羞', '7'], ['闭嘴', '8'], ['睡', '9'], ['吃瓜群众', '10'],
  ['尴尬', '11'], ['发怒', '12'], ['调皮', '13'], ['撇嘴', '14'], ['思考', '15'],
  ['不失礼貌的微笑', '16'], ['奸笑', '17'], ['抓狂', '18'], ['吐', '19'], ['偷笑', '20'],
  ['愉快', '21'], ['白眼', '22'], ['傲慢', '23'], ['困', '24'], ['灵光一现', '25'],
  ['流汗', '26'], ['憨笑', '27'], ['捂脸', '28'], ['奋斗', '29'], ['咒骂', '30'],
  ['疑问', '31'], ['嘘', '32'], ['晕', '33'], ['衰', '34'], ['骷髅', '35'],
  ['敲打', '36'], ['再见', '37'], ['擦汗', '38'], ['抠鼻', '39'], ['泣不成声', '40'],
  ['坏笑', '41'], ['左哼哼', '42'], ['右哼哼', '43'], ['打哈欠', '44'], ['鄙视', '45'],
  ['委屈', '46'], ['快哭了', '47'], ['摸头', '48'], ['阴险', '49'], ['亲亲', '50'],
  ['机智', '51'], ['得意', '52'], ['大金牙', '53'], ['拥抱', '54'], ['大笑', '55'],
  ['送心', '56'], ['震惊', '57'], ['酷拽', '58'], ['尬笑', '59'], ['大哭', '60'],
  ['哭笑', '61'], ['做鬼脸', '62'], ['红脸', '63'], ['鼓掌', '64'], ['恐惧', '65'],
  ['斜眼', '66'], ['嘿哈', '67'], ['惊讶', '68'], ['绝望的凝视', '69'], ['囧', '70'],
  ['皱眉', '71'], ['耶', '72'], ['石化', '73'], ['我想静静', '74'], ['吐血', '75'],
  ['互粉', '76'], ['互相关注', '77'], ['加好友', '78'], ['强', '79'], ['钱', '80'],
  ['飞吻', '81'], ['打脸', '82'], ['惊恐', '83'], ['悠闲', '84'], ['泪奔', '85'],
  ['舔屏', '86'], ['紫薇别走', '87'], ['听歌', '88'], ['难过', '89'], ['生病', '90'],
  ['绿帽子', '91'], ['如花', '92'], ['惊喜', '93'], ['吐彩虹', '94'], ['吐舌', '95'],
  ['无辜呆', '96'], ['看', '97'], ['白眼的狗', '98'], ['黑脸', '99'], ['猪头', '100'],
  ['熊吉', '101'], ['不看', '102'], ['玫瑰', '103'], ['凋谢', '104'], ['嘴唇', '105'],
  ['爱心', '106'], ['心碎', '107'], ['赞', '108'], ['弱', '109'], ['握手', '110'],
  ['ok', '111'], ['谢谢', '112'], ['比心', '113'], ['碰拳', '114'], ['击掌', '115'],
  ['左', '116'], ['右', '117'], ['力量', '118'], ['胜利', '119'], ['抱拳', '120'],
  ['勾引', '121'], ['拳头', '122'], ['庆祝', '123'], ['礼物', '124'], ['红包', '125'],
  ['18禁', '126'], ['去污粉', '127'], ['666', '128'], ['给力', '129'], ['v5', '130'],
  ['菜刀', '131'], ['炸弹', '132'], ['便便', '133'], ['月亮', '134'], ['太阳', '135'],
  ['发', '136'], ['黄瓜', '137'], ['西瓜', '138'], ['啤酒', '139'],
];

const EMOJI_ID_BY_NAME = new Map<string, string>(EMOJI_CODES);

const emojiImgSrc = (id: string) => `https://oss.tigshop.com/official/emoji/${id}.png`;

/** 文本切分：白名单 `[表情名]` 段 vs 普通文本段（未识别的码保持原样文本）。 */
interface EmojiSegment {
  type: 'text' | 'emoji';
  value: string;
}

function splitEmojiSegments(input: string): EmojiSegment[] {
  const segments: EmojiSegment[] = [];
  const re = /\[([^\[\]]+)\]/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(input))) {
    if (match.index > last) segments.push({ type: 'text', value: input.slice(last, match.index) });
    const id = EMOJI_ID_BY_NAME.get(match[1]);
    if (id) segments.push({ type: 'emoji', value: id });
    else segments.push({ type: 'text', value: match[0] });
    last = re.lastIndex;
  }
  if (last < input.length) segments.push({ type: 'text', value: input.slice(last) });
  return segments;
}

/** 按旧版 emojiHtml 规则渲染文本（React 片段实现，等价 escapeHtml + 白名单替换）。 */
const EmojiText = ({ text }: { text: string }) => {
  const segments = splitEmojiSegments(text || '');
  return (
    <>
      {segments.map((segment, index) =>
        segment.type === 'emoji' ? (
          <img key={index} className="kefu-emoji" src={emojiImgSrc(segment.value)} alt="" />
        ) : (
          <span key={index}>{segment.value}</span>
        ),
      )}
    </>
  );
};

const STATUS_OPTIONS = [
  { value: 1, label: '在线' },
  { value: 2, label: '忙碌' },
  { value: 3, label: '离开' },
];

const servantStatusLabel = (value: number | undefined, t: Translate) => {
  const found = STATUS_OPTIONS.find((item) => item.value === value);
  return found ? t(found.label) : t('未知');
};

/** 右栏订单状态页签（旧版 OrderImList.vue checkTabs 的 orderStatus 映射逐项对齐）。 */
const ORDER_TABS: Array<{ key: number; label: string; status: number | string }> = [
  { key: 1, label: '全部', status: -1 },
  { key: 2, label: '未完成', status: '0,1,2' },
  { key: 3, label: '已完成', status: 5 },
  { key: 4, label: '已关闭', status: '3,4,-2' },
];

interface OrderImRow extends Record<string, any> {
  orderId?: number;
  orderSn?: string;
  addTime?: string;
  orderStatusName?: string;
  totalAmount?: number | string;
  adminNote?: string;
  items?: Array<{ picThumb?: string; picUrl?: string; productName?: string }>;
}

/** 会话列表项的预览文案（取 lastMessage 最后一条）。 */
const conversationPreview = (row: ConversationRow, t: Translate) => {
  const list = row.lastMessage || [];
  const last = list[list.length - 1];
  if (!last?.content) return t('暂无消息');
  const content = last.content;
  const type = (content.messageType || '').toLowerCase();
  if (type === 'image') return `[${t('图片')}]`;
  if (type === 'video') return `[${t('视频')}]`;
  if (type === 'sound') return `[${t('语音')}]`;
  if (type === 'file') return `[${t('文件')}]`;
  if (content.product) return `[${t('商品')}] ${content.product.productName || ''}`;
  if (content.order) return `[${t('订单')}] ${content.order.orderSn || ''}`;
  return content.content || t('暂无消息');
};

/** 用户消息渲染（气泡内容）。 */
const MessageBubbleContent = ({ content }: { content?: ContentVO }) => {
  const { t } = useI18n();
  if (!content) return <span>--</span>;
  const type = (content.messageType || '').toLowerCase();
  if (type === 'image' && content.pic) {
    return <img src={content.pic} alt="image" style={{ maxWidth: 220, maxHeight: 220, borderRadius: 6 }} />;
  }
  if (type === 'video' && content.videoUrl) {
    return (
      <video src={content.videoUrl} controls style={{ maxWidth: 260, borderRadius: 6 }} poster={content.videoCover} />
    );
  }
  if (type === 'sound') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        🎤 {t('[语音消息]')}
        {content.content ? <audio src={content.content} controls style={{ height: 36 }} /> : null}
      </span>
    );
  }
  if (type === 'file') {
    return (
      <span>
        📎 {t('[文件]')} {content.content}
      </span>
    );
  }
  if (content.product) {
    return (
      <div className="kefu-product-card">
        {content.product.picUrl ? (
          <img src={content.product.picUrl} alt="" style={{ width: 48, height: 48, borderRadius: 4, objectFit: 'cover' }} />
        ) : null}
        <div>
          <div>{content.product.productName || '--'}</div>
          <div style={{ color: 'var(--semi-color-danger)', fontSize: 12 }}>
            ¥{Number(content.product.productPrice || 0).toFixed(2)}
          </div>
        </div>
      </div>
    );
  }
  if (content.order) {
    return (
      <div className="kefu-product-card">
        {content.order.picUrl ? (
          <img src={content.order.picUrl} alt="" style={{ width: 48, height: 48, borderRadius: 4, objectFit: 'cover' }} />
        ) : null}
        <div>
          <div>{content.order.productName || content.order.orderSn || '--'}</div>
          <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>
            {t('订单号')}：{content.order.orderSn || '--'} · {content.order.orderStatusName || ''}
          </div>
          <div style={{ color: 'var(--semi-color-danger)', fontSize: 12 }}>
            ¥{Number(content.order.totalAmount || 0).toFixed(2)}
          </div>
        </div>
      </div>
    );
  }
  return (
    <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      <EmojiText text={content.content || ''} />
    </span>
  );
};

/* ============================== 客服工作台 ============================== */

export function KefuWorkbench() {
  const { t } = useI18n();

  // 客服状态
  const [servantStatus, setServantStatus] = useState<number | undefined>(undefined);
  // 会话
  const [convTab, setConvTab] = useState('1');
  const [convKeyword, setConvKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [convLoading, setConvLoading] = useState(false);
  const [activeId, setActiveId] = useState<number | undefined>(undefined);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  // 待接入
  const [queueVisible, setQueueVisible] = useState(false);
  const [queueRows, setQueueRows] = useState<WaitServantRow[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  // 实时
  const pollRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  // 新消息提示音（旧版 promptTone.vue：收到新客户消息时短提示）
  const lastMsgIdRef = useRef<number | null>(null);
  const lastMsgCountRef = useRef(0);
  // 表情面板 + 右栏会员订单（旧版 OrderImList）
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [orderTab, setOrderTab] = useState(1);
  const [userOrders, setUserOrders] = useState<OrderImRow[]>([]);
  const [orderTotal, setOrderTotal] = useState(0);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderRefresh, setOrderRefresh] = useState(0);
  const [remarkModal, setRemarkModal] = useState<{ id: number; value: string } | null>(null);
  const [remarkSaving, setRemarkSaving] = useState(false);

  /** 收到新客户消息时播放短提示音（WebAudio 合成，无需音频资源）。 */
  const playMessageTone = useCallback(() => {
    try {
      const AudioCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      const ctx = new AudioCtor();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
      setTimeout(() => void ctx.close(), 400);
    } catch {
      /* 无音频设备/被浏览器策略拦截时静默 */
    }
  }, []);

  const loadServantStatus = useCallback(() => {
    apiGet<any>('/im/servant/servant/getStatus')
      .then((result) => {
        const status = typeof result === 'number' ? result : result?.status;
        if (status === 1 || status === 2 || status === 3) setServantStatus(status);
      })
      .catch(() => undefined);
  }, []);

  const loadConversations = useCallback(
    (silent = false) => {
      if (!silent) setConvLoading(true);
      apiGet<any>('/im/conversation/conversation/list', {
        status: convTab === '1' ? 1 : 2,
        username: appliedKeyword || undefined,
        page: 1,
        size: 50,
      })
        .then((result) => setConversations(result?.records || []))
        .catch((error) => Toast.error({ content: error?.message || t('加载会话列表失败') }))
        .finally(() => {
          if (!silent) setConvLoading(false);
        });
    },
    [convTab, appliedKeyword, t],
  );

  const loadQueue = useCallback(() => {
    setQueueLoading(true);
    apiGet<any>('/im/conversation/conversation/waitServantList', { page: 1, size: 50 })
      .then((result) => setQueueRows(result?.records || []))
      .catch((error) => Toast.error({ content: error?.message || t('加载待接入列表失败') }))
      .finally(() => setQueueLoading(false));
  }, []);

  const loadMessages = useCallback(
    (conversationId: number, silent = false) => {
      if (!silent) setMsgLoading(true);
      apiGet<any>('/im/conversation/message/list', {
        conversationId,
        page: 1,
        size: 100,
        sortField: 'sendTime',
        sortOrder: 'asc',
      })
        .then((result) => {
          const rows: MessageRow[] = result?.records || [];
          // 静默轮询发现「新的客户消息」（非自己发送）时播放提示音
          if (silent) {
            const latestId = rows.length ? Number(rows[rows.length - 1].id ?? 0) : 0;
            const grew = rows.length > lastMsgCountRef.current;
            const hasNewFromUser =
              grew && rows.some((msg) => Number(msg.type) !== 2 && Number(msg.id ?? 0) > (lastMsgIdRef.current ?? 0));
            if (hasNewFromUser) playMessageTone();
            lastMsgIdRef.current = Math.max(latestId, lastMsgIdRef.current ?? 0);
            lastMsgCountRef.current = rows.length;
          }
          setMessages(rows);
        })
        .catch((error) => {
          if (!silent) Toast.error({ content: error?.message || t('加载消息失败') });
        })
        .finally(() => {
          if (!silent) setMsgLoading(false);
        });
    },
    [t, playMessageTone],
  );

  const markRead = useCallback((conversationId: number) => {
    apiPost('/im/conversation/message/setRead', { conversationId }).catch(() => undefined);
  }, []);

  // 初始加载 + 轮询
  useEffect(() => {
    loadServantStatus();
    loadConversations();
    // WebSocket（尽力而为，失败自动退回轮询）；管理端 WS 在 8080，
    // 需带 token + platform=admin（生产 nginx 按该参数分流）
    try {
      const wsParams = new URLSearchParams({ token: getToken() || '', platform: 'admin' });
      const wsUrl = `${location.origin.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')}/ws?${wsParams.toString()}`;
      const ws = new WebSocket(wsUrl);
      ws.onmessage = () => {
        loadConversations(true);
        if (activeId) loadMessages(activeId, true);
      };
      wsRef.current = ws;
    } catch {
      wsRef.current = null;
    }
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadConversations();
  }, [convTab, appliedKeyword, loadConversations]);

  useEffect(() => {
    pollRef.current = window.setInterval(() => {
      loadConversations(true);
      if (activeId) loadMessages(activeId, true);
      if (queueVisible) loadQueue();
    }, 5000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [activeId, queueVisible, loadConversations, loadMessages, loadQueue]);

  // 打开会话：拉取消息 + 已读
  useEffect(() => {
    if (!activeId) return;
    loadMessages(activeId);
    markRead(activeId);
  }, [activeId, loadMessages, markRead]);

  // 消息滚动到底
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const changeStatus = async (next: number) => {
    try {
      await apiPost('/im/servant/servant/modifyStatus', { status: next });
      setServantStatus(next);
      Toast.success({ content: t('状态已更新') });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    }
  };

  const openConversation = (row: ConversationRow) => {
    setActiveId(row.conversationId ?? row.id);
  };

  /** 结束会话（对齐旧版 Message.vue _updateFieldConversation：status→2）。 */
  const endConversation = async () => {
    if (!activeId) return;
    try {
      await apiPost('/im/conversation/conversation/updateField', { id: activeId, field: 'status', val: 2 });
      Toast.success({ content: t('会话已结束') });
      setActiveId(undefined);
      loadConversations(true);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    }
  };

  /** 会话客户的最近订单（旧版 OrderImList：右栏 + 状态页签 + 备注入口）。 */
  useEffect(() => {
    if (!activeId) {
      setUserOrders([]);
      setOrderTotal(0);
      return;
    }
    const userId = conversations.find((row) => (row.conversationId ?? row.id) === activeId)?.userId;
    if (!userId) {
      setUserOrders([]);
      setOrderTotal(0);
      return;
    }
    let alive = true;
    setOrderLoading(true);
    const status = ORDER_TABS.find((tab) => tab.key === orderTab)?.status ?? -1;
    apiGet<{ records?: OrderImRow[]; total?: number }>('/order/order/list', {
      userId,
      orderStatus: status,
      page: 1,
      size: 20,
      sortField: 'addTime',
      sortOrder: 'desc',
    })
      .then((result) => {
        if (!alive) return;
        setUserOrders(result?.records || []);
        setOrderTotal(Number(result?.total || 0));
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setOrderLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [activeId, conversations, orderTab, orderRefresh]);

  /** 订单备注（旧版 EditRemark：/order/order/setAdminNote）。 */
  const saveRemark = async () => {
    if (!remarkModal) return;
    setRemarkSaving(true);
    try {
      await apiPost('/order/order/setAdminNote', { id: remarkModal.id, adminNote: remarkModal.value });
      Toast.success({ content: t('备注已保存') });
      setRemarkModal(null);
      setOrderRefresh((count) => count + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setRemarkSaving(false);
    }
  };

  const removeConversation = async (row: ConversationRow) => {
    try {
      await apiPost('/im/conversation/conversation/del', { conversationId: row.conversationId ?? row.id });
      Toast.success({ content: t('删除成功') });
      if (activeId && (row.conversationId ?? row.id) === activeId) setActiveId(undefined);
      loadConversations(true);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
    }
  };

  const acceptQueue = async (row: WaitServantRow) => {
    try {
      await apiPost('/im/conversation/conversation/transfer', {
        conversationId: row.conversationId ?? row.id,
        type: 'autoTransfer',
      });
      Toast.success({ content: t('接入成功') });
      setQueueVisible(false);
      setConvTab('1');
      loadConversations(true);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('接入失败') });
    }
  };

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || !activeId) return;
    setSending(true);
    try {
      await apiPost('/im/conversation/message/send', {
        conversationId: activeId,
        content: { messageType: 'text', content: text },
      });
      setDraft('');
      loadMessages(activeId, true);
      loadConversations(true);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('发送失败') });
    } finally {
      setSending(false);
    }
  };

  const activeConversation = conversations.find(
    (row) => (row.conversationId ?? row.id) === activeId,
  );
  const queueCount = queueRows.length;

  const queueColumns: ColumnConfig<WaitServantRow>[] = [
    {
      title: '客户名称',
      dataIndex: 'username',
      width: 160,
      render: (_value: unknown, row: WaitServantRow) => (
        <span>{row.user?.nickname || row.user?.username || row.userId || '--'}</span>
      ),
    },
    { title: '会话来源', dataIndex: 'userFrom', width: 100 },
    {
      title: '进入排队时间',
      dataIndex: 'addTime',
      width: 180,
      render: (value: string) => <span>{value || '--'}</span>,
    },
    {
      title: '操作',
      width: 110,
      render: (_value: unknown, row: WaitServantRow) => (
        <Button theme="borderless" type="primary" size="small" onClick={() => acceptQueue(row)}>
          {t('接入会话')}
        </Button>
      ),
    },
  ];

  return (
    <div className="kefu-workbench">
      <div className="kefu-workbench-toolbar">
        <Space>
          <span className="kefu-status-label">{t('客服状态')}</span>
          <Select
            style={{ width: 120 }}
            value={servantStatus}
            optionList={STATUS_OPTIONS.map((item) => ({ ...item, label: t(item.label) }))}
            onChange={(next) => changeStatus(Number(next))}
          />
          {servantStatus !== undefined && (
            <Tag color={servantStatus === 1 ? 'green' : servantStatus === 2 ? 'orange' : 'grey'}>
              {servantStatusLabel(servantStatus, t)}
            </Tag>
          )}
        </Space>
        <Space>
          <Badge count={queueCount > 0 ? queueCount : undefined} overflowCount={99}>
            <Button onClick={() => { setQueueVisible(true); loadQueue(); }}>{t('待接入列表')}</Button>
          </Badge>
          <Button icon={<IconRefresh />} onClick={() => loadConversations(true)}>{t('刷新')}</Button>
        </Space>
      </div>

      <div className="kefu-workbench-body">
        {/* 左侧：会话列表 */}
        <div className="kefu-conversation-panel">
          <Tabs
            type="card"
            activeKey={convTab}
            onChange={(key) => { setConvTab(key as string); setActiveId(undefined); }}
            tabList={[
              { itemKey: '1', tab: t('进行中') },
              { itemKey: '2', tab: t('已结束') },
            ]}
            style={{ marginBottom: 8 }}
          />
          <div style={{ marginBottom: 8 }}>
            <Input
              prefix={<IconSearch />}
              placeholder={t('搜索客户名称')}
              value={convKeyword}
              showClear
              onClear={() => setAppliedKeyword('')}
              onChange={(next) => setConvKeyword(next)}
              onEnterPress={() => setAppliedKeyword(convKeyword.trim())}
            />
          </div>
          <Spin spinning={convLoading}>
            <div className="kefu-conversation-list">
              {conversations.length === 0 && (
                <Empty description={t('暂无会话')} style={{ padding: 40 }} />
              )}
              {conversations.map((row) => {
                const convKey = row.conversationId ?? row.id;
                const unread = convTab === '1' ? Number(row.unreadMessageCount || 0) : 0;
                return (
                  <div
                    key={convKey}
                    className={`kefu-conversation-item ${convKey === activeId ? 'is-active' : ''}`}
                    onClick={() => openConversation(row)}
                  >
                    <Avatar
                      src={row.user?.avatar}
                      size="default"
                      alt={row.user?.nickname || row.user?.username || ''}
                    >
                      {(row.user?.nickname || row.user?.username || '?').slice(0, 1)}
                    </Avatar>
                    <div className="kefu-conversation-meta">
                      <div className="kefu-conversation-name">
                        <span className="kefu-conversation-title">
                          {row.user?.nickname || row.user?.username || `#${row.userId ?? '--'}`}
                        </span>
                        <span className="kefu-conversation-time">
                          {(row.lastUpdateTime || row.addTime || '').slice(0, 16)}
                        </span>
                      </div>
                      <div className="kefu-conversation-preview">{conversationPreview(row, t)}</div>
                    </div>
                    {unread > 0 && <Badge count={unread} overflowCount={99} />}
                    <Popconfirm
                      title={t('确认删除该会话？')}
                      onConfirm={(event) => {
                        event?.stopPropagation?.();
                        void removeConversation(row);
                      }}
                    >
                      <Button
                        theme="borderless"
                        type="danger"
                        size="small"
                        className="kefu-conversation-del"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {t('删除')}
                      </Button>
                    </Popconfirm>
                  </div>
                );
              })}
            </div>
          </Spin>
        </div>

        {/* 右侧：消息窗 */}
        <div className="kefu-message-panel">
          {!activeId && <Empty description={t('请选择左侧会话')} style={{ paddingTop: 120 }} />}
          {activeId && (
            <>
              <div className="kefu-message-header">
                <span>
                  {activeConversation?.user?.nickname || activeConversation?.user?.username || `#${activeConversation?.userId ?? activeId}`}
                </span>
                {activeConversation?.userFrom ? (
                  <Tag size="small">{activeConversation.userFrom}</Tag>
                ) : null}
                {/* 结束会话（旧版 Message.vue「结束」） */}
                {Number(convTab) === 1 && (
                  <Popconfirm title={t('确认结束该会话?')} onConfirm={() => void endConversation()}>
                    <Button theme="borderless" type="danger" size="small" style={{ marginLeft: 'auto' }}>
                      {t('结束会话')}
                    </Button>
                  </Popconfirm>
                )}
              </div>
              <Spin spinning={msgLoading}>
                <div className="kefu-message-list">
                  {messages.map((msg) => {
                    const mine = Number(msg.type) === 2;
                    return (
                      <div key={msg.id} className={`kefu-message-row ${mine ? 'is-mine' : ''}`}>
                        <Avatar
                          src={mine ? msg.servant?.avatar : msg.user?.avatar}
                          size="small"
                          alt=""
                        >
                          {mine
                            ? (msg.servant?.username || '?').slice(0, 1)
                            : (msg.user?.nickname || msg.user?.username || '?').slice(0, 1)}
                        </Avatar>
                        <div className="kefu-message-bubble">
                          <MessageBubbleContent content={msg.content} />
                          <div className="kefu-message-time">{msg.sendTime || ''}</div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              </Spin>
              <div className="kefu-send-box">
                {emojiOpen && (
                  <div
                    className="kefu-emoji-panel"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(10, 1fr)',
                      gap: 4,
                      padding: 8,
                      border: '1px solid var(--semi-color-border)',
                      borderRadius: 6,
                      marginBottom: 8,
                      maxHeight: 156,
                      overflowY: 'auto',
                    }}
                  >
                    {EMOJI_CODES.map(([name, id]) => (
                      <span
                        key={id}
                        title={name}
                        style={{ cursor: 'pointer', textAlign: 'center', lineHeight: 0 }}
                        onClick={() => setDraft((prev) => `${prev}[${name}]`)}
                      >
                        <img className="kefu-emoji" src={emojiImgSrc(id)} alt={name} />
                      </span>
                    ))}
                  </div>
                )}
                <TextArea
                  rows={3}
                  value={draft}
                  onChange={(next) => setDraft(next)}
                  placeholder={t('请输入消息内容，Enter 发送')}
                  onEnterPress={() => sendMessage()}
                />
                <div className="kefu-send-actions">
                  <Button
                    theme="borderless"
                    onClick={() => setEmojiOpen((open) => !open)}
                    style={{ fontSize: 18 }}
                  >
                    😊
                  </Button>
                  <Button theme="solid" type="primary" loading={sending} disabled={!draft.trim()} onClick={sendMessage}>
                    {t('发送')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 最右栏：客户资料 + 最近订单（旧版 OrderImList 侧栏，订单状态页签逐项对齐） */}
        <div className="kefu-side-panel">
          <div className="kefu-customer-card">
            <Avatar src={activeConversation?.user?.avatar} size="default" alt="">
              {(activeConversation?.user?.nickname || activeConversation?.user?.username || '?').slice(0, 1)}
            </Avatar>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="kefu-customer-name">
                {activeConversation?.user?.nickname ||
                  activeConversation?.user?.username ||
                  `#${activeConversation?.userId ?? activeId ?? '--'}`}
              </div>
              <div className="kefu-customer-meta">
                {activeConversation?.userFrom ? <Tag size="small">{activeConversation.userFrom}</Tag> : null}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t('客户名称')}：{activeConversation?.user?.username || '--'}
                </span>
              </div>
            </div>
          </div>
          <div className="kefu-side-section-title">
            <span>{t('最近订单')}</span>
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--semi-color-text-2)' }}>
              {t('共{n}单', { n: orderTotal })}
            </span>
          </div>
          <div className="kefu-order-tabs">
            {ORDER_TABS.map((tab) => (
              <span
                key={tab.key}
                className={`kefu-order-tab ${orderTab === tab.key ? 'is-active' : ''}`}
                onClick={() => setOrderTab(tab.key)}
              >
                {t(tab.label)}
              </span>
            ))}
          </div>
          <Spin spinning={orderLoading}>
            <div className="kefu-order-list">
              {userOrders.length === 0 && !orderLoading && (
                <Empty description={t('暂无订单～')} style={{ padding: '32px 0' }} />
              )}
              {userOrders.map((order) => (
                <div key={order.orderId} className="kefu-order-card">
                  <div className="kefu-order-card-top">
                    <div className="kefu-order-card-lines">
                      <div className="kefu-order-card-line">
                        <span className="kefu-order-card-label">{t('订单编号：')}</span>
                        <span className="kefu-order-card-value mono">{order.orderSn}</span>
                      </div>
                      <div className="kefu-order-card-line">
                        <span className="kefu-order-card-label">{t('下单时间：')}</span>
                        <span className="kefu-order-card-value">{order.addTime || '--'}</span>
                      </div>
                    </div>
                    <span className="kefu-order-status">{order.orderStatusName || ''}</span>
                  </div>
                  <div className="kefu-order-goods">
                    {(order.items?.[0]?.picThumb || order.items?.[0]?.picUrl) ? (
                      <img src={order.items?.[0]?.picThumb || order.items?.[0]?.picUrl} alt="" />
                    ) : null}
                    <div className="kefu-order-goods-name">{order.items?.[0]?.productName || '--'}</div>
                  </div>
                  <div className="kefu-order-summary">
                    {t('共{n}件商品，实付{price}', {
                      n: (order.items || []).length,
                      price: `¥${Number(order.totalAmount || 0).toFixed(2)}`,
                    })}
                  </div>
                  <div className="kefu-order-foot">
                    <Button
                      theme="borderless"
                      type="primary"
                      size="small"
                      onClick={() => setRemarkModal({ id: Number(order.orderId), value: String(order.adminNote || '') })}
                    >
                      {t('备注')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Spin>
        </div>
      </div>

      <Modal
        title={t('待接入列表')}
        visible={queueVisible}
        onCancel={() => setQueueVisible(false)}
        footer={null}
        width={720}
      >
        <Table<WaitServantRow>
          loading={queueLoading}
          dataSource={queueRows}
          rowKey={(record?: WaitServantRow, index?: number) => String(record?.id ?? index ?? 0)}
          pagination={false}
          columns={queueColumns as any}
        />
      </Modal>

      {/* 订单备注（旧版 EditRemark 抽屉的精简弹窗：改管理员备注） */}
      <Modal
        title={t('编辑备注')}
        visible={Boolean(remarkModal)}
        onCancel={() => setRemarkModal(null)}
        onOk={() => void saveRemark()}
        okButtonProps={{ loading: remarkSaving }}
        width={520}
      >
        <TextArea
          rows={4}
          maxLength={200}
          value={remarkModal?.value || ''}
          onChange={(next) => setRemarkModal((current) => (current ? { ...current, value: next } : current))}
          placeholder={t('请输入备注')}
        />
      </Modal>
    </div>
  );
}

/**
 * 全屏独立版工作台（对齐旧版 /im/index 的 layouts/im 专属布局：无后台侧边栏，
 * 菜单「客服工作台」以新标签打开，顶部提供返回后台入口）。
 */
export function KefuWorkbenchStandalone() {
  const { t } = useI18n();
  return (
    <div className="kefu-workbench-standalone">
      <div className="kefu-workbench-standalone-bar">
        <span className="kefu-workbench-standalone-title">{t('客服工作台')}</span>
        <Button
          theme="borderless"
          onClick={() => {
            window.location.href = `${window.location.origin}/?page=dashboard`;
          }}
        >
          {t('返回后台')}
        </Button>
      </div>
      <KefuWorkbench />
    </div>
  );
}

/* ============================== 历史会话列表 ============================== */

interface ConsultHistoryRow {
  id?: number;
  addTime?: string;
  lastUpdateTime?: string;
  userFrom?: string;
  status?: number;
  remark?: string;
  user?: ImUserVO | null;
  servant?: { username?: string } | null;
}

export function KefuHistory() {
  const { t } = useI18n();
  const [rows, setRows] = useState<ConsultHistoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailId, setDetailId] = useState<number | undefined>(undefined);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailMessages, setDetailMessages] = useState<MessageRow[]>([]);

  const [filters, setFilters] = useState<{
    timeType: number;
    startTime: string;
    endTime: string;
    username: string;
    userFrom: string;
    status: string;
    remark: string;
  }>({
    timeType: 1,
    startTime: '',
    endTime: '',
    username: '',
    userFrom: '',
    status: '',
    remark: '',
  });
  const [applied, setApplied] = useState(filters);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiGet<any>('/im/conversation/conversation/consultHistory', {
      page,
      size: 10,
      timeType: applied.timeType,
      startTime: applied.startTime || undefined,
      endTime: applied.endTime || undefined,
      username: applied.username || undefined,
      userFrom: applied.userFrom || undefined,
      status: applied.status || undefined,
      remark: applied.remark || undefined,
    })
      .then((result) => {
        if (!alive) return;
        setRows(result?.records || []);
        setTotal(Number(result?.total || 0));
      })
      .catch((error) => {
        if (alive) Toast.error({ content: error?.message || t('加载历史会话失败') });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [page, applied, t]);

  const openDetail = (row: ConsultHistoryRow) => {
    setDetailVisible(true);
    setDetailId(row.id);
    setDetailLoading(true);
    apiGet<any>('/im/conversation/message/list', {
      conversationId: row.id,
      page: 1,
      size: 100,
      sortField: 'sendTime',
      sortOrder: 'asc',
    })
      .then((result) => setDetailMessages(result?.records || []))
      .catch((error) => Toast.error({ content: error?.message || t('加载消息失败') }))
      .finally(() => setDetailLoading(false));
  };

  const columns: ColumnConfig<ConsultHistoryRow>[] = [
    {
      title: '客户名称',
      dataIndex: 'user',
      width: 160,
      render: (_value: unknown, row: ConsultHistoryRow) => (
        <span>{row.user?.nickname || row.user?.username || '-'}</span>
      ),
    },
    {
      title: '接待客服',
      dataIndex: 'servant',
      width: 120,
      render: (_value: unknown, row: ConsultHistoryRow) => <span>{row.servant?.username || '-'}</span>,
    },
    { title: '会话来源', dataIndex: 'userFrom', width: 100 },
    {
      title: '开始时间',
      dataIndex: 'addTime',
      width: 170,
      render: (value: string) => <span>{value || '--'}</span>,
    },
    {
      title: '最后会话时间',
      dataIndex: 'lastUpdateTime',
      width: 170,
      render: (value: string) => <span>{value || '--'}</span>,
    },
    {
      title: '会话状态',
      dataIndex: 'status',
      width: 100,
      render: (value: number) =>
        Number(value) === 1 ? <Tag color="green">{t('会话中')}</Tag> : <Tag color="grey">{t('已结束')}</Tag>,
    },
    {
      title: '会话备注',
      dataIndex: 'remark',
      render: (value: string) => <span>{value || '--'}</span>,
    },
    {
      title: '操作',
      width: 100,
      render: (_value: unknown, row: ConsultHistoryRow) => (
        <Button theme="borderless" size="small" onClick={() => openDetail(row)}>
          {t('查看详情')}
        </Button>
      ),
    },
  ];

  const pad = (n: number) => String(n).padStart(2, '0');
  const fmtDate = (d?: Date) =>
    d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '';

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 12 }}>
        <Space wrap>
          <Select
            style={{ width: 150 }}
            value={filters.timeType}
            optionList={[
              { value: 1, label: t('会话开始时间') },
              { value: 3, label: t('最后会话时间') },
            ]}
            onChange={(next) => setFilters((current) => ({ ...current, timeType: Number(next) }))}
          />
          <Input
            style={{ width: 160 }}
            placeholder={t('客户姓名')}
            value={filters.username}
            showClear
            onClear={() => setFilters((c) => ({ ...c, username: '' }))}
            onChange={(next) => setFilters((c) => ({ ...c, username: next }))}
          />
          <Select
            style={{ width: 130 }}
            value={filters.userFrom}
            placeholder={t('会话来源')}
            showClear
            optionList={[
              { value: 'pc', label: 'pc' },
              { value: 'h5', label: 'h5' },
            ]}
            onChange={(next) => setFilters((c) => ({ ...c, userFrom: next == null ? '' : String(next) }))}
          />
          <Select
            style={{ width: 130 }}
            value={filters.status}
            placeholder={t('会话状态')}
            showClear
            optionList={[
              { value: '1', label: t('会话中') },
              { value: '2', label: t('已结束') },
            ]}
            onChange={(next) => setFilters((c) => ({ ...c, status: next == null ? '' : String(next) }))}
          />
          <Input
            style={{ width: 160 }}
            placeholder={t('会话备注')}
            value={filters.remark}
            showClear
            onClear={() => setFilters((c) => ({ ...c, remark: '' }))}
            onChange={(next) => setFilters((c) => ({ ...c, remark: next }))}
          />
          <Button
            theme="solid"
            type="primary"
            icon={<IconSearch />}
            onClick={() => {
              setPage(1);
              setApplied(filters);
            }}
          >
            {t('搜索')}
          </Button>
        </Space>
        <Space wrap style={{ marginTop: 8 }}>
          <Select
            style={{ width: 130 }}
            value={undefined}
            placeholder={t('时间快捷筛选')}
            showClear
            optionList={[
              { value: 'today', label: t('今天') },
              { value: 'yesterday', label: t('昨天') },
              { value: 'week', label: t('近7天') },
              { value: 'month', label: t('近30天') },
              { value: 'year', label: t('近1年') },
            ]}
            onChange={(next) => {
              if (!next) return;
              const now = new Date();
              const start = new Date(now);
              const end = new Date(now);
              end.setHours(23, 59, 59);
              if (next === 'yesterday') start.setDate(start.getDate() - 1);
              if (next === 'week') start.setDate(start.getDate() - 6);
              if (next === 'month') start.setDate(start.getDate() - 29);
              if (next === 'year') start.setFullYear(start.getFullYear() - 1);
              const nextFilters = {
                ...filters,
                startTime: next === 'today' || next === 'yesterday' ? fmtDate(start) : fmtDate(start),
                endTime: fmtDate(end),
              };
              setFilters(nextFilters);
              setPage(1);
              setApplied(nextFilters);
            }}
          />
        </Space>
      </div>
      <Table<ConsultHistoryRow>
        loading={loading}
        dataSource={rows}
        rowKey={(record?: ConsultHistoryRow, index?: number) => String(record?.id ?? index ?? 0)}
        pagination={{ currentPage: page, pageSize: 10, total, onChange: (next: number) => setPage(next) }}
        columns={columns as any}
      />

      <Modal
        title={t('会话详情')}
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={760}
      >
        <Spin spinning={detailLoading}>
          <div className="kefu-message-list" style={{ maxHeight: 480 }}>
            {detailMessages.map((msg) => {
              const mine = Number(msg.type) === 2;
              return (
                <div key={msg.id} className={`kefu-message-row ${mine ? 'is-mine' : ''}`}>
                  <Avatar src={mine ? msg.servant?.avatar : msg.user?.avatar} size="small" alt="">
                    {mine
                      ? (msg.servant?.username || '?').slice(0, 1)
                      : (msg.user?.nickname || msg.user?.username || '?').slice(0, 1)}
                  </Avatar>
                  <div className="kefu-message-bubble">
                    <MessageBubbleContent content={msg.content} />
                    <div className="kefu-message-time">{msg.sendTime || ''}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Spin>
      </Modal>
    </div>
  );
}
