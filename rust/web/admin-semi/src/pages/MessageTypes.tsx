import { useState } from 'react';
import {
  Button,
  Card,
  Input,
  Modal,
  Radio,
  RadioGroup,
  Space,
  Switch,
  TabPane,
  Tabs,
  TextArea,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';

const { Text } = Typography;

interface MessageTypeRow {
  messageId: number;
  name: string;
  describe?: string;
  sendType?: number;
  isMail?: number;
  isDing?: number;
  isWxWork?: number;
  isMessage?: number;
  isMsg?: number;
  isWechat?: number;
  isMiniProgram?: number;
  isApp?: number;
}

type TemplateData = {
  id?: number;
  messageId?: number;
  type?: number;
  content?: string;
  contentOversea?: string;
  toUserid?: string;
  templateId?: string;
  templateNum?: string;
  templateName?: string;
};

/** templateMessage 的 key 与 Rust MessageTemplateKind::key() / 旧版一致。 */
const CHANNELS: Array<{ key: string; label: string; flag: keyof MessageTypeRow; type: number }> = [
  { key: 'messageData', label: '站内信', flag: 'isMessage', type: 4 },
  { key: 'msgData', label: '短信', flag: 'isMsg', type: 3 },
  { key: 'wechatData', label: '公众号', flag: 'isWechat', type: 1 },
  { key: 'miniProgramData', label: '小程序', flag: 'isMiniProgram', type: 2 },
  { key: 'appData', label: 'APP 推送', flag: 'isApp', type: 5 },
  { key: 'emailData', label: '邮件', flag: 'isMail', type: 7 },
  { key: 'dingData', label: '钉钉', flag: 'isDing', type: 6 },
  { key: 'wxWorkData', label: '企业微信', flag: 'isWxWork', type: 8 },
];

const emptyDetail = (row: MessageTypeRow): Record<string, any> => ({
  messageId: row.messageId,
  name: row.name || '',
  describe: row.describe || '',
  sendType: row.sendType,
  isMail: row.isMail,
  isDing: row.isDing,
  isWxWork: row.isWxWork,
  isMessage: row.isMessage,
  isMsg: row.isMsg,
  isWechat: row.isWechat,
  isMiniProgram: row.isMiniProgram,
  isApp: row.isApp,
  templateMessage: Object.fromEntries(
    CHANNELS.map((channel) => [
      channel.key,
      { messageId: row.messageId, type: channel.type },
    ]),
  ),
});

export function MessageTypes() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [sendType, setSendType] = useState<number>(1);
  const [editVisible, setEditVisible] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editingRow, setEditingRow] = useState<MessageTypeRow | null>(null);
  const [detail, setDetail] = useState<Record<string, any> | null>(null);
  const [channel, setChannel] = useState('messageData');

  const handleUpdateField = async (id: number, field: string, val: unknown) => {
    try {
      await apiPost('/setting/messageType/updateField', { id, field, val });
      Toast.success({ content: t('修改成功') });
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('修改失败') });
    }
  };

  const handleGenerateMiniProgram = async () => {
    try {
      await apiPost('/setting/messageType/miniProgramMessageTemplate', {});
      Toast.success({ content: t('生成小程序消息模板成功') });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    }
  };

  const handleGenerateWechat = async () => {
    try {
      await apiPost('/setting/messageType/wechatMessageTemplate', {});
      Toast.success({ content: t('生成公众号模板消息成功') });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    }
  };

  const openEdit = async (row: MessageTypeRow) => {
    setEditingRow(row);
    setChannel('messageData');
    setDetail(emptyDetail(row));
    setEditVisible(true);
    setEditLoading(true);
    try {
      const result = await apiGet<Record<string, any>>('/setting/messageType/detail', {
        id: row.messageId,
      });
      if (result) {
        setDetail({
          ...emptyDetail(row),
          ...result,
          templateMessage: {
            ...emptyDetail(row).templateMessage,
            ...(result.templateMessage || {}),
          },
        });
      }
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('详情加载失败') });
    } finally {
      setEditLoading(false);
    }
  };

  const patchDetail = (key: string, value: unknown) =>
    setDetail((current) => (current ? { ...current, [key]: value } : current));

  const patchTemplate = (field: keyof TemplateData, value: string) =>
    setDetail((current) => {
      if (!current) return current;
      const templates = { ...(current.templateMessage || {}) };
      templates[channel] = { ...(templates[channel] || {}), [field]: value };
      return { ...current, templateMessage: templates };
    });

  const handleEditSubmit = async () => {
    if (!detail) return;
    setEditLoading(true);
    try {
      await apiPost('/setting/messageType/update', detail);
      Toast.success({ content: t('保存成功') });
      setEditVisible(false);
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setEditLoading(false);
    }
  };

  const switchColumn = (field: string, title: string): ColumnConfig => ({
    title,
    dataIndex: field,
    width: 100,
    render: (v: unknown, row: unknown) => {
      const record = row as MessageTypeRow;
      if (Number(v) < 0) return <span>-</span>;
      return (
        <Switch
          checked={Number(v) === 1}
          onChange={(checked) => handleUpdateField(record.messageId, field, checked ? 1 : 0)}
        />
      );
    },
  });

  const columns: ColumnConfig[] = [
    {
      title: '消息类型',
      dataIndex: 'name',
      width: 200,
      render: (v: unknown) => <Text strong>{String(v || '--')}</Text>,
    },
    {
      title: '消息描述',
      dataIndex: 'describe',
      width: 260,
      render: (v: unknown) => <span>{String(v || '--')}</span>,
    },
    ...(sendType === 1
      ? [
          switchColumn('isMail', '邮件'),
          switchColumn('isMessage', '消息'),
          switchColumn('isMsg', '短信'),
          switchColumn('isWechat', '公众号'),
          switchColumn('isMiniProgram', '小程序'),
          switchColumn('isApp', 'APP'),
        ]
      : [
          switchColumn('isDing', '钉钉'),
          switchColumn('isWxWork', '企业微信'),
          switchColumn('isMsg', '短信'),
        ]),
    {
      title: '操作',
      dataIndex: 'action',
      width: 100,
      render: (_: unknown, row: unknown) => {
        const record = row as MessageTypeRow;
        return (
          <Button
            theme="borderless"
            type="primary"
            size="small"
            onClick={() => void openEdit(record)}
          >
            {t('编辑')}
          </Button>
        );
      },
    },
  ];

  const activeChannel = CHANNELS.find((item) => item.key === channel) || CHANNELS[0];
  const template: TemplateData = detail?.templateMessage?.[channel] || {};

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
          <Text strong>{t('模板行业选择')}</Text>
          <Text type="tertiary">{t('主营行业：根据您的主营行业选择适合的服务类目')}</Text>
          <Text type="tertiary">{t('副营行业：商业服务 -> 软件/建站/技术开发')}</Text>
          <Text strong style={{ marginTop: 6 }}>{t('生成小程序消息模板 / 生成公众号模板消息')}</Text>
          <Text type="tertiary">{t('请先添加服务类目《商业服务->软件/建站/技术开发》，否则模板导入不成功！')}</Text>
        </div>
      </Card>

      <Tabs
        activeKey={String(sendType)}
        onChange={(k) => setSendType(Number(k))}
        style={{ marginBottom: 16 }}
      >
        <TabPane tab={t('发送给用户')} itemKey="1" />
        <TabPane tab={t('发送给商家')} itemKey="2" />
      </Tabs>

      <ListPage
        key={`${sendType}-${reloadKey}`}
        api="/setting/messageType/list"
        query={{ sendType }}
        rowKey="messageId"
        columns={columns}
        toolbarExtra={
          <Space>
            <Button onClick={handleGenerateMiniProgram}>{t('生成小程序消息模板')}</Button>
            <Button onClick={handleGenerateWechat}>{t('生成公众号模板消息')}</Button>
          </Space>
        }
        filters={[
          {
            field: 'keyword',
            label: '关键字',
            type: 'input',
            placeholder: '输入关键字',
          },
        ]}
      />

      <Modal
        title={editingRow ? t('{name} 消息编辑', { name: editingRow.name }) : t('消息编辑')}
        visible={editVisible}
        onCancel={() => setEditVisible(false)}
        onOk={() => void handleEditSubmit()}
        confirmLoading={editLoading}
        width={760}
        okText={t('确定')}
        cancelText={t('取消')}
      >
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('消息类型')}</div>
                <Input value={detail.name || ''} onChange={(val) => patchDetail('name', String(val))} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('消息描述')}</div>
                <Input value={detail.describe || ''} disabled />
              </div>
            </div>

            <Tabs activeKey={channel} onChange={(key) => setChannel(String(key))} type="button">
              {CHANNELS.map((item) => (
                <TabPane key={item.key} tab={t(item.label)} itemKey={item.key} />
              ))}
            </Tabs>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('通知标题')}</div>
                <Input
                  value={template.templateName || ''}
                  placeholder={t('请输入通知标题')}
                  onChange={(val) => patchTemplate('templateName', String(val))}
                />
              </div>
              <div>
                <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('模板ID')}</div>
                <Input
                  value={template.templateId || ''}
                  placeholder={t('请填写服务商平台上的模板 ID')}
                  onChange={(val) => patchTemplate('templateId', String(val))}
                />
              </div>
              <div>
                <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('通知内容')}</div>
                <TextArea
                  value={template.content || ''}
                  rows={5}
                  placeholder={t('请输入模板内容，可使用 {orderSn} 等变量')}
                  onChange={(val) => patchTemplate('content', String(val))}
                />
              </div>
              {channel === 'msgData' && (
                <div>
                  <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('海外短信内容')}</div>
                  <TextArea
                    value={template.contentOversea || ''}
                    rows={3}
                    placeholder={t('国际/港澳台短信按明文发送，请在此填写海外短信文案')}
                    onChange={(val) => patchTemplate('contentOversea', String(val))}
                  />
                </div>
              )}
              <div>
                <div style={{ marginBottom: 6, fontWeight: 500 }}>
                  {t('{label} 是否开启', { label: t(activeChannel.label) })}
                </div>
                <RadioGroup
                  value={Number(detail[activeChannel.flag] ?? 0)}
                  onChange={(e) => patchDetail(activeChannel.flag as string, Number(e.target.value))}
                >
                  <Radio value={1}>{t('是')}</Radio>
                  <Radio value={0}>{t('否')}</Radio>
                </RadioGroup>
              </div>
              {detail.smsProvider != null && (
                <Text type="tertiary" size="small">
                  {t('当前短信服务商')}：{['阿里云', '腾讯云', '华为云', '火山引擎'][Number(detail.smsProvider) - 1] || detail.smsProvider}
                </Text>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
