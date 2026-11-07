import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
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
 * 源码 exchange/List.vue：filterParams 里实际字段只有 page / size / sortField /
 * sortOrder / isEnabled，并没有分类或积分区间接口。这里按原版字段做排序 Tab，
 * 积分区间作为 URL query 的兜底筛选（对当前页记录做内存过滤，不影响后端分页）。
 */
const INTEGRAL_TABS = [
  { key: '', label: '全部积分' },
  { key: '0-1000', label: '0 - 1000 积分' },
  { key: '1000-5000', label: '1000 - 5000 积分' },
  { key: '5000-', label: '5000 积分以上' },
];
const SORT_TABS = [
  { key: 'id-desc', label: '综合', sortField: 'id', sortOrder: 'desc' },
  { key: 'integral-asc', label: '积分从低到高', sortField: 'exchangeIntegral', sortOrder: 'asc' },
  { key: 'integral-desc', label: '积分从高到低', sortField: 'exchangeIntegral', sortOrder: 'desc' },
  { key: 'price-asc', label: '价格从低到高', sortField: 'discountsPrice', sortOrder: 'asc' },
];

/** 源码 components/list/src/Pagination.vue：组件化分页 */
/** 旧版 el-pagination 的 sizes：每页条数选择 */
const EXCHANGE_SIZE_OPTIONS = [20, 40, 60];

function ExchangePagination({ page, pages, hrefFor, sizeHref, size }: { page: number; pages: number; hrefFor: (next: number) => string; sizeHref: (size: number) => string; size: number }) {
  const t = getServerT();
  return (
    <nav className="exchange-pagination">
      {page > 1 ? <Link href={hrefFor(page - 1)}>{t('上一页')}</Link> : <span className="is-disabled">{t('上一页')}</span>}
      <span>{page} / {pages}</span>
      {page < pages ? <Link href={hrefFor(page + 1)}>{t('下一页')}</Link> : <span className="is-disabled">{t('下一页')}</span>}
      <span className="exchange-pagination__size">
        {EXCHANGE_SIZE_OPTIONS.map((option) => (
          <Link key={option} href={sizeHref(option)} className={option === size ? 'is-current' : ''}>
            {option}{t('条/页')}
          </Link>
        ))}
      </span>
    </nav>
  );
}

const TAB_STYLE: CSSProperties = {
  display: 'inline-block', padding: '6px 14px', marginRight: 8, border: '1px solid #e5e5e5',
  borderRadius: 4, fontSize: 13, color: '#555', background: '#fff', textDecoration: 'none',
};
const TAB_ACTIVE_STYLE: CSSProperties = { ...TAB_STYLE, borderColor: 'var(--pc-primary, #e01222)', color: '#e01222', background: '#fff5f5' };

