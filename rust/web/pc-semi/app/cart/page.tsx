import type { Metadata } from 'next';

import { getServerT } from '@/i18n/server';
import PcHeader from '@/components/PcHeaderWithData';
import CartClient from '@/components/CartClient';
import { getPcHeader } from '@/lib/api';
import PcFooter from '@/components/PcFooter';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT();
  return {
  title: t('购物车 · 万物新生'),
  robots: { index: false, follow: false },
};
}

export default async function CartPage() {
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      {/* 原版 cart/index.vue 没有面包屑和独立 h1；「购物车」标题在列表卡片内（cartHeadTitle） */}
      <main className="pc-cart-page">
        <div className="pc-container">
          <CartClient />
        </div>
      </main>
      <PcFooter />
    </>
  );
}
