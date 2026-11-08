import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import { getAftersalesRecords, getPcHeader } from '@/lib/api';
import MemberShell from '@/components/MemberShell';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '退款申请记录 · 万物新生', robots: { index: false, follow: false } };

/**
 * 售后记录列表页 —— 源码对照 view/pc/pages/member/return/Log.vue（261 行）
 *
 * 结构与类名逐条照抄旧版模板，全部落在 `.mp-return-log` 包裹层下
 * （该层样式由 scripts/gen-member-pages-scss.mjs 从本页 <style scoped> 抽取，见 app/member-pages.scss:1686）：
 *
 *   .info-row.mp-return-log
 *     > .title-or-tabs > .tag-and-input > .tig-tabs > a.tab(售后申请 / 申请记录，当前页 .active)
 *     > .page-info-body
 *         > table.order-table ×N（每个售后单一张表）
 *             thead > tr > th[colspan=4]（售后单号 / 订单号 / 申请时间，间隔 30px）
 *             tbody > tr.order-tr
 *                 td.column-1 > div ×N（商品行）
 *                     a.nuxt[title,target=_blank] > img(40×40) + div.product-info(div.product-name + div.sku)
 *                     div[style=color:#aaa]（X数量）
 *                     div（旧版模板里就是空占位）
 *                 td.column-2-4 > div（售后类型）
 *                 td.column-2-4 > div（审核状态）
 *                 td.column-2-4 > div.black > a.font-color（详情）
 *         > .el-page > .pagination（旧版 <Pagination/>，仍是 page/size 两个参数）
 *     空态 .no-result > div > img.empty-img + span.empty-text（"暂无已申请退换货订单"）
 *
 * menuList 取自旧版 Log.vue:150-153：售后申请 `/member/return/list` / 申请记录 `/member/return/log`。
 * 数据请求 `getAftersalesRecords`（page/size）保持原样，未改动请求层。
 */
export default async function ReturnLogPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const t = getServerT();
  const page = Math.max(1, Number(Array.isArray(searchParams?.page) ? searchParams?.page[0] : searchParams?.page) || 1);
  const size = 10;
  const [data, header] = await Promise.all([
    getAftersalesRecords({ page, size }).catch(() => ({ records: [], total: 0 })),
    getPcHeader().catch(() => null),
  ]);
  const pages = Math.max(1, Math.ceil(data.total / size));
  const href = (next: number) => next > 1 ? `/member/return/log?page=${next}` : '/member/return/log';

  /* 旧版 Log.vue:150-153 的 menuList */
  const menu = [
    { label: '售后申请', url: '/member/return/list' },
    { label: '申请记录', url: '/member/return/log' },
  ];

  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title={t('退款申请记录')}>
          <div className="info-row mp-return-log">
            <div className="title-or-tabs">
              <div className="tag-and-input">
                <div className="tig-tabs">
                  {menu.map((item) => (
                    <Link key={item.url} href={item.url} className={`tab${item.url === '/member/return/log' ? ' active' : ''}`}>
                      <p><span>{t(item.label)}</span></p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="page-info-body">
              {data.records.length ? (
                <>
                  {data.records.map((item, index) => (
                    <table className="order-table" key={item.aftersalesId || index}>
                      <thead>
                        <tr>
                          <th colSpan={4}>
                            {t('售后单号')}：<span className="font-color">{item.aftersalesSn || '-'}</span>
                            <span style={{ marginLeft: 30 }}>{t('订单号')}：{item.orderSn || '-'}</span>
                            <span style={{ marginLeft: 30 }}>{t('申请时间')}：{item.addTime || '-'}</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="order-tr">
                          <td className="column-1">
                            {(item.aftersalesItems || []).map((product, productIndex) => {
                              const name = product.productName || '';
                              const skuValue = (product as { skuValue?: string }).skuValue;
                              const goodsHref = product.productId ? `/product/${product.productId}` : '/search';
                              return (
                                <div key={`${item.aftersalesId || index}-${productIndex}`}>
                                  <Link title={name} href={goodsHref} className="nuxt" target="_blank">
                                    {/* 旧版 el-image：height:40px; width:40px */}
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={product.picThumb || ''}
                                      alt={name}
                                      loading="lazy"
                                      style={{ height: 40, width: 40, transition: 'opacity 0.2s linear' }}
                                    />
                                    <div className="product-info">
                                      <div className="product-name">{name}</div>
                                      {skuValue ? <div className="sku">{skuValue}</div> : null}
                                    </div>
                                  </Link>
                                  <div style={{ color: '#aaa' }}>X{product.quantity ?? 1}</div>
                                  <div></div>
                                </div>
                              );
                            })}
                          </td>
                          <td className="column-2-4">
                            <div>{item.aftersalesTypeName || '-'}</div>
                          </td>
                          <td className="column-2-4">
                            <div>{item.statusName || '-'}</div>
                          </td>
                          <td className="column-2-4">
                            <div className="black">
                              <Link className="font-color" href={`/member/return/loginfo?id=${item.aftersalesId}`}>
                                {t('详情')}
                              </Link>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  ))}
                  {pages > 1 ? (
                    <div className="el-page">
                      <div className="pagination">
                        {page > 1 ? <a href={href(page - 1)}>{'<'}</a> : <span className="is-disabled">{'<'}</span>}
                        <span className="is-active">{page}</span>
                        <span className="total">/ {pages}</span>
                        {page < pages ? <a href={href(page + 1)}>{'>'}</a> : <span className="is-disabled">{'>'}</span>}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="no-result">
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="empty-img" src="/assets/images/empty-box.png" alt="" />
                    <span className="empty-text">{t('暂无已申请退换货订单')}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}
