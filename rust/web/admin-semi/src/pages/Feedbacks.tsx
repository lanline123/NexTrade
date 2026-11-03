import { useState } from 'react';
import { Button, Modal, Space, TextArea, Toast, Typography } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import OrderDetailModal from '../components/OrderDetailModal';
import type { ColumnConfig } from '../framework/types';

const { Text } = Typography;

interface FeedbackRow {
  id: number;
  username?: string;
  typeName?: string;
  orderSn?: string;
  orderId?: number;
  shopTitle?: string;
  productName?: string;
  content?: string;
  addTime?: string;
  reply?: { content?: string };
}

/** 会员留言：对应旧版 user/feedback/List.vue + Info.vue。 */
export default function Feedbacks() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [replyTarget, setReplyTarget] = useState<FeedbackRow | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replySaving, setReplySaving] = useState(false);
  const [orderDetailId, setOrderDetailId] = useState<number | undefined>();
  const [orderDetailOpen, setOrderDetailOpen] = useState(false);

  const reload = () => setReloadKey((key) => key + 1);

  const openReply = async (row: FeedbackRow) => {
    setReplyContent('');
    setReplyTarget(row);
    try {
      const detail = await apiGet<any>('/user/feedback/detail', { id: row.id });
      setReplyTarget({ ...row, ...(detail || {}) });
    } catch {
      // 行数据兜底
    }
  };

  const submitReply = async () => {
    if (!replyTarget) return;
    if (!replyContent.trim()) {
      Toast.error({ content: t('回复内容不能为空') });
      return;
    }
    setReplySaving(true);
    try {
      await apiPost('/user/feedback/update', {
        id: replyTarget.id,
        parentId: 0,
        content: replyContent,
      });
      Toast.success({ content: t('回复成功') });
      setReplyTarget(null);
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('回复失败') });
    } finally {
      setReplySaving(false);
    }
  };

  const deleteFeedback = (row: FeedbackRow) => {
    Modal.confirm({
      title: t('确认删除该留言吗？'),
      onOk: async () => {
        try {
          await apiPost('/user/feedback/del', { id: row.id });
          Toast.success({ content: t('删除成功') });
          reload();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
        }
      },
    });
  };

  const columns: ColumnConfig<FeedbackRow>[] = [
    {
      title: '会员名称',
      dataIndex: 'username',
      width: 120,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      title: '类型',
      dataIndex: 'typeName',
      width: 220,
      render: (_: unknown, row: FeedbackRow) => (
        <div>
          <div>{row.typeName || '-'}</div>
          {row.orderSn ? (
            <a
              onClick={() => {
                setOrderDetailId(row.orderId);
                setOrderDetailOpen(true);
              }}
            >
              {row.orderSn}
            </a>
          ) : null}
          {row.shopTitle ? <Text type="tertiary" size="small">{row.shopTitle}</Text> : null}
          {Number(row.productName ? 1 : 0) > 0 && row.productName ? (
            <Text type="tertiary" size="small">
              {row.productName}
            </Text>
          ) : null}
        </div>
      ),
    },
    {
      title: '留言内容',
      dataIndex: 'content',
      width: 220,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    { title: '留言时间', dataIndex: 'addTime', width: 160 },
    {
      // 旧版列 prop 为 "reply.content"（嵌套取回复内容）
      title: '回复',
      dataIndex: 'reply',
      render: (_: unknown, row: FeedbackRow) => <span>{row.reply?.content || '-'}</span>,
    },
  ];

  return (
    <>
      <ListPage<FeedbackRow>
        key={reloadKey}
        api="/user/feedback/list"
        rowKey="id"
        pageSize={10}
        actionWidth={150}
        columns={columns}
        rowActions={(row) => (
          <Space spacing={2}>
            <Button theme="borderless" size="small" onClick={() => openReply(row)}>
              {t('回复')}
            </Button>
            <Button theme="borderless" type="danger" size="small" onClick={() => deleteFeedback(row)}>
              {t('删除')}
            </Button>
          </Space>
        )}
      />

      <Modal
        title={t('回复留言')}
        visible={Boolean(replyTarget)}
        confirmLoading={replySaving}
        onOk={submitReply}
        onCancel={() => setReplyTarget(null)}
      >
        {replyTarget ? (
          <div className="feedback-form">
            <Text strong>{replyTarget.typeName || '-'}</Text>
            <div>
              <Text type="tertiary">{t('留言内容：')}</Text>
              <span>{replyTarget.content || '-'}</span>
            </div>
            <Text strong>{t('回复内容')}</Text>
            <TextArea
              value={replyContent}
              onChange={setReplyContent}
              placeholder={t('请输入回复内容')}
              autosize={{ minRows: 4, maxRows: 8 }}
            />
          </div>
        ) : null}
      </Modal>

      <OrderDetailModal
        visible={orderDetailOpen}
        orderId={orderDetailId}
        onCancel={() => setOrderDetailOpen(false)}
        onChanged={reload}
      />
    </>
  );
}
