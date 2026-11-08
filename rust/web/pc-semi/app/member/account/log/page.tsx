import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import FormatPrice from '@/components/FormatPrice';
import { getPcHeader, getRechargeOrders } from '@/lib/api';
import MemberShell from '@/components/MemberShell';
import MemberAccountTabs from '@/components/MemberAccountTabs';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '充值记录 · 万物新生', robots: { index: false, follow: false } };

interface PageProps { searchParams?: { [key: string]: string | string[] | undefined } }

export default async function RechargeLogPage({ searchParams }: PageProps) {
    const t = getServerT();
  const page = Math.max(1, Number(Array.isArray(searchParams?.page) ? searchParams?.page[0] : searchParams?.page) || 1);
  const size = 15;
  const [data, header] = await Promise.all([
    getRechargeOrders({ page, size }).catch(() => ({ records: [], total: 0 })),
    getPcHeader().catch(() => null),
  ]);
  const pages = Math.max(1, Math.ceil(data.total / size));
  const hrefFor = (next: number) => next > 1 ? `/member/account/log?page=${next}` : '/member/account/log';

  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title={t('充值记录')}>
          {/* 源码 member/account/Log.vue：.info-row > .title-or-tabs(.tag-and-input>.tig-tabs>MemberTopMenu) + .account-detail-content > .table */}
          <div className="info-row mp-account-log">
            <MemberAccountTabs />
            <div className="account-detail-content">
              <div className="table">
                {data.records.length ? (
                  <>
                    <table>
                      <thead className="table-header">
                        <tr>
                          <th className="header-cell">{t('充值时间')}</th>
                          <th className="header-cell">{t('充值金额')}</th>
                          <th className="header-cell">{t('类型')}</th>
                          <th className="header-cell">{t('备注')}</th>
                          <th className="header-cell">{t('状态')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.records.map((item, index) => (
                          <tr key={index} className="body-tr">
                            <td>{item.addTime || '-'}</td>
                            <td className="price">
                              <FormatPrice value={item.amount} fontSize="14px" />
                            </td>
                            <td>{item.type || '-'}</td>
                            <td>{item.postscript || '-'}</td>
                            <td className="last">{item.statusType || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {pages > 1 ? (
                      <div className="el-page">
                        <div className="pagination">
                          {page > 1 ? <a href={hrefFor(page - 1)}>{'<'}</a> : <span className="is-disabled">{'<'}</span>}
                          <span className="is-active">{page}</span>
                          <span className="total">/ {pages}</span>
                          {page < pages ? <a href={hrefFor(page + 1)}>{'>'}</a> : <span className="is-disabled">{'>'}</span>}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="no-result">
                    <div>
                      <span>{t('暂无充值记录')}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}
