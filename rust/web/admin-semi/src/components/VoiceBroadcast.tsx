import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  SideSheet,
  Empty,
  Notification,
  Spin,
  Switch,
  Tabs,
  TabPane,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconSetting, IconVolume2 } from '@douyinfe/semi-icons';
import { apiGet } from '../api';
import { useI18n } from '../i18n';
import {
  VOICE_TYPES,
  activateVoice,
  isVoiceSupported,
  loadVoiceSettings,
  saveVoiceSettings,
  type VoiceMsgType,
  type VoiceSettings,
} from '../voice';

const { Text } = Typography;

interface BroadcastRecord {
  msgId: number;
  msgTypeName: string;
  sendTime: string;
  title: string;
  content: string;
  totalAmount?: string;
  refundAmount?: string;
}

export default function VoiceBroadcast() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<VoiceSettings>(loadVoiceSettings);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeType, setActiveType] = useState<VoiceMsgType>('newOrder');
  const [records, setRecords] = useState<BroadcastRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const pageSize = 10;
  const enabledTypes = VOICE_TYPES.filter((item) => settings[item.type]);
  const tabTypes = enabledTypes.length ? enabledTypes : VOICE_TYPES;
  const activeMeta = VOICE_TYPES.find((item) => item.type === activeType) || VOICE_TYPES[0];

  useEffect(() => {
    const handler = (event: Event) => {
      const type = (event as CustomEvent<VoiceMsgType>).detail;
      const meta = VOICE_TYPES.find((item) => item.type === type);
      if (!meta) return;
      Notification.info({
        title: t('语音播报'),
        content: t('{label}有新消息', { label: meta.label }),
        duration: 5,
        onClick: () => {
          setActiveType(type);
          setDrawerOpen(true);
        },
      });
    };
    window.addEventListener('admin-voice-popup', handler as EventListener);
    return () => window.removeEventListener('admin-voice-popup', handler as EventListener);
  }, [t]);

  const updateSettings = (patch: Partial<VoiceSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      saveVoiceSettings(next);
      return next;
    });
  };

  const loadRecords = async (nextPage = 1, reset = false) => {
    if (activeMeta.msgType === null) {
      setRecords([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      const result = await apiGet<{ records?: BroadcastRecord[]; total?: number }>('/msg/adminMsg/broadcastList', {
        page: nextPage,
        size: pageSize,
        msgType: activeMeta.msgType,
      });
      const list = result?.records || [];
      setRecords((current) => (reset ? list : [...current, ...list]));
      setTotal(Number(result?.total) || 0);
      setPage(nextPage);
    } catch {
      if (reset) {
        setRecords([]);
        setTotal(0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (drawerOpen) void loadRecords(1, true);
  }, [drawerOpen, activeType]);

  const enableVoice = async () => {
    if (!isVoiceSupported()) {
      Toast.warning(t('当前浏览器不支持语音播报'));
      return;
    }
    const ok = await activateVoice();
    if (ok) {
      updateSettings({ activated: true });
      Toast.success(t('语音播报已开启'));
    }
  };

  return (
    <>
      <Button
        icon={<IconVolume2 />}
        theme="borderless"
        className="icon-btn"
        title={t('播报')}
        onClick={() => setDrawerOpen(true)}
      >
        <span className="topbar-text-btn">{t('播报')}</span>
      </Button>

      <SideSheet
        title={t('语音播报内容')}
        visible={drawerOpen}
        onCancel={() => setDrawerOpen(false)}
        width={600}
        footer={null}
      >
        <div className="voice-record-head">
          <Text type="tertiary">{t('开启后，新订单、售后等重要消息将自动语音提醒')}</Text>
          <Button icon={<IconSetting />} theme="borderless" size="small" onClick={() => setSettingsOpen(true)}>
            {t('语音播报设置')}
          </Button>
        </div>
        <Tabs type="line" activeKey={activeType} onChange={(key) => setActiveType(key as VoiceMsgType)}>
          {tabTypes.map((item) => (
            <TabPane tab={item.label} itemKey={item.type} key={item.type} />
          ))}
        </Tabs>
        <div className="voice-record-list">
          {loading && records.length === 0 ? (
            <div className="voice-record-state"><Spin /></div>
          ) : records.length === 0 ? (
            <Empty
              description={activeMeta.msgType === null ? t('客服消息记录暂未接入') : t('当前暂无播报记录')}
              style={{ padding: 40 }}
            />
          ) : (
            records.map((item) => (
              <div className="voice-record-item" key={item.msgId}>
                <div className="voice-record-item__head">
                  <Tag color="blue" size="small">{item.msgTypeName || activeMeta.label}</Tag>
                  <span className="voice-record-item__title">{item.title}</span>
                  <span className="voice-record-item__time">{item.sendTime}</span>
                </div>
                <div className="voice-record-item__content">{item.content}</div>
                {item.totalAmount ? (
                  <div className="voice-record-item__amount">
                    {t('订单金额')}：¥{item.totalAmount}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
        {records.length < total && (
          <div className="voice-record-more">
            <Button loading={loading} onClick={() => void loadRecords(page + 1)}>{t('加载更多')}</Button>
          </div>
        )}
      </SideSheet>

      <SideSheet
        title={t('语音播报设置')}
        visible={settingsOpen}
        onCancel={() => setSettingsOpen(false)}
        width={480}
        placement="right"
        footer={null}
      >
        {!isVoiceSupported() && (
          <div className="voice-tip">{t('当前浏览器不支持语音播报，请使用 Chrome / Edge 并允许声音播放')}</div>
        )}
        {!settings.activated && (
          <div className="voice-tip">
            <span>{t('尚未激活浏览器语音权限，播报暂不会发声')}</span>
            <Button size="small" theme="solid" type="primary" onClick={() => void enableVoice()}>
              {t('立即开启')}
            </Button>
          </div>
        )}
        <div className="voice-setting-list">
          {VOICE_TYPES.map((item) => (
            <div className="voice-setting-row" key={item.type}>
              <span>{t('{label}语音播报', { label: item.label })}</span>
              <Switch
                checked={settings[item.type]}
                onChange={(checked) => updateSettings({ [item.type]: checked } as Partial<VoiceSettings>)}
              />
            </div>
          ))}
          <div className="voice-setting-row">
            <span>{t('播报时弹出消息通知')}</span>
            <Switch checked={settings.popupEnabled} onChange={(checked) => updateSettings({ popupEnabled: checked })} />
          </div>
        </div>
      </SideSheet>
    </>
  );
}
