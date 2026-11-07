/**
 * Cookie/GDPR 同意状态管理（对齐旧版 composables/useConsent.ts，跨境演示站专用）。
 * 仅在客户端使用：NEXT_PUBLIC_PC_DEMO=1 时由 layout 挂载 PrivacyConsent。
 */

export const PRIVACY_POLICY_VERSION = 'v1';
const CONSENT_COOKIE_KEY = 'privacyConsent';
const CONSENT_DETAIL_KEY = 'privacyConsentDetail';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 年

export interface ConsentDetail {
  necessary: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  policyVersion?: string;
  updatedAt?: number;
}

export type ConsentChoices = Pick<ConsentDetail, 'functional' | 'analytics' | 'marketing'>;

export function readConsentMode(): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE_KEY}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

export function readConsentDetail(): ConsentDetail | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_DETAIL_KEY}=([^;]*)`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1])) as ConsentDetail;
  } catch {
    return null;
  }
}

/** 是否需要重新弹窗：未决定，或政策版本已升级 */
export function needRedecide(): boolean {
  if (!readConsentMode()) return true;
  const detail = readConsentDetail();
  if (!detail) return true;
  return detail.policyVersion !== PRIVACY_POLICY_VERSION;
}

function writeDetail(choices: ConsentChoices, mode: string) {
  const value: ConsentDetail = {
    necessary: true,
    ...choices,
    policyVersion: PRIVACY_POLICY_VERSION,
    updatedAt: Date.now(),
  };
  const options = `path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  document.cookie = `${CONSENT_DETAIL_KEY}=${encodeURIComponent(JSON.stringify(value))}; ${options}`;
  document.cookie = `${CONSENT_COOKIE_KEY}=${encodeURIComponent(mode)}; ${options}`;
}

export const acceptAll = () => writeDetail({ functional: true, analytics: true, marketing: true }, 'all');
export const rejectAll = () => writeDetail({ functional: false, analytics: false, marketing: false }, 'rejected');
export const saveCustom = (choices: ConsentChoices) => writeDetail(choices, 'custom');

/** 页脚「Cookie 设置」入口通过自定义事件唤起设置抽屉 */
export const OPEN_CONSENT_SETTINGS_EVENT = 'pc-open-consent-settings';
export const openConsentSettings = () => window.dispatchEvent(new Event(OPEN_CONSENT_SETTINGS_EVENT));
