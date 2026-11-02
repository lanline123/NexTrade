export type VoiceMsgType = 'newOrder' | 'paidOrder' | 'aftersale' | 'cancelOrder' | 'customerMsg';

export interface VoiceSettings {
  newOrder: boolean;
  paidOrder: boolean;
  aftersale: boolean;
  cancelOrder: boolean;
  customerMsg: boolean;
  activated: boolean;
  popupEnabled: boolean;
}

const STORAGE_KEY = 'admin_voice_broadcast_v1';

export const VOICE_TYPES: Array<{ type: VoiceMsgType; label: string; msgType: number | null; text: string }> = [
  { type: 'newOrder', label: '新订单', msgType: 11, text: '您有新的订单' },
  { type: 'paidOrder', label: '已付款订单', msgType: 12, text: '您有新的已付款订单' },
  { type: 'aftersale', label: '售后申请', msgType: 32, text: '您有新的售后申请' },
  { type: 'cancelOrder', label: '订单取消', msgType: 31, text: '您有订单已取消' },
  { type: 'customerMsg', label: '客服消息', msgType: null, text: '您有新的客服消息' },
];

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  newOrder: false,
  paidOrder: true,
  aftersale: true,
  cancelOrder: false,
  customerMsg: true,
  activated: false,
  popupEnabled: false,
};

export function loadVoiceSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VOICE_SETTINGS };
    return { ...DEFAULT_VOICE_SETTINGS, ...(JSON.parse(raw) as Partial<VoiceSettings>) };
  } catch {
    return { ...DEFAULT_VOICE_SETTINGS };
  }
}

export function saveVoiceSettings(settings: VoiceSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage failure
  }
}

export function isVoiceSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text: string): void {
  if (!isVoiceSupported()) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  } catch {
    // ignore speech failure
  }
}

export async function activateVoice(): Promise<boolean> {
  if (!isVoiceSupported()) return false;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance('语音播报已开启');
    utterance.lang = 'zh-CN';
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

/**
 * SSE 增量分发：按设置开关比较两次 payload，增量 > 0 时播报。
 * 首次 payload（prev 为空）只建立基线，不播报。
 */
export function dispatchVoiceDeltas(
  prev: Record<string, number> | null,
  next: Record<string, number> | null,
  settings: VoiceSettings,
  onNew?: (type: VoiceMsgType) => void,
): void {
  if (!prev || !next || !settings.activated) return;
  if (!isVoiceSupported()) return;
  const fieldOf: Record<VoiceMsgType, string> = {
    newOrder: 'newOrderMsgCount',
    paidOrder: 'paidOrderMsgCount',
    aftersale: 'aftersaleMsgCount',
    cancelOrder: 'cancelOrderMsgCount',
    customerMsg: 'customerMsgCount',
  };
  VOICE_TYPES.forEach((item) => {
    if (!settings[item.type]) return;
    const field = fieldOf[item.type];
    const nextVal = Number(next[field] ?? 0);
    const prevVal = Number(prev[field] ?? 0);
    if (nextVal > prevVal) {
      speak(item.text);
      onNew?.(item.type);
    }
  });
}
