import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import AfterSalesDetailClient from '@/components/AfterSalesDetailClient';
import { getPcHeader } from '@/lib/api';
import MemberShell from '@/components/MemberShell';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '申请详情 · 万物新生', robots: { index: false, follow: false } };

/**
 * 退款申请详情（源码对照 java-b2b2c-overseas-v5.8.61/view/pc/pages/member/return/LogInfo.vue）
 *
 * 旧版骨架（LogInfo.vue:12-19）：
 *   <div class="info-row">
 *     <div class="title-or-tabs"><div class="tag-and-input"><div class="tig-tabs">
 *       <MemberTopMenu :menuList="menuList" />
 * 其中 menuList（LogInfo.vue:399-402）= 售后申请 /member/return/list + 申请记录 /member/return/logInfo。
 * 其余内容（状态头 / 问题补充 / 回寄表单 / 商品明细 / 售后信息 / 协商记录）在
 * AfterSalesDetailClient 的 `.log-return-content` 里。
 * `.mp-return-loginfo` 包裹层承载 LogInfo.vue 的 <style scoped>
 * （见 app/member-pages.scss:1791，由 scripts/gen-member-pages-scss.mjs 生成）。
 */
export default async function ReturnLogInfoPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const t = getServerT();
  const read = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] || '' : value || '');
  const id = Number(read(searchParams?.id) || read(searchParams?.aftersalesId)) || 0;
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title={t('申请详情')}>
          <div className="info-row mp-return-loginfo">
            <div className="title-or-tabs">
              <div className="tag-and-input">
                <div className="tig-tabs">
                  <Link className="tab" href="/member/return/list">{t('售后申请')}</Link>
                  <Link className="tab active" href={`/member/return/loginfo${id ? `?id=${id}` : ''}`}>{t('申请记录')}</Link>
                </div>
              </div>
            </div>
            {id ? (
              <AfterSalesDetailClient id={id} />
            ) : (
              <div className="log-return-content">
                <div className="no-result">
                  <span className="empty-text">{t('缺少售后单号，无法打开申请详情。请从退款申请记录进入。')}</span>
                </div>
              </div>
            )}
          </div>
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}
