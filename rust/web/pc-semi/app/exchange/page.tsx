import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeaderWithData';
import PcFooter from '@/components/PcFooter';
import { getExchangeList, getIntegralName, getPcHeader } from '@/lib/api';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT();
  return {
    title: t('积分换购 · 万物新生'),
    description: t('积分换购商品列表，积分加金额兑换好物。'),
  };
}

interface PageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

/**
 * 积分换购列表。
 * 源码对照：view/pc/pages/exchange/List.vue —— <template> 类名逐条照抄
 * 样式：app/exchange-page.scss → .pg-exchange-list
 *
 *   CommonPageHeader → PcHeader
 *   CommonPageContainer > .exchange-list > .goods-list-c > ul.flex-wrap
 *       > li.tab-box.g_list > .nuxt > .g-item-warp
 *           > a.pic > span.exchange-list__pic > img（+ .product-style-border）
 *           > .info > p.name.ellipsis > a
 *                   + p.market_price（原价）
 *                   + p.exchange_price（积分价：金额 + span 积分）
 *                   + a > p.exchange_btn（立即兑换）
 *   > .search-empty > .bd > h4       （空态）
 *   > .el-page > .el-pagination      （分页）
 *   CommonPageFooter → PcFooter
 */
const PAGE_SIZES = [20, 40, 60];

export default async function ExchangePage({ searchParams }: PageProps) {
  const t = getServerT();
  const page = Math.max(1, Number(readParam(searchParams?.page)) || 1);
  const sizeRaw = Number(readParam(searchParams?.size)) || 20;
  const size = PAGE_SIZES.includes(sizeRaw) ? sizeRaw : 20;
  const [data, header, integralName] = await Promise.all([
    getExchangeList({ page, size }).catch(() => ({ records: [], total: 0 })),
    getPcHeader().catch(() => null),
    getIntegralName(),
  ]);
  const pages = Math.max(1, Math.ceil(data.total / size));
  const hrefFor = (next: number) => {
    const query = new URLSearchParams();
    if (next > 1) query.set('page', String(next));
    if (size !== 20) query.set('size', String(size));
    const qs = query.toString();
    return qs ? `/exchange?${qs}` : '/exchange';
  };

  return (
    <div className="pg-exchange-list">
      <PcHeader config={header as any} />

      <div className="container">
        <div className="exchange-list">
          <div className="goods-list-c">
            <ul className="flex-wrap">
              {data.records.map((item) => (
                <li className="tab-box g_list" key={item.id}>
                  <div className="nuxt" title={item.productName || ''}>
                    <div className="g-item-warp">
                      <Link className="pic" href={`/exchange/${item.id}`} target="_blank">
                        <span className="exchange-list__pic">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.picThumb || item.picUrl || ''} alt={item.productName || ''} width={250} height={250} />
                        </span>
                      </Link>
                      <div className="info">
                        <p className="name ellipsis">
                          <Link href={`/exchange/${item.id}`} target="_blank">
                            {item.productName}
                          </Link>
                        </p>
                        <p className="market_price">
                          {t('原价')}：¥{Number(item.productPrice || 0).toFixed(2)}
                        </p>
                        <p className="exchange_price">
                          {integralName}
                          {t('价')}：¥{Number(item.discountsPrice || 0).toFixed(2)} +&nbsp;
                          <span>{Number(item.exchangeIntegral || 0)}</span> {integralName}
                        </p>
                        <Link href={`/exchange/${item.id}`} target="_blank">
                          <p className="exchange_btn">{t('立即兑换')}</p>
                        </Link>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {!data.records.length ? (
          <div className="search-empty">
            <div className="bd">
              <h4>{t('暂时没有符合条件的商品！')}</h4>
            </div>
          </div>
        ) : null}

        {data.records.length && pages > 1 ? (
          <div className="el-page">
            <nav className="el-pagination">
              {page > 1 ? (
                <Link href={hrefFor(page - 1)} className="btn-prev">
                  {'<'}
                </Link>
              ) : (
                <span className="btn-prev disabled">{'<'}</span>
              )}
              {Array.from({ length: Math.min(pages, 8) }).map((_, index) => {
                const next = index + 1;
                return next === page ? (
                  <span className="number active" key={next}>
                    {next}
                  </span>
                ) : (
                  <Link href={hrefFor(next)} className="number" key={next}>
                    {next}
                  </Link>
                );
              })}
              {page < pages ? (
                <Link href={hrefFor(page + 1)} className="btn-next">
                  {'>'}
                </Link>
              ) : (
                <span className="btn-next disabled">{'>'}</span>
              )}
            </nav>
          </div>
        ) : null}
      </div>

      <PcFooter />
    </div>
  );
}
