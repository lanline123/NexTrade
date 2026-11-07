import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeaderWithData';
import PcFooter from '@/components/PcFooter';
import GrouponCountdown from '@/components/GrouponCountdown';
import { getGrouponBanners, getGrouponItems, getPcHeader } from '@/lib/api';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '拼团 · 万物新生', description: '拼团活动商品列表。' };

interface PageProps { searchParams?: { [key: string]: string | string[] | undefined } }

/** 旧版 JoiningGoodsList.getMaxGroupNum：groupNum JSON（[{groupNumKey, groupNum}]）取最大档 */
function maxGroupNum(raw: unknown): number {
  try {
    const list = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(list)) return 0;
    return list.reduce((max: number, row: any) => Math.max(max, Number(row?.groupNum) || 0), 0);
  } catch {
    return 0;
  }
}

export default async function JoiningPage({ searchParams }: PageProps) {
    const t = getServerT();
  const page = Math.max(1, Number(Array.isArray(searchParams?.page) ? searchParams?.page[0] : searchParams?.page) || 1);
  const keyword = String(Array.isArray(searchParams?.keyword) ? searchParams?.keyword[0] : searchParams?.keyword || '');
  const size = 20;
  const [banners, data, header] = await Promise.all([
    getGrouponBanners().catch(() => []),
    getGrouponItems({ page, size, keyword }).catch(() => ({ records: [], total: 0 })),
    getPcHeader().catch(() => null),
  ]);
  const pages = Math.max(1, Math.ceil(data.total / size));
  const href = (next: number) => next > 1 ? `/joining?page=${next}` : '/joining';

  return (
    <div className="joining-page">
      <PcHeader config={header as any} />
      <main className="joining-main">
        <div className="joining-container">
          {banners.length ? (
            <div className="joining-banner">
              <img src={banners[0]} alt={t('拼团活动')} />
            </div>
          ) : null}
          <div className="joining-toolbar">
            <h1>{t('拼团活动')}</h1>
            <form action="/joining" method="get">
              <input name="keyword" defaultValue={keyword} placeholder={t('搜索拼团商品')} />
              <button type="submit">{t('搜索')}</button>
            </form>
          </div>
          {data.records.length ? (
            <ul className="joining-grid">
              {data.records.map((item, index) => (
                <li key={`${item.productId || item.grouponPromotionItemId || index}`}>
                  <Link href={`/product/${item.productId || ''}`} className="joining-card">
                    <div className="joining-card__img"><img src={item.picThumb || ''} alt={item.productName || ''} loading="lazy" /></div>
                    <div className="joining-card__name">{item.productName || t('拼团商品')}</div>
                    <div className="joining-card__price"><b>¥ {Number(item.grouponPrice || 0).toFixed(2)}</b><s>¥ {Number(item.productPrice || 0).toFixed(2)}</s></div>
                    <div className="joining-card__meta">
                      {maxGroupNum(item.groupNum) || item.minGroupNum || 2} 人团 · 已有 {item.joinNumCount || 0} 人参团
                    </div>
                    <div className="joining-card__foot">
                      {/* 旧版 JoiningGoodsList：每秒倒计时 + 仅限会员灰态（canJoin===false） */}
                      <span className="joining-card__countdown"><GrouponCountdown endTime={item.endTime as string | number | undefined} /></span>
                      {item.canJoin === false ? <span className="joining-card__restrict" title={item.restrictTip || t('仅限指定会员参与')}>{t('仅限会员')}</span> : <span className="joining-card__go">{t('去拼团')}</span>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <div className="comment-empty">{t('暂无拼团商品')}</div>}
          {pages > 1 ? (
            <nav className="article-pagination">
              {page > 1 ? <Link href={href(page - 1)}>{t('上一页')}</Link> : <span className="is-disabled">{t('上一页')}</span>}
              <span>{page} / {pages}</span>
              {page < pages ? <Link href={href(page + 1)}>{t('下一页')}</Link> : <span className="is-disabled">{t('下一页')}</span>}
            </nav>
          ) : null}
        </div>
      </main>
      <PcFooter />
    </div>
  );
}
