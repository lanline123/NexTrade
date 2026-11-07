'use client';

import { useTranslation } from 'react-i18next';

/**
 * 企业认证标识（对齐旧版 view/pc/components/common/AuthBadge.vue）。
 * - 图标为按原 auth.png 描摹的 SVG「V」（左右两笔断开）
 * - verified=false 时灰色「未认证」，true 时橙色「已认证」
 * - 仅 B2B 部署（NEXT_PUBLIC_PC_IS_B2B=1）且后台 closeAuth=1 时由顶栏挂载
 */
export default function AuthBadge({
  verified = false,
  height = 20,
}: {
  verified?: boolean;
  height?: number;
}) {
  const { t } = useTranslation();
  return (
    <span
      className={`auth-badge${verified ? '' : ' auth-badge--off'}`}
      style={{ ['--auth-badge-height' as string]: `${height}px` }}
    >
      <span className="auth-badge__icon">
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <path d="M12.5 15h6.3l9.2 15.6L25.2 36z" fill="#fff" />
          <path d="M32.2 15h5.4l-7 12.8-3-5.4z" fill="#fff" />
        </svg>
      </span>
      <span className="auth-badge__text">{verified ? t('已认证') : t('未认证')}</span>
    </span>
  );
}
