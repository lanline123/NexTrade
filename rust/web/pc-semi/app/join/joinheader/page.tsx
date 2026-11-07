import Link from 'next/link';
import PcHeader from '@/components/PcHeaderWithData';
import PcFooter from '@/components/PcFooter';
import { getPcHeader } from '@/lib/api';

import { getServerT } from '@/i18n/server';
/**
 * 招商专用头部导航（源码 java.../view/pc/pages/join/joinHeader.vue：
 * zs-nav / nav-slide / slide-to-${activeTab}）。旧实现是 redirect('/join')，
 * 这里恢复独立页面，供旧链接与装修预览访问。
 */
export const dynamic = 'force-dynamic';

const NAV = [
  { label: '招商首页', href: '/join' },
  { label: '招商介绍', href: '/join/intro' },
  { label: '投资计划', href: '/join/plan' },
  { label: '入驻流程', href: '/join/process' },
  { label: '招商标准', href: '/join/standard' },
];

export default async function JoinHeaderPage() {
    const t = getServerT();
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-static-page">
        <div className="pc-container">
          <nav className="zs-nav" style={{ display: 'flex', gap: 24, padding: '16px 0', borderBottom: '1px solid #eee' }}>
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="nav-slide" style={{ color: '#344054', fontSize: 14 }}>
                {item.label}
              </Link>
            ))}
          </nav>
          <section className="legacy-home__floor" style={{ marginTop: 20 }}>
            <h1>{t('招商入驻')}</h1>
            <p>{t('选择上方栏目查看招商介绍、投资计划、入驻流程与招商标准。')}</p>
          </section>
        </div>
      </main>
      <PcFooter />
    </>
  );
}
