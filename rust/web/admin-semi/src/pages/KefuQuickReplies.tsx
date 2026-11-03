import { useEffect, useState } from 'react';
import { Button, Card, Checkbox, Radio, RadioGroup, Tabs, TextArea, Toast, Typography } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';

const { Text } = Typography;

interface GreetingState {
  activate: boolean;
  sendText: boolean;
  replyContent: string;
}

const GREETING_TABS = [
  { code: 'welcome', label: '客服首句欢迎语', defaultContent: '你好，欢迎光临！' },
  { code: 'queue', label: '客服忙提醒语', defaultContent: '客服繁忙，请稍候' },
  { code: 'end', label: '客服离线提醒语', defaultContent: '客服当前不在线' },
];

/** 客服快捷回复（欢迎语）：对应旧版 im/AutoReply.vue + src/FirstGreeting|QueueGreeting|EndGreeting.vue，接口 /im/config/config/*。 */
export default function KefuQuickReplies() {
  const { t } = useI18n();
  const [activeCode, setActiveCode] = useState('welcome');
  const [states, setStates] = useState<Record<string, GreetingState>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadTab = async (code: string) => {
    setLoading(true);
    try {
      const result = await apiGet<any>('/im/config/config/detail', { code });
      setStates((current) => ({
        ...current,
        [code]: {
          activate: Boolean(result?.activate ?? true),
          sendText: Boolean(result?.sendText ?? true),
          replyContent: String(result?.replyContent ?? GREETING_TABS.find((tab) => tab.code === code)?.defaultContent ?? ''),
        },
      }));
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载失败') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTab(activeCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCode]);

  const save = async () => {
    const current = states[activeCode] || { activate: true, sendText: true, replyContent: '' };
    setSaving(true);
    try {
      await apiPost('/im/config/config/save', {
        code: activeCode,
        data: {
          activate: current.activate,
          sendText: current.sendText,
          replyContent: current.replyContent,
        },
      });
      Toast.success({ content: t('修改成功') });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  const current = states[activeCode] || { activate: true, sendText: true, replyContent: '' };
  const update = (patch: Partial<GreetingState>) =>
    setStates((c) => ({ ...c, [activeCode]: { ...current, ...patch } }));

  return (
    <Card shadows="hover">
      <Tabs
        type="line"
        activeKey={activeCode}
        onChange={(key) => setActiveCode(String(key))}
        tabList={GREETING_TABS.map((tab) => ({ tab: t(tab.label), itemKey: tab.code }))}
      />
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Text strong>{t('启用')}</Text>
          <Checkbox
            checked={current.activate}
            onChange={(event) => update({ activate: event.target.checked })}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Text strong>{t('文字开关')}</Text>
          <Checkbox
            checked={current.sendText}
            onChange={(event) => update({ sendText: event.target.checked })}
          />
          <Text type="tertiary" size="small">
            {t('开启后消息以文字形式发送')}
          </Text>
        </div>
        <RadioGroup value={1}>
          <Radio value={1}>{t('快捷回复内容')}</Radio>
        </RadioGroup>
        <TextArea
          value={current.replyContent}
          onChange={(next) => update({ replyContent: next })}
          autosize={{ minRows: 5, maxRows: 10 }}
          placeholder={t('请输入回复内容')}
        />
        <div>
          <Button theme="solid" type="primary" loading={saving} onClick={save}>
            {t('保存')}
          </Button>
        </div>
      </div>
    </Card>
  );
}
