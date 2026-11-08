import Link from 'next/link';
import { getHeaderBootstrap } from '@/lib/api';
import { imageFormat } from '@/lib/image';

import { getServerT } from '@/i18n/server';
/**
 * 登录/注册页简化头部（对齐旧版 view/pc components/common/LoginHeader.vue）。
 * - 左侧店铺 Logo（后台 base.shopLogo），右侧欢迎语 + 登录/注册互切链接
 * - 高度/Logo 尺寸/阴影/欢迎语显隐来自后台「登录页装修」pcLogin 配置
 * - 替代完整 PcHeader：登录态页面不再出现导航/搜索/顶栏
 */

const HEADER_SHADOW = '0 2px 12px 0 #0000000a, 0 4px 6px 0 #0000000f';

export default async function PcLoginHeader({
  decorate,
  type = 'login',
}: {
  decorate?: {
    loginMode?: number | string;
    headerHeight?: number | string;
    logoWidth?: number | string;
    logoHeight?: number | string;
    headerShadow?: boolean | number | string;
    showWelcome?: boolean | number | string;
  } | null;
  type?: 'login' | 'register';
}) {
    const t = getServerT();
  const bootstrap = await getHeaderBootstrap();
  const base = bootstrap?.base || null;
  const shopLogo = String(base?.shopLogo || '');
  const shopName = String(base?.shopName || base?.shopTitle || '');
  const shopRegClosed = Number(base?.shopRegClosed ?? 0);

  const height = Number(decorate?.headerHeight ?? 70) || 70;
  const logoWidth = Number(decorate?.logoWidth ?? 140) || 140;
  const logoHeight = Number(decorate?.logoHeight ?? 40) || 40;
  const shadow = Number(decorate?.headerShadow ?? 1) === 1;
  const showWelcome = Number(decorate?.showWelcome ?? 1) === 1;
  /** 源码 LoginHeader.vue classic prop：loginMode=1 经典版 → 1px 底边框 + 内容限宽 1190px */
  const classic = Number(decorate?.loginMode ?? 2) === 1;

  return (
    <div
      className={`pc-login-header${classic ? ' pc-login-header--classic' : ''}`}
      style={{ height, boxShadow: shadow ? HEADER_SHADOW : 'none', borderBottom: classic ? '1px solid #ddd' : 'none' }}
    >
      <div className="pc-login-header__inner">
        <Link href="/" className="pc-login-header__logo">
          {shopLogo ? <img src={imageFormat(shopLogo)} alt={shopName} style={{ maxWidth: logoWidth, maxHeight: logoHeight, objectFit: 'contain' }} /> : <span className="pc-login-header__logo-text">{shopName}</span>}
        </Link>
        {showWelcome ? (
          <div className="pc-login-header__info">
            您好，欢迎光临{shopName}！
            {type === 'register' ? (
              <Link href="/login" className="pc-login-header__switch">{t('已有账号？去登录！')}</Link>
            ) : shopRegClosed === 0 ? (
              <Link href="/register" className="pc-login-header__switch">{t('没有账号？注册新用户！')}</Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
