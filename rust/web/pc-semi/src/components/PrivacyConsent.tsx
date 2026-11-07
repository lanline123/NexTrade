'use client';

/**
 * Cookie 隐私偏好设置（对齐旧版 view/pc/components/common/PrivacyConsent.vue）。
 * - 首次访问底部 banner：自定义 / 同意
 * - 「自定义」打开右侧抽屉：必要(默认开)/功能性/分析性/广告性 Cookies 开关
 * - ESC 关抽屉、弹层打开时锁定背景滚动
 * - 页脚「Cookie 设置」入口通过 window 事件 pc-open-consent-settings 唤起
 * 仅演示站（NEXT_PUBLIC_PC_DEMO=1）由 layout 挂载；正式站零渲染。
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  OPEN_CONSENT_SETTINGS_EVENT,
  acceptAll,
  needRedecide,
  readConsentDetail,
  saveCustom,
  type ConsentChoices,
} from '@/lib/consent';

const DESC_MAIN =
  '当您访问任何网站或应用程序时，它可能会在您的浏览器上存储或检索信息，主要以cookie和类似技术的形式。这些信息可能与您、您的偏好或您的设备有关，主要用于使网站按您的期望工作。这些信息通常不能直接识别你的身份，但它可以给你一个更个性化的网络体验。由于我们尊重您的隐私权，您可以选择不允许使用某些类型的cookie和类似技术。';

const CATEGORIES: Array<{ key: keyof Omit<ConsentChoices, never> | 'necessary'; name: string; desc: string; fixed?: boolean }> = [
  {
    key: 'necessary',
    name: '必要性Cookies',
    desc: '这些 Cookie 对我们服务的运行至关重要，也是我们与您之间服务条款的一部分。例如，它们包括用于让您登录安全区域、使用购物车、执行服务交付步骤，以及保持页面正确布局和导航的 Cookie。如果您禁用这些 Cookie，某些服务功能可能无法正常运行。必要的 Cookie 可在未经您同意的情况下被使用。',
    fixed: true,
  },
  {
    key: 'functional',
    name: '功能性 cookies',
    desc: '这类 cookies 让本网站可以记住您做过的选择，借此为您提供优化后的内容。',
  },
  {
    key: 'analytics',
    name: '分析性Cookies',
    desc: '这类 cookies 收集您使用本网站的信息，如您经常访问的页面，或您是否有收到任何报错信息。通过分析这些数据，网站可以进行优化和改进。',
  },
  {
    key: 'marketing',
    name: '广告性Cookies',
    desc: '这些 cookies 用于提供个性化的广告和内容，通常由第三方广告网络设置。它们能够追踪用户的浏览行为，以便向用户展示相关的广告。',
  },
];

export default function PrivacyConsent() {
    const { t } = useTranslation();
  const [bannerVisible, setBannerVisible] = useState(false);
  const [customizeVisible, setCustomizeVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<ConsentChoices>({ functional: false, analytics: false, marketing: false });

  /* 首次挂载：未做过决定则弹 banner；监听页脚「Cookie 设置」事件 */
  useEffect(() => {
    setMounted(true);
    if (needRedecide()) setBannerVisible(true);
    const open = () => {
      const detail = readConsentDetail();
      setSettings({
        functional: !!detail?.functional,
        analytics: !!detail?.analytics,
        marketing: !!detail?.marketing,
      });
      setCustomizeVisible(true);
    };
    window.addEventListener(OPEN_CONSENT_SETTINGS_EVENT, open);
    return () => window.removeEventListener(OPEN_CONSENT_SETTINGS_EVENT, open);
  }, []);

  /* ESC 关闭抽屉 */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && customizeVisible) setCustomizeVisible(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [customizeVisible]);

  /* 弹层打开时锁定背景滚动 */
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = bannerVisible || customizeVisible ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [bannerVisible, customizeVisible]);

  const openCustomize = useCallback(() => {
    const detail = readConsentDetail();
    setSettings({
      functional: !!detail?.functional,
      analytics: !!detail?.analytics,
      marketing: !!detail?.marketing,
    });
    setCustomizeVisible(true);
  }, []);

  const handleAcceptAll = useCallback(() => {
    acceptAll();
    setBannerVisible(false);
    setCustomizeVisible(false);
  }, []);

  const handleSaveCustomize = useCallback(() => {
    saveCustom(settings);
    setBannerVisible(false);
    setCustomizeVisible(false);
  }, [settings]);

  if (!mounted || (!bannerVisible && !customizeVisible)) return null;

  return (
    <>
      {bannerVisible ? (
        <div className="privacy-consent-mask">
          <div className="privacy-consent-panel">
            <div className="privacy-consent-content">
              <div className="privacy-consent-title">{t('隐私设置')}</div>
              <div className="privacy-consent-desc">{DESC_MAIN}</div>
            </div>
            <div className="privacy-consent-actions">
              <button type="button" className="privacy-btn privacy-btn-outline" onClick={openCustomize}>{t('自定义')}</button>
              <button type="button" className="privacy-btn privacy-btn-primary" onClick={handleAcceptAll}>{t('同意')}</button>
            </div>
          </div>
        </div>
      ) : null}

      {customizeVisible ? (
        <div className="privacy-customize-mask" onClick={(event) => { if (event.target === event.currentTarget) setCustomizeVisible(false); }}>
          <div className="privacy-customize-drawer">
            <div className="privacy-customize-header">
              <div className="title">{t('隐私设置')}</div>
              <button type="button" className="close-btn" aria-label={t('关闭')} onClick={() => setCustomizeVisible(false)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                </svg>
              </button>
            </div>

            <div className="privacy-customize-body">
              <div className="privacy-customize-intro">{DESC_MAIN}</div>
              {CATEGORIES.map((category) => (
                <div className="privacy-customize-item" key={category.key}>
                  <div className="privacy-customize-row">
                    <span className="name">{category.name}</span>
                    {category.fixed ? (
                      <span className="default-on">{t('默认打开')}</span>
                    ) : (
                      <Switch
                        checked={Boolean(settings[category.key as keyof ConsentChoices])}
                        onChange={(checked) => setSettings((prev) => ({ ...prev, [category.key]: checked }))}
                      />
                    )}
                  </div>
                  <div className="privacy-customize-desc">{category.desc}</div>
                </div>
              ))}
            </div>

            <div className="privacy-customize-footer">
              <button type="button" className="privacy-btn privacy-btn-outline" onClick={handleSaveCustomize}>{t('确认我的选择')}</button>
              <button type="button" className="privacy-btn privacy-btn-primary" onClick={handleAcceptAll}>{t('同意')}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** 黑色主题开关（对齐旧版 el-switch active-color=#000） */
function Switch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`privacy-switch${checked ? ' is-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="privacy-switch__dot" />
    </button>
  );
}
