import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import AfterSalesDetailClient from '@/components/AfterSalesDetailClient';
import { getPcHeader } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '申请详情 · 万物新生', robots: { index: false, follow: false } };

/**
 * 退款申请详情（源码对照 java-b2b2c-overseas-v5.8.61/view/pc/pages/member/return/LogInfo.vue）
 *
 * 旧版为独立页面（含状态头/问题补充/回寄表单/商品明细/售后信息/协商记录），
 * 此前该路由直接 redirect 到 /member/aftersales/detail，现渲染完整组件。
 */
export default async function ReturnLogInfoPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const read = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] || '' : value || '');
  const id = Number(read(searchParams?.id) || read(searchParams?.aftersalesId)) || 0;
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <div className="pc-container">
          <nav className="pc-breadcrumb">
            <Link href="/">首页</Link><span>/</span>
            <Link href="/member">会员中心</Link><span>/</span>
            <Link href="/member/return/Log">退款申请记录</Link><span>/</span>
            <span>申请详情</span>
          </nav>
          <h1 className="pc-cart-title">申请详情</h1>
          <div className="return-loginfo-tabs">
            <Link href="/member/aftersales">售后申请</Link>
            <Link href="/member/return/Log" className="is-active">申请记录</Link>
          </div>
          {id ? (
            <AfterSalesDetailClient id={id} />
          ) : (
            <div className="comment-empty">缺少售后单号，无法打开申请详情。请从退款申请记录进入。</div>
          )}
        </div>
      </main>
      <PcFooter />
    </>
  );
}
