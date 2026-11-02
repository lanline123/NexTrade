import { useEffect, useState } from 'react';
import { Button, Empty, Modal, Spin, Tag, Typography } from '@douyinfe/semi-ui';
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
  const pageSize = 15;

  const load = async (nextPage = page) => {
    setLoading(true);
    try {
      const result = await apiGet<{ records?: AdminMsg[]; total?: number }>('/msg/adminMsg/list', {
        page: nextPage,
        size: pageSize,
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
    if (visible) void load(1);
  }, [visible]);

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
