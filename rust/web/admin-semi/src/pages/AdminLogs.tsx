import { useMemo, useState } from 'react';
import { Button, Modal, Space, Tag, Typography } from '@douyinfe/semi-ui';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';

const { Text } = Typography;

interface AdminLogRow {
  logId: number;
  username?: string;
  ipAddress?: string;
  logTime?: string;
  logInfo?: string;
  requestLog?: string;
}

export default function AdminLogs() {
  const { t } = useI18n();
  const [detail, setDetail] = useState<AdminLogRow | null>(null);
  const initialKeyword = useMemo(
    () => new URLSearchParams(window.location.search).get('keyword') || '',
    [],
  );
  const initialQuery = useMemo(
    () => (initialKeyword ? { keyword: initialKeyword } : undefined),
    [initialKeyword],
  );

  const columns: ColumnConfig<AdminLogRow>[] = [
    { title: '编号', dataIndex: 'logId', width: 100 },
    { title: '操作者', dataIndex: 'username', width: 160 },
    { title: 'IP地址', dataIndex: 'ipAddress', width: 170 },
    { title: '操作日期', dataIndex: 'logTime', width: 190 },
    {
      title: '操作记录',
      dataIndex: 'logInfo',
      render: (value: string) => (
        <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 460 }}>
          {value || '-'}
        </Text>
      ),
    },
  ];

  return (
    <div className="admin-log-page">
      <ListPage<AdminLogRow>
        api="/authority/adminLog/list"
        rowKey="logId"
        pageSize={10}
        actionWidth={110}
        query={initialQuery}
        filters={[
          {
            field: 'keyword',
            label: '操作日志',
            type: 'input',
            placeholder: '输入关键词或IP地址',
            width: 300,
          },
        ]}
        columns={columns}
        rowActions={(record) => (
          <Button
            theme="borderless"
            size="small"
            disabled={!record.requestLog}
            onClick={() => setDetail(record)}
          >
            {t('查看')}
          </Button>
        )}
      />

      <Modal
        title={t('操作详情')}
        visible={Boolean(detail)}
        onCancel={() => setDetail(null)}
        width={640}
        footer={
          <Space>
            <Button onClick={() => setDetail(null)}>{t('关闭')}</Button>
          </Space>
        }
      >
        <div className="admin-log-detail-head">
          <Tag color="blue">{detail?.username || 'admin'}</Tag>
          <Text type="tertiary">{detail?.logTime}</Text>
          <Text type="tertiary">{detail?.ipAddress}</Text>
        </div>
        <div style={{ marginBottom: 12 }}>{detail?.logInfo}</div>
        <pre className="admin-log-request">{detail?.requestLog}</pre>
      </Modal>
    </div>
  );
}
