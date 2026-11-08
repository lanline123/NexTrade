'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import User from '@icon-park/react/es/icons/User';
import MemberNav from './MemberNav';

import { useTranslation } from 'react-i18next';
/**
 * 会员中心页面壳（服务端）
 * 源码对照：原版 pages/member 各页面（如 order/List.vue）的
 *   TopJumpBar（我的 / 当前页标题）+ CommonPageContainer flex（左 MemberNav + 右内容）
 *
 * 用法：<MemberShell title={t('我的订单')}><页面内容/></MemberShell>
 */

export default function MemberShell({ title, children, noNav = false }: { title: string; children: ReactNode; noNav?: boolean }) {
  const { t } = useTranslation();
  return (
    <>
      {/* TopJumpBar：我的 / 当前页标题 */}
      <div className="pc-container pc-member-topbar">
        <Link href="/member" className="pc-member-topbar__mine"><User size={20} />{t('我的')}</Link>
        <span className="pc-member-topbar__sep">/</span>
        <b className="pc-member-topbar__title">{title}</b>
      </div>
      {/* CommonPageContainer flex：左导航 + 右内容。
          noNav 用于旧版本来就没有 MemberNav 的页（如 userMessage/List.vue 自带 .mc_side_bar 侧栏）。 */}
      {noNav ? (
        <div className="pc-container">{children}</div>
      ) : (
        <div className="pc-container pc-member-shell">
          <MemberNav />
          <div className="pc-member-shell__main">{children}</div>
        </div>
      )}
    </>
  );
}
