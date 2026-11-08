import Link from 'next/link';

import { getServerT } from '@/i18n/server';

/**
 * 招商专用头部导航（各招商页共用）。
 * 源码对照：view/pc/pages/join/joinHeader.vue
 * 样式：app/join-page.scss → .pg-join-join-header
 *
 *   .header > .top-area.container > .wrapper
 *       > .logo > a.alv1 > img
 *       > .zs-nav > .nav-slide（.slide-to-{tab}、.plan-active、.standard-active、.process-active）+ ul > li(.current) > a
 */
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

export default function JoinNav({ active = '', siteLogo }: { active?: string; siteLogo?: string }) {
  const t = getServerT();
  const actActive = ACTIVE_CLASS[active] || '';
  return (
    <div className="pg-join-join-header">
      <div className="header">
        <div className="top-area container">
          <div className="wrapper">
            <div className="logo">
              <Link href="/" className="alv1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={siteLogo || '/assets/images/logo.png'} alt="" />
              </Link>
            </div>
            <div className="zs-nav">
              <div className={`nav-slide${active ? ` slide-to-${active}` : ''}${actActive ? ` ${actActive}` : ''}`} />
              <ul>
                {TABS.map((tab) => (
                  <li key={tab.name || 'index'} className={tab.name === active ? 'current' : ''}>
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
