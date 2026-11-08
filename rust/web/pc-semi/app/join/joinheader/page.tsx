import type { Metadata } from 'next';
import Link from 'next/link';
import { getPcHeader } from '@/lib/api';

import { getServerT } from '@/i18n/server';
/**
 * 招商专用头部导航。
 * 源码对照：view/pc/pages/join/joinHeader.vue（<template> 类名逐条照抄）
 * 样式：app/join-page.scss → .pg-join-join-header
 *
 *   .header > .top-area.container > .wrapper
 *       > .logo > a.alv1 > img
 *       > .zs-nav > .nav-slide.slide-to-{activeTab}(+plan-active/standard-active/process-active) + ul > li(.current) > a
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: '招商入驻 · 万物新生' };

const TABS = [
  { name: '', title: '招商首页', link: '/join' },
  { name: 'plan', title: '招商计划', link: '/join/plan' },
  { name: 'standard', title: '招商标准', link: '/join/standard' },
  { name: 'process', title: '入驻流程', link: '/join/process' },
  { name: 'intro', title: '我要入驻', link: '/join/intro' },
];

const ACTIVE_CLASS: Record<string, string> = {
  plan: 'plan-active',
  standard: 'standard-active',
  process: 'process-active',
};

export default async function JoinHeaderPage() {
  const t = getServerT();
  const header = await getPcHeader().catch(() => null);
  const actActive = ACTIVE_CLASS.plan;
  return (
    <div className="pg-join-join-header">
      <div className="header">
        <div className="top-area container">
          <div className="wrapper">
            <div className="logo">
              <Link href="/" className="alv1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={(header as any)?.siteLogo || '/assets/images/logo.png'} alt="" />
              </Link>
            </div>
            <div className="zs-nav">
              <div className={`nav-slide slide-to-${''}${actActive ? ` ${actActive}` : ''}`} />
              <ul>
                {TABS.map((tab) => (
                  <li key={tab.name || 'index'} className={tab.name === 'plan' ? 'current' : ''}>
                    <Link href={tab.link}>{t(tab.title)}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