export default async function ExchangePage({ searchParams }: PageProps) {
    const t = getServerT();
  const page = Math.max(1, Number(readParam(searchParams?.page)) || 1);
  // 旧版 el-pagination 支持 size 选择（List.vue 默认 20）
  const sizeRaw = Number(readParam(searchParams?.size)) || 20;
  const size = [20, 40, 60].includes(sizeRaw) ? sizeRaw : 20;
  const integral = readParam(searchParams?.integral);
  const sortField = readParam(searchParams?.sortField) || 'id';
  const sortOrder = readParam(searchParams?.sortOrder) || 'desc';
  const [data, header, integralName] = await Promise.all([
    getExchangeList({ page, size }).catch(() => ({ records: [], total: 0 })),
    getPcHeader().catch(() => null),
    getIntegralName(),
  ]);
  const pages = Math.max(1, Math.ceil(data.total / size));

  /** 源码 tab-box g_list：筛选/排序通过 URL query 保持状态 */
  const queryFor = (patch: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams();
    const merged: Record<string, string | number | undefined> = { integral, sortField, sortOrder, size, ...patch };
    Object.entries(merged).forEach(([key, value]) => {
      if (value === undefined || value === '') return;
      if (key === 'page' && Number(value) <= 1) return;
      if (key === 'size' && Number(value) === 20) return;
      query.set(key, String(value));
    });
    const qs = query.toString();
    return qs ? `/exchange?${qs}` : '/exchange';
  };
  const hrefFor = (next: number) => queryFor({ page: next });
  const sizeHref = (nextSize: number) => queryFor({ size: nextSize, page: 1 });

  /** 积分区间兜底筛选 + 原版 sortField/sortOrder 排序（仅作用于当前页记录） */
  const fieldValue = (item: (typeof data.records)[number], field: string) => {
    if (field === 'id') return Number(item.id || 0);
    if (field === 'exchangeIntegral') return Number(item.exchangeIntegral || 0);
    if (field === 'discountsPrice') return Number(item.discountsPrice || 0);
    return 0;
  };
  let records = data.records;
  if (integral) {
    const parts = integral.split('-');
    const min = parts[0] === '' ? undefined : Number(parts[0]);
    const max = parts[1] === '' || parts[1] === undefined ? undefined : Number(parts[1]);
    records = records.filter((item) => {
      const points = Number(item.exchangeIntegral || 0);
      if (min !== undefined && points < min) return false;
      if (max !== undefined && points > max) return false;
      return true;
    });
  }
  const sortedRecords = [...records].sort((a, b) => {
    const diff = fieldValue(a, sortField) - fieldValue(b, sortField);
    return sortOrder === 'asc' ? diff : -diff;
  });

  return (
    <div className="exchange-page">
      <PcHeader config={header as any} />
      <main className="exchange-main">
        <div className="exchange-container">
          <h1 className="exchange-title">{integralName}{t('换购')}</h1>
          {/* 源码 exchange/List.vue：tab-box g_list 筛选 Tab 组（积分区间 / 排序） */}
          <div className="tab-box g_list exchange-filters" style={{ background: '#fff', padding: '12px 16px', marginBottom: 16, border: '1px solid #eee' }}>
            <div className="exchange-filters__row" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: '#888', marginRight: 12 }}>{t('积分区间')}</span>
              {INTEGRAL_TABS.map((tab) => (
                <Link key={tab.key} href={queryFor({ integral: tab.key, page: 1 })} style={integral === tab.key ? TAB_ACTIVE_STYLE : TAB_STYLE}>{t(tab.label)}</Link>
              ))}
            </div>
            <div className="exchange-filters__row" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: '#888', marginRight: 12 }}>{t('排序')}</span>
              {SORT_TABS.map((tab) => (
                <Link key={tab.key} href={queryFor({ sortField: tab.sortField, sortOrder: tab.sortOrder, page: 1 })} style={sortField === tab.sortField && sortOrder === tab.sortOrder ? TAB_ACTIVE_STYLE : TAB_STYLE}>{t(tab.label)}</Link>
              ))}
            </div>
          </div>
          {sortedRecords.length ? (
            <ul className="exchange-list">
              {sortedRecords.map((item) => (
                <li className="tab-box g_list exchange-card" key={item.id}>
                  <Link href={`/exchange/${item.id}`} className="exchange-card__pic" target="_blank">
                    <img src={item.picThumb || item.picUrl || ''} alt={item.productName || ''} loading="lazy" />
                  </Link>
                  <div className="exchange-card__info">
                    <Link href={`/exchange/${item.id}`} className="exchange-card__name" target="_blank">{item.productName}</Link>
                    <div className="exchange-card__price">{t('原价')}：¥ {Number(item.productPrice || 0).toFixed(2)}</div>
                    <div className="exchange-card__integral">
                      {integralName}{t('价')}：¥ {Number(item.discountsPrice || 0).toFixed(2)} + <b>{Number(item.exchangeIntegral || 0)}</b> {integralName}
                    </div>
                    <Link className="exchange-card__btn" href={`/exchange/${item.id}`} target="_blank">{t('立即兑换')}</Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="exchange-empty">{t('暂时没有符合条件的商品！')}</div>
          )}
          {sortedRecords.length > 0 && pages > 1 ? (
            <ExchangePagination page={page} pages={pages} hrefFor={hrefFor} sizeHref={sizeHref} size={size} />
          ) : null}
        </div>
      </main>
      <PcFooter />
    </div>
  );
}

