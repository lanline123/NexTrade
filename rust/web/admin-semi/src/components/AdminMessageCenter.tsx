import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Empty, Modal, Spin, Tabs, TabPane, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';

const { Text } = Typography;

interface AdminMsg {
  msgId: number;
  msgType: number;
  msgTypeName: string;
  sendTime: string;
  isReaded: number;
  title: string;
  content: string;
  msgLink?: string | null;
}

interface AdminMsgTypeChild {
  msgType: number;
  name: string;
  unreadCount: number;
}

interface AdminMsgType {
  catId: number;
  catName: string;
  unreadCount: number;
  child: AdminMsgTypeChild[];
}

interface AdminMessageCenterProps {
  visible: boolean;
  onClose: () => void;
  /**
   * 已读动作回调。
   * @param unread 已读后剩余的未读总数；传入时顶部角标立即更新，不必等接口往返。
   */
  onRead: (unread?: number) => void;
}

/** 未读数角标（对齐跨境版 AdminMsg.vue 的 tab .num：红底白字胶囊） */
function UnreadPill({ count }: { count: number }) {
  const value = Number(count) || 0;
  if (value <= 0) return null;
  return <em className="admin-msg-num">{value > 99 ? '99+' : value}</em>;
}

export default function AdminMessageCenter({ visible, onClose, onRead }: AdminMessageCenterProps) {
  const { t } = useI18n();
  const [rows, setRows] = useState<AdminMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [types, setTypes] = useState<AdminMsgType[]>([]);
  const [catId, setCatId] = useState(-1);
  const [msgType, setMsgType] = useState(0);
  const pageSize = 15;

  /** 拉取分类树（含各分类 Tab 与子类型的未读数） */
  const loadTypes = useCallback(async () => {
    try {
      const result = await apiGet<AdminMsgType[]>('/msg/adminMsg/msgTypeArr');
      setTypes(Array.isArray(result) ? result : []);
    } catch {
      setTypes([]);
    }
  }, []);

  const load = useCallback(
    async (nextPage: number) => {
      setLoading(true);
      try {
        const result = await apiGet<{ records?: AdminMsg[]; total?: number }>('/msg/adminMsg/list', {
          page: nextPage,
          size: pageSize,
          ...(msgType > 0 ? { msgType } : {}),
        });
        const list = result?.records || [];
        setRows((current) => (nextPage === 1 ? list : [...current, ...list]));
        setTotal(Number(result?.total) || 0);
        setPage(nextPage);
      } catch {
        if (nextPage === 1) setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [msgType],
  );

  useEffect(() => {
    if (!visible) return;
    setCatId(-1);
    setMsgType(0);
    void loadTypes();
    void load(1);
    // 每次打开都以服务端未读数为准，避免沿用上次的旧角标
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (visible) void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgType]);

  /**
   * 本地先把该条消息对应的分类/子类型未读数扣掉，
   * 让 Tab 角标在点击瞬间就变化，不必等接口往返。
   */
  const applyLocalRead = useCallback((msg: AdminMsg) => {
    setRows((current) => current.map((item) => (item.msgId === msg.msgId ? { ...item, isReaded: 1 } : item)));
    setTypes((current) =>
      current.map((cat) => {
        const hit = (cat.child || []).some((child) => child.msgType === msg.msgType);
        if (!hit) return cat;
        return {
          ...cat,
          unreadCount: Math.max(0, (cat.unreadCount || 0) - 1),
          child: (cat.child || []).map((child) =>
            child.msgType === msg.msgType
              ? { ...child, unreadCount: Math.max(0, (child.unreadCount || 0) - 1) }
              : child,
          ),
        };
      }),
    );
  }, []);

  const currentCat = useMemo(() => types.find((cat) => cat.catId === catId), [types, catId]);
  const totalUnread = useMemo(
    () => types.reduce((sum, cat) => sum + (Number(cat.unreadCount) || 0), 0),
    [types],
  );

  /** 全部已读：本地角标先清零，再与服务端对齐 */
  const markAllRead = async () => {
    setMarking(true);
    try {
      await apiPost('/msg/adminMsg/setAllReaded', {});
      setRows((current) => current.map((item) => ({ ...item, isReaded: 1 })));
      setTypes((current) =>
        current.map((cat) => ({
          ...cat,
          unreadCount: 0,
          child: (cat.child || []).map((child) => ({ ...child, unreadCount: 0 })),
        })),
      );
      // 立刻归零，随后再按服务端真实值对齐（并发新消息时两者可能不同）
      onRead(0);
      onRead();
      void loadTypes();
      void load(1);
    } catch (error) {
      Toast.error((error as Error)?.message || t('操作失败'));
    } finally {
      setMarking(false);
    }
  };

  /** 单条已读：分类 Tab / 子类型角标与顶部角标都在点击瞬间更新 */
  const markRead = async (msg: AdminMsg) => {
    if (msg.isReaded === 1) return;
    applyLocalRead(msg);
    // 点击瞬间更新顶部角标（此时服务端尚未改完，不能立刻去拉接口，否则会被旧值顶回去）
    onRead(Math.max(0, totalUnread - 1));
    try {
      await apiPost('/msg/adminMsg/setReaded', { msgId: msg.msgId });
      // 已读成功后再按服务端真实值对齐
      onRead();
      void loadTypes();
    } catch {
      // 失败回滚：重拉分类树与列表，回到服务端真实状态
      void loadTypes();
      void load(1);
      onRead();
    }
  };

  return (
    <Modal
      title={t('消息中心')}
      visible={visible}
      onCancel={onClose}
      footer={null}
      width={880}
      bodyStyle={{ padding: 0 }}
    >
      <div className="admin-msg-types">
        <Tabs
          type="line"
          activeKey={String(catId)}
          onChange={(key) => {
            const nextCat = Number(key);
            setCatId(nextCat);
            const firstChild = types.find((cat) => cat.catId === nextCat)?.child?.[0]?.msgType;
            setMsgType(nextCat > 0 && firstChild ? firstChild : 0);
          }}
        >
          <TabPane
            tab={
              <span className="admin-msg-tab">
                <span>{t('全部消息')}</span>
                <UnreadPill count={totalUnread} />
              </span>
            }
            itemKey="-1"
          />
          {types.map((cat) => (
            <TabPane
              tab={
                <span className="admin-msg-tab">
                  <span>{cat.catName}</span>
                  <UnreadPill count={cat.unreadCount} />
                </span>
              }
              itemKey={String(cat.catId)}
              key={cat.catId}
            />
          ))}
        </Tabs>
        {catId > 0 && (
          <div className="admin-msg-subtypes">
            <Tag
              color={msgType === 0 ? 'blue' : 'grey'}
              onClick={() => setMsgType(0)}
              style={{ cursor: 'pointer' }}
            >
              <span className="admin-msg-tab">
                <span>{t('全部类型')}</span>
                <UnreadPill count={currentCat?.unreadCount || 0} />
              </span>
            </Tag>
            {(currentCat?.child || []).map((child) => (
              <Tag
                key={child.msgType}
                color={msgType === child.msgType ? 'blue' : 'grey'}
                onClick={() => setMsgType(child.msgType)}
                style={{ cursor: 'pointer' }}
              >
                <span className="admin-msg-tab">
                  <span>{child.name}</span>
                  <UnreadPill count={child.unreadCount} />
                </span>
              </Tag>
            ))}
          </div>
        )}
      </div>
      <div className="admin-msg-toolbar">
        <Text type="tertiary">{t('共 {total} 条消息', { total })}</Text>
        <Button size="small" loading={marking} disabled={totalUnread === 0} onClick={markAllRead}>
          {t('全部已读')}
        </Button>
      </div>
      <div className="admin-msg-list">
        {loading && rows.length === 0 ? (
          <div className="admin-msg-state"><Spin /></div>
        ) : rows.length === 0 ? (
          <Empty description={t('当前暂无消息哟')} style={{ padding: 40 }} />
        ) : (
          rows.map((item) => (
            <button
              type="button"
              key={item.msgId}
              className={`admin-msg-item${item.isReaded === 1 ? ' is-readed' : ' is-unread'}`}
              onClick={() => void markRead(item)}
            >
              <div className="admin-msg-item__head">
                <span className="admin-msg-item__dot" />
                <Tag color={item.isReaded === 1 ? 'grey' : 'blue'} size="small">
                  {item.msgTypeName || t('消息')}
                </Tag>
                <span className="admin-msg-item__title">{item.title}</span>
                <span className="admin-msg-item__time">{item.sendTime}</span>
              </div>
              <div className="admin-msg-item__content">{item.content}</div>
            </button>
          ))
        )}
      </div>
      {rows.length < total && (
        <div className="admin-msg-more">
          <Button loading={loading} onClick={() => void load(page + 1)}>{t('加载更多')}</Button>
        </div>
      )}
    </Modal>
  );
}
