'use client';

/**
 * 页脚「Cookie 设置」入口（对齐旧版 PageFooter.vue，跨境演示站专用）。
 * 点击唤起 PrivacyConsent 的自定义设置抽屉；仅 NEXT_PUBLIC_PC_DEMO=1 渲染。
 */
import { openConsentSettings } from '@/lib/consent';

import { useTranslation } from 'react-i18next';
export default function CookieSettingsLink() {
    const { t } = useTranslation();
  if (process.env.NEXT_PUBLIC_PC_DEMO !== '1') return null;
  return (
    <a
      className="pc-footer__cookie-link"
      role="button"
      tabIndex={0}
      onClick={() => openConsentSettings()}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') openConsentSettings();
      }}
    >{t('Cookie 设置')}</a>
  );
}
