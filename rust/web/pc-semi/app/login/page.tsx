import type { Metadata } from 'next';
import PcFooter from '@/components/PcFooter';
import LoginClient from '@/components/LoginClient';
import { getHeaderBootstrap, getPcLoginDecorate } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '登录 · 万物新生' };

/**
 * 登录页（毛玻璃卡片整屏构图）
 *
 * 不再渲染独立白条 PcLoginHeader：logo 与注册入口由 LoginClient 的悬浮顶栏
 * （.login-glass__topbar）承载，避免「白色头部 + 主体」的割裂感。
 * 背景来自登录页装修 home/home/pcLogin（backgroundPic / backgroundColor）；
 * 店铺 logo / 名称 / 注册开关来自 getHeaderBootstrap（common/config/base）。
 * PcFooter 保留在整屏主体之下（滚动可见）。
 */
export default async function LoginPage() {
  const [decorate, bootstrap] = await Promise.all([
    getPcLoginDecorate().catch(() => null),
    getHeaderBootstrap().catch(() => null),
  ]);
  const base = bootstrap?.base || null;
  return (
    <>
      <LoginClient
        shopName={String(base?.shopName || base?.shopTitle || '万物新生')}
        shopLogo={String(base?.shopLogo || '')}
        shopRegClosed={Number(base?.shopRegClosed ?? 0)}
        decorate={decorate}
      />
      <PcFooter />
    </>
  );
}
