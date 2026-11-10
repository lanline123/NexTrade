import type { Metadata } from 'next';
import { Fragment } from 'react';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import MemberShell from '@/components/MemberShell';
import PinGroupTime from '@/components/PinGroupTime';
import { getGrouponRecordDetail, getPcHeader } from '@/lib/api';
import { getServerT } from '@/i18n/server';

import { formatPrice } from '@/lib/currency';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '拼团详情 · 万物新生', robots: { index: false, follow: false } };

function money(value: unknown): string {
  return Number(value || 0).toFixed(2);
}

/**
 * 拼团详情（独立页）
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/pin/Group.vue
 * 结构与类名逐条照抄：
 *   CommonPageContainer.group-info-body > .group-info
 *     > .title         > .title-info > (h2 / .wire / .info)
 *     > .user          > .avatar-list(.avatar-container > .circle > img + .tips + .group-line)
 *                      + .avatar-list(.username) + .message + .tig-button.theme-button.big-button
 *     > .time          > div × 3
 * 旧版这一页没有左侧 MemberNav、也没有请求（模板里是假数据），所以用 MemberShell 的 noNav；
 * 数据取自 getGrouponRecordDetail，查不到时留空。
 */
export default async function PinGroupPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const t = getServerT();
  const raw = searchParams?.id || searchParams?.grouponPromotionRecordId;
  const recordId = Number(Array.isArray(raw) ? raw[0] : raw) || 0;
  const [detail, header] = await Promise.all([
    recordId ? getGrouponRecordDetail(recordId).catch(() => null) : Promise.resolve(null),
    getPcHeader().catch(() => null),
  ]);

  const joinUsers = detail?.joinUsers || [];
  const joined = Number(detail?.joinNumCount || joinUsers.length || 0);
  const required = Number(detail?.minGroupNum || 0);
  const remain = Math.max(0, required - joined);
  const groupPrice = Number(detail?.minGrouponPrice || 0);
  const singlePrice = Number(detail?.productPrice || 0);
  const save = Math.max(0, singlePrice - groupPrice);

  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title={t('拼团详情')} noNav>
          <div className="mp-pin-group">
            <div className="group-info-body">
              <div className="group-info">
                <div className="title">
                  <div className="title-info">
                    <div>
                      <h2>{detail?.productName || t('拼团商品')}</h2>
                    </div>
                    <div className="wire"></div>
                    <div className="info">
                      {required || 2} {t('人团，拼团价')}：
                      <span style={{ color: '#ED3B3B', fontSize: '30px', fontWeight: 700 }}>{formatPrice(groupPrice)}</span>
                      {t('单购价')}：
                      <span style={{ color: '#333', fontSize: '14px', fontWeight: 'normal' }}>{formatPrice(singlePrice)}</span>
                      ，{t('组团采购省')}
                      <span style={{ color: '#ED3B3B', fontSize: '14px' }}>{formatPrice(save)}</span>
                      ，{' '}
                      <Link href={detail?.productId ? `/product/${detail.productId}` : '/member/pin/list'} style={{ textDecoration: 'underline' }}>
                        {t('查看商品详情')}
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="user">
                  <div className="avatar-list">
                    {joinUsers.map((user, index) => (
                      <Fragment key={`avatar-${user.userId || index}`}>
                        <div className="avatar-container">
                          <div className="circle">
                            <img src={user.avatar || ''} alt={user.nickname || ''} />
                            {index === 0 ? <div className="tips">{t('团长')}</div> : null}
                          </div>
                        </div>
                        {index < joinUsers.length - 1 ? <div className="group-line"></div> : null}
                      </Fragment>
                    ))}
                  </div>
                  <div className="avatar-list">
                    {joinUsers.map((user, index) => (
                      <Fragment key={`name-${user.userId || index}`}>
                        <div className="username">{user.nickname || t('匿名用户')}</div>
                        {index < joinUsers.length - 1 ? <div style={{ width: '60px' }}></div> : null}
                      </Fragment>
                    ))}
                  </div>
                  <div className="message">
                    {t('还差')} <span className="red">{remain}</span> {t('人就成团啦，盼来盼去我在盼着你出现！')}
                  </div>
                  <div className="tig-button theme-button big-button">{t('邀请好友参团')}</div>
                  <div>
                    {t('开团并邀请好友参团，或等系统推荐陌生人参团，组团成功立即发货。详情见')}
                    <Link href="/member/group" style={{ textDecoration: 'underline' }}>{t('拼团玩法')}</Link>
                  </div>
                </div>

                <PinGroupTime endTime={detail?.endTime as string | number | undefined} />
              </div>
            </div>
          </div>
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}
