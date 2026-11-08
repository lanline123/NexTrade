import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import FormatPrice from '@/components/FormatPrice';
import { getAccountChanges, getPcHeader, getUserDetail } from '@/lib/api';
import MemberShell from '@/components/MemberShell';
import MemberAccountTabs from '@/components/MemberAccountTabs';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '账户明细 · 万物新生', robots: { index: false, follow: false } };

interface PageProps { searchParams?: { [key: string]: string | string[] | undefined } }

export default async function AccountDetailPage({ searchParams }: PageProps) {
    const t = getServerT();
  const page = Math.max(1, Number(Array.isArray(searchParams?.page) ? searchParams?.page[0] : searchParams?.page) || 1);
  const size = 15;
  const [data, user, header] = await Promise.all([
    getAccountChanges({ page, size }).catch(() => ({ records: [], total: 0 })),
    getUserDetail().catch(() => null),
    getPcHeader().catch(() => null),
  ]);
  const pages = Math.max(1, Math.ceil(data.total / size));
  const userInfo: any = user || {};
  const hrefFor = (next: number) => next > 1 ? `/member/account/detail?page=${next}` : '/member/account/detail';

  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title={t('账户明细')}>
          <div className="info-row mp-account-detail">
            {/* 源码 member/account/Detail.vue：.info-row > .title-or-tabs(.tag-and-input>.tig-tabs>MemberTopMenu) + .account-detail-content > .tips / .money / .table */}
            <MemberAccountTabs />
          <div className="account-detail-content">
            <div className="tips">
              <Link href="/member/security/info">{t('安全中心')}</Link>
              {t('保障账号资产安全')}
            </div>

            <div className="money">
              <div className="td1-title">
                <ul>
                  <li>{t('我的可用余额')}</li>
                  <FormatPrice value={userInfo.balance} fontSize="24px" fontWeight={700} />
                </ul>
              </div>
              <div className="td2-title">
                <ul>
                  <li>
                    <i className="iconfont-pc icon-qianbao mr10" />
                    {t('全部余额')}：
                    <FormatPrice value={userInfo.totalBalance} fontSize="16px" fontWeight={700} />
                  </li>
                  <li>
                    <i className="iconfont-pc icon-frozen-amount mr10" />
                    {t('冻结余额')}：
                    <FormatPrice value={userInfo.frozenBalance} fontSize="16px" fontWeight={700} />
                  </li>
                </ul>
              </div>
              <div className="td3-title">
                <ul>
                  <li>
                    {/* 旧版：<el-button type="primary" class="big-button">（el 主色钮的库内建观感由 .mp-el-button--primary 平替） */}
                    <Link className="mp-el-button mp-el-button--primary big-button" href="/member/account/deposit">{t('充值')}</Link>
                  </li>
                  <li className="history">
                    <Link href="/member/account/log">{t('历史充值记录')}&gt;</Link>
                  </li>
                </ul>
              </div>
            </div>

              <div className="table">
                {data.records.length ? (
                  <>
                    <table>
                      <thead className="table-header">
                        <tr>
                          <th className="header-cell">{t('操作时间')}</th>
                          <th className="header-cell">{t('金额')}</th>
                          <th className="header-cell">{t('类型')}</th>
                          <th className="header-cell">{t('备注')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.records.map((item, index) => (
                          <tr key={index} className="body-tr">
                            <td>{item.changeTime || '-'}</td>
                            <td className="price">
                              <FormatPrice
                                value={Number(item.balance || 0) > 0 ? item.balance : item.frozenBalance}
                                fontSize="14px"
                              />
                            </td>
                            <td>{item.changeTypeName || '-'}</td>
                            <td className="last">{item.changeDesc || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {pages > 1 ? (
                      <div className="el-page">
                        <div className="pagination">
                          {page > 1 ? (
                            <a href={hrefFor(page - 1)}>{'<'}</a>
                          ) : (
                            <span className="is-disabled">{'<'}</span>
                          )}
                          <span className="is-active">{page}</span>
                          <span className="total">/ {pages}</span>
                          {page < pages ? (
                            <a href={hrefFor(page + 1)}>{'>'}</a>
                          ) : (
                            <span className="is-disabled">{'>'}</span>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="no-result">
                    <div>
                      <span>{t('您还没有明细记录')}</span>
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
