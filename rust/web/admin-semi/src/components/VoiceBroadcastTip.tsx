import { useEffect, useState } from 'react';
import { IconVolume2 } from '@douyinfe/semi-icons';
import { useI18n } from '../i18n';
import { activateVoice, isVoiceSupported, loadVoiceSettings, saveVoiceSettings } from '../voice';

const DISMISS_KEY = 'voiceBroadcastTipDismissed';

export default function VoiceBroadcastTip() {
  const { t } = useI18n();
  const [sessionDismissed, setSessionDismissed] = useState(false);
  const [persistDismissed, setPersistDismissed] = useState(false);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    try {
      setPersistDismissed(localStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setPersistDismissed(false);
    }
    setActivated(loadVoiceSettings().activated);
  }, []);

  const visible = isVoiceSupported() && !activated && !persistDismissed && !sessionDismissed;
  if (!visible) return null;

  const dismissForever = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
    setPersistDismissed(true);
  };

  const activate = async () => {
    const ok = await activateVoice();
    if (!ok) return;
    const settings = loadVoiceSettings();
    const next = { ...settings, activated: true };
    saveVoiceSettings(next);
    setActivated(true);
    window.dispatchEvent(new CustomEvent('admin-voice-open-settings'));
  };

  return (
    <div className="voice-broadcast-tip">
      <span className="voice-tip-icon"><IconVolume2 /></span>
      <span className="voice-tip-text">{t('开启语音播报，新订单、售后等重要消息将自动语音提醒。')}</span>
      <button type="button" className="voice-tip-btn voice-tip-btn-plain" onClick={dismissForever}>{t('不再提醒')}</button>
      <button type="button" className="voice-tip-btn voice-tip-btn-primary" onClick={() => void activate()}>{t('立即开启')}</button>
      <button type="button" className="voice-tip-btn voice-tip-btn-plain" onClick={() => setSessionDismissed(true)}>{t('暂不')}</button>
    </div>
  );
}
