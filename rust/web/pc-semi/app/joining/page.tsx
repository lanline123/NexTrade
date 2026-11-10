import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeaderWithData';
import PcFooter from '@/components/PcFooter';
import GrouponCountdown from '@/components/GrouponCountdown';
import { getGrouponBanners, getGrouponItems, getPcHeader } from '@/lib/api';

import { getServerT } from '@/i18n/server';
import { formatPrice } from '@/lib/currency';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '拼团 · 万物新生', description: '拼团活动商品列表。' };

/**
 * 拼团列表。
 * 源码对照：view/pc/pages/joining/List.vue（外壳）
 *          + components/common/JoiningGoodsList.vue（商品网格）
 * 样式：app/join-page.scss → .pg-joining-list / .pg-joining-goods-list
 *
 *   页头 → .seckill-con > .inner.container（轮播 slogan）→ .container.joining-content
 *        > JoiningGoodsList：.goods-list__box > .goods-list-c > .wrap
 *             > .item > a > .g-item-warp > .pic(.pic-img + .countdown) + .titleBox + .priceBox
 *          + .pagination > .el-pagination
 */
interface PageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

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

function read(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export default async function JoiningPage({ searchParams }: PageProps) {
  const t = getServerT();
  const page = Math.max(1, Number(read(searchParams?.page)) || 1);
  const keyword = read(searchParams?.keyword);
  const size = 20;
  const [banners, data, header] = await Promise.all([
    getGrouponBanners().catch(() => [] as string[]),
    getGrouponItems({ page, size, keyword }).catch(() => ({ records: [], total: 0 })),
    getPcHeader().catch(() => null),
  ]);
  const pages = Math.max(1, Math.ceil(data.total / size));
  const href = (next: number) => (next > 1 ? `/joining?page=${next}` : '/joining');

  return (
    <div className="pg-joining-list">
      <PcHeader config={header as any} />

      {banners.length ? (
        <div className="seckill-con">
          <div className="inner container">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="item-img" src={banners[0]} alt={t('拼团活动')} />
          </div>
        </div>
      ) : null}

      <div className="container joining-content">
        <div className="pg-joining-goods-list">
          <div className={`goods-list__box${data.records.length ? '' : ' goods-list__box--empty'}`}>
            <div className="goods-list-c">
              <div className="wrap">
                {data.records.map((item, index) => {
                  const ended = Boolean((item as any).countdownText) === false;
                  const restricted = item.canJoin === false;
                  return (
                    <div className="item" key={`${item.productId || item.grouponPromotionItemId || index}`}>
                      <Link href={`/product/${item.productId || ''}`} target="_blank">
                        <div className="g-item-warp">
                          <div className="pic">
                            <div className="pic-img">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img className="ease" src={item.picThumb || ''} alt={item.productName || ''} loading="lazy" />
                            </div>
                            <div className="countdown">
                              <div className="title">{t('拼团')}</div>
                              <div className="countdown-time">
                                <div className="time">{ended ? t('已结束') : t('距结束')}</div>
                                {ended ? null : (
                                  <div className="text">
                                    <GrouponCountdown endTime={item.endTime as string | number | undefined} />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="titleBox">
                            <div className="tag">
                              {maxGroupNum(item.groupNum) || item.minGroupNum || 2}
                              {t('人团')}
                            </div>
                            <div className="title">{item.productName}</div>
                          </div>
                          <div className="priceBox">
                            <div className="priceBoxNum">
                              <span className="minGrouponPrice">{formatPrice(Number(item.grouponPrice || 0))}</span>
                              <div className="old">{formatPrice(Number(item.productPrice || 0))}</div>
                            </div>
                            <div
                              className="text"
                              title={restricted ? String(item.restrictTip || t('仅限指定会员参与')) : ''}
                              style={restricted ? { background: '#b7b7b7' } : undefined}
                            >
                              {restricted ? t('仅限会员') : t('拼')}
                            </div>
                          </div>
                        </div>
                      </Link>
                    </div>
                  );
                })}

                {!data.records.length ? (
                  <div className="search-empty">
                    <div className="bd">
                      <h4>{t('好狠的筛选条件啊，把相关的商品都埋没了！')}</h4>
                      <p>{t('建议您')}</p>
                      <p>{t('1、适当减少筛选条件')}</p>
                      <p>{t('2、调整价格区间')}</p>
                      <p>{t('3、尝试其他关键字')}</p>
                      <Link href="/joining" className="el-button graybtn mt10">
                        {t('返回上一步')}
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {pages > 1 ? (
            <div className="pagination">
              <nav className="el-pagination">
                {page > 1 ? (
                  <Link href={href(page - 1)} className="btn-prev">
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
                    <Link href={href(next)} className="number" key={next}>
                      {next}
                    </Link>
                  );
                })}
                {page < pages ? (
                  <Link href={href(page + 1)} className="btn-next">
                    {'>'}
                  </Link>
                ) : (
                  <span className="btn-next disabled">{'>'}</span>
                )}
              </nav>
            </div>
          ) : null}
        </div>
      </div>

      <PcFooter />
    </div>
  );
}
