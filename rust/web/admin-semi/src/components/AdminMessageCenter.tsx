import { useEffect, useState } from 'react';
import { Button, Empty, Modal, Spin, Tabs, TabPane, Tag, Typography } from '@douyinfe/semi-ui';
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
  onRead: () => void;
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

  const load = async (nextPage = page) => {
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
  };

  useEffect(() => {
    if (!visible) return;
    setCatId(-1);
    setMsgType(0);
    apiGet<AdminMsgType[]>('/msg/adminMsg/msgTypeArr')
      .then((result) => setTypes(Array.isArray(result) ? result : []))
      .catch(() => setTypes([]));
    void load(1);
  }, [visible]);

  useEffect(() => {
    if (visible) void load(1);
  }, [msgType]);

  const markAllRead = async () => {
    setMarking(true);
    try {
      await apiPost('/msg/adminMsg/setAllReaded', {});
      setRows((current) => current.map((item) => ({ ...item, isReaded: 1 })));
      onRead();
    } finally {
      setMarking(false);
    }
  };

  const markRead = async (msg: AdminMsg) => {
    if (msg.isReaded === 1) return;
    try {
      await apiPost('/msg/adminMsg/setReaded', { msgId: msg.msgId });
      setRows((current) => current.map((item) => (item.msgId === msg.msgId ? { ...item, isReaded: 1 } : item)));
      onRead();
    } catch {
      // ignore
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
          <TabPane tab={t('全部消息')} itemKey="-1" />
          {types.map((cat) => (
            <TabPane tab={`${cat.catName}${cat.unreadCount > 0 ? ` (${cat.unreadCount})` : ''}`} itemKey={String(cat.catId)} key={cat.catId} />
          ))}
        </Tabs>
        {catId > 0 && (
          <div className="admin-msg-subtypes">
            <Tag
              color={msgType === 0 ? 'blue' : 'grey'}
              onClick={() => setMsgType(0)}
              style={{ cursor: 'pointer' }}
            >
              {t('全部类型')}
            </Tag>
            {(types.find((cat) => cat.catId === catId)?.child || []).map((child) => (
              <Tag
                key={child.msgType}
                color={msgType === child.msgType ? 'blue' : 'grey'}
                onClick={() => setMsgType(child.msgType)}
                style={{ cursor: 'pointer' }}
              >
                {child.name}{child.unreadCount > 0 ? ` (${child.unreadCount})` : ''}
              </Tag>
            ))}
          </div>
        )}
      </div>
      <div className="admin-msg-toolbar">
        <Text type="tertiary">{t('共 {total} 条消息', { total })}</Text>
        <Button size="small" loading={marking} onClick={markAllRead}>{t('全部已读')}</Button>
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
              className={`admin-msg-item${item.isReaded === 1 ? ' is-readed' : ''}`}
              onClick={() => void markRead(item)}
            >
              <div className="admin-msg-item__head">
                <Tag color={item.isReaded === 1 ? 'grey' : 'blue'} size="small">{item.msgTypeName || t('消息')}</Tag>
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
