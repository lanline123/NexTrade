import { useState } from 'react';
import { Button, Input, Modal, Space, TextArea, Toast } from '@douyinfe/semi-ui';
import { apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';

interface MessageLogRow {
  messageLogId: number;
  messageTitle?: string;
  messageContent?: string;
  messageLink?: string;
  sendTypeName?: string;
  messageType?: number;
  statusName?: string;
  sendTime?: string;
  isRecall?: number;
}

/** 站内信：对应旧版 user/messageLog/List.vue + Info.vue。 */
export default function MessageLogs() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);

  const reload = () => setReloadKey((key) => key + 1);

  const recallMessage = (row: MessageLogRow) => {
    Modal.confirm({
      title: t('确认要撤回该条消息吗？'),
      onOk: async () => {
        try {
          await apiPost('/user/userMessageLog/recall', { id: row.messageLogId });
          Toast.success({ content: t('撤回成功') });
          reload();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('撤回失败') });
        }
      },
    });
  };

  const deleteMessage = (row: MessageLogRow) => {
    Modal.confirm({
      title: t('确认删除该条消息吗？'),
      onOk: async () => {
        try {
          await apiPost('/user/userMessageLog/del', { id: row.messageLogId });
          Toast.success({ content: t('删除成功') });
          reload();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
        }
      },
    });
  };

  const columns: ColumnConfig<MessageLogRow>[] = [
    {
      title: '标题',
      dataIndex: 'messageTitle',
      width: 180,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      title: '内容',
      dataIndex: 'messageContent',
      width: 240,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      title: 'h5链接',
      dataIndex: 'messageLink',
      width: 150,
      render: (value: string) =>
        value ? (
          <a href={value} target="_blank" rel="noreferrer">
            {value}
          </a>
        ) : null,
    },
    {
      title: 'pc链接',
      dataIndex: 'messageLink',
      width: 150,
      render: (value: string) =>
        value ? (
          <a href={value} target="_blank" rel="noreferrer">
            {value}
          </a>
        ) : null,
    },
    {
      title: '发送类型',
      dataIndex: 'sendTypeName',
      width: 100,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      title: '发送状态',
      dataIndex: 'messageType',
      width: 100,
      render: (value: number, row: MessageLogRow) => (
        <span style={{ color: Number(value) === 0 ? 'var(--semi-color-success)' : 'var(--semi-color-danger)' }}>
          {row.statusName || '-'}
        </span>
      ),
    },
    { title: '发送日期', dataIndex: 'sendTime', width: 160 },
  ];

  return (
    <ListPage<MessageLogRow>
      key={reloadKey}
      api="/user/userMessageLog/list"
      rowKey="messageLogId"
      pageSize={10}
      selectable
      actionWidth={150}
      columns={columns}
      batchActions={(rows, clear) => (
        <Button
          size="small"
          onClick={() => {
            Modal.confirm({
              title: t('您确认要批量撤回所选数据吗？'),
              onOk: async () => {
                try {
                  await apiPost('/user/userMessageLog/batch', {
                    ids: rows.map((row) => row.messageLogId),
                    type: 'recall',
                  });
                  Toast.success({ content: t('批量撤回成功') });
                  clear();
                  reload();
                } catch (error) {
                  Toast.error({ content: error instanceof Error ? error.message : t('批量撤回失败') });
                }
              },
            });
          }}
        >
          {t('批量撤回')}
        </Button>
      )}
      rowActions={(row) => (
        <Space spacing={2}>
          {Number(row.isRecall ?? 0) === 0 ? (
            <Button theme="borderless" type="danger" size="small" onClick={() => recallMessage(row)}>
              {t('撤回')}
            </Button>
          ) : null}
          <Button theme="borderless" type="danger" size="small" onClick={() => deleteMessage(row)}>
            {t('删除')}
          </Button>
        </Space>
      )}
      drawer={{
        title: '发送站内信',
        addText: '发送站内信',
        width: 600,
        labelWidth: 110,
        createApi: '/user/userMessageLog/create',
        sections: [
          {
            key: 'basic',
            title: '消息信息',
            fields: [
              { field: 'messageTitle', label: t('标题'), type: 'input', required: true },
              { field: 'messageContent', label: t('内容'), type: 'textarea', required: true },
              {
                field: 'messageLink',
                label: t('链接'),
                type: 'input',
                placeholder: t('请输入跳转链接（可选）'),
                extraText: t('发送会员：默认发送给全部会员（人群圈选组件待迁移）'),
              },
            ],
          },
        ],
        toPayload: (values) => {
          if (!String(values.messageTitle || '').trim()) throw new Error(t('标题不能为空!'));
          if (!String(values.messageContent || '').trim()) throw new Error(t('内容不能为空!'));
          return { ...values, sendUserTarget: { rangeType: 0 } };
        },
      }}
    />
  );
}
