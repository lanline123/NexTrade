import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import MemberAuthGuard from '@/components/MemberAuthGuard';
import GrouponCountdown from '@/components/GrouponCountdown';
import { getGrouponRecordDetail, getGrouponItems, getPcHeader, type GrouponListItem } from '@/lib/api';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '邀请好友参团 · 万物新生' };

export default async function GroupInvitePage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
    const t = getServerT();
  const raw = searchParams?.id;
  const recordId = Number(Array.isArray(raw) ? raw[0] : raw) || 0;
  const [detail, header, grouponItems] = await Promise.all([
    recordId ? getGrouponRecordDetail(recordId).catch(() => null) : Promise.resolve(null),
    getPcHeader().catch(() => null),
    // 加盟 / 拼团商品列表：接口失败时兜底为空列表，不影响主页面渲染
    getGrouponItems({ size: 6 }).catch(() => ({ records: [] as GrouponListItem[], total: 0 })),
  ]);
  const joinUsers = detail?.joinUsers || [];
  const joined = Number(detail?.joinNumCount || joinUsers.length || 0);
  const required = Number(detail?.minGroupNum || 0);
  const remain = Math.max(0, required - joined);
  const grouponList = Array.isArray(grouponItems?.records) ? grouponItems.records : [];
  // 邀请列表：优先详情里的邀请/拼团记录，缺失时用拼团商品列表兜底
  const rawInvites = detail?.inviteRecords || detail?.recordList || detail?.joiningList;
  const inviteRecords: Array<Record<string, unknown>> = Array.isArray(rawInvites) && rawInvites.length
    ? (rawInvites as Array<Record<string, unknown>>)
    : grouponList.slice(0, 2).map((item) => ({
        grouponPromotionRecordId: item.grouponPromotionItemId,
        productId: item.productId,
        nickname: '匿名用户',
        avatar: item.picThumb,
        minGroupNum: item.minGroupNum,
        joinNumCount: item.joinNumCount,
        countdownText: '',
      }));
  // 通过链接邀请（旧版 JoiningOrderList：location.origin + /joining/groupByInvited?id=xxx）
  const invitePath = `/joining/groupByInvited?id=${recordId}`;

  return (
    <MemberAuthGuard>
      <div className="invite-page">
      <PcHeader config={header as any} />
      <main className="invite-main">
        <div className="invite-card">
          {detail ? (
            <>
              <section className="invite-product">
                <img src={detail.grouponImage || detail.picThumb || ''} alt={detail.productName || ''} />
                <div>
                  <h1>{detail.productName || t('拼团商品')}</h1>
                  <div className="invite-tag">{required} 人团 · 已有 {joined} 人参团</div>
                  <div className="invite-price">{t('拼团价：')}<b>¥ {Number(detail.minGrouponPrice || 0).toFixed(2)}</b> <s>¥ {Number(detail.productPrice || 0).toFixed(2)}</s></div>
                  {detail.shopTitle ? <div className="invite-shop">店铺：{detail.shopTitle}</div> : null}
                </div>
              </section>

              <section className="invite-status">
                <div className="invite-status__text">
                  {detail.joinStatusDesc || (Number(detail.joinStatus) === 1 ? t('拼团中') : '已成团')}
                  {Number(detail.joinStatus) === 1 ? t('，还差 {n} 人成团', { n: remain }) : ''}
                </div>
                {Number(detail.joinStatus) === 1 && detail.endTime ? (
                  <GrouponCountdown endTime={detail.endTime as string | number} />
                ) : null}
                {detail.endTime ? <div className="invite-status__time">结束时间：{detail.endTime}</div> : null}
                <div className="invite-progress"><i style={{ width: `${Math.min(100, Math.round((joined / Math.max(1, required)) * 100))}%` }} /></div>
              </section>

              <section className="invite-users">
                <h2>{t('拼团成员')}</h2>
                <div className="invite-user-list">
                  {joinUsers.length ? joinUsers.map((user, index) => (
                    <div className={`invite-user${user.leader ? ' is-leader' : ''}`} key={`${user.userId || index}`}>
                      <img src={user.avatar || ''} alt={user.nickname || ''} />
                      {user.leader ? <span className="invite-user__badge">{t('团长')}</span> : null}
                      <span>{user.nickname || t('匿名用户')}</span>
                    </div>
                  )) : <span className="invite-empty">{t('暂无成员')}</span>}
                  {remain > 0 && Number(detail.joinStatus) === 1 ? (
                    <div className="invite-user is-placeholder">
                      <div className="invite-user__placeholder">?</div>
                      <span>{t('待加入')}</span>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="invite-steps">
                <h2>{t('拼团流程')}</h2>
                <div className="invite-steps__row">
                  <div><b>1</b><span>开团/参加</span></div>
                  <i>→</i>
                  <div><b>2</b><span>{t('邀友参团')}</span></div>
                  <i>→</i>
                  <div><b>3</b><span>{t('人满成团')}</span></div>
                </div>
              </section>

              {/* 邀请列表：对照 ToJoiningList.vue「人在拼单，可直接参与」 */}
              <section className="invite-invitees">
                <h2>{inviteRecords.length} 人在拼单，可直接参与</h2>
                {inviteRecords.length ? (
                  <div className="invite-invitees__list">
                    {inviteRecords.map((record, index) => {
                      const lack = Math.max(0, Number(record.minGroupNum || 0) - Number(record.joinNumCount || 0));
                      return (
                        <div className="invite-invitee" key={index}>
                          <img src={String(record.avatar || '')} alt={String(record.nickname || t('匿名用户'))} />
                          <span className="invite-invitee__name">{String(record.nickname || record.username || t('匿名用户'))}</span>
                          <span className="invite-invitee__lack">{t('还差')}<b>{lack}</b>{t('人')}</span>
                          <span className="invite-invitee__time">{String(record.countdownText || '') ? t('剩余 {t} 结束', { t: String(record.countdownText) }) : t('已结束')}</span>
                          <Link href={`/product/${String(record.productId || detail?.productId || '')}?grouponPromotionRecordId=${String(record.grouponPromotionRecordId || recordId)}`}>{t('去参团')}</Link>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="invite-empty">{t('暂无可参与的拼团')}</p>
                )}
              </section>

              {/* 门店信息：对照 groupByInvited.vue store-section */}
              {detail.shopTitle ? (
                <section className="invite-store">
                  <span className="invite-store__name">{detail.shopTitle}</span>
                  <Link href={`/shop/${detail.shopId || ''}`}>{t('进店逛逛')}</Link>
                </section>
              ) : null}

              {/* 加盟 / 拼团商品列表：用现有 getGrouponItems，接口失败兜底为空 */}
              <section className="invite-groupon-products">
                <h2>{t('拼团商品')}</h2>
                {grouponList.length ? (
                  <div className="invite-groupon-products__grid">
                    {grouponList.map((item, index) => (
                      <Link key={item.grouponPromotionItemId || item.productId || index} href={`/product/${item.productId || ''}`} className="invite-groupon-product">
                        <img src={item.picThumb || ''} alt={item.productName || ''} />
                        <span>{item.productName || t('拼团商品')}</span>
                        <b>¥ {Number(item.grouponPrice || 0).toFixed(2)}</b>
                        <em>{Number(item.minGroupNum || 0)} 人团</em>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="invite-empty">{t('暂无拼团商品')}</p>
                )}
              </section>

              {/* 邀请好友参团动作：对照 showInviteDialog.vue「通过链接邀请」 */}
              <section className="invite-share">
                <h2>{t('通过链接邀请')}</h2>
                <p>{t('点击复制链接，发送给好友进行参团；复制失败，请手动复制。')}</p>
                <input readOnly value={invitePath} className="invite-share__link" />
                <div className="invite-share__actions">
                  <Link href={invitePath} className="is-primary">{t('邀请好友参团')}</Link>
                  <Link href={`/product/${detail.productId || ''}?grouponPromotionRecordId=${recordId}`}>{t('参与拼团')}</Link>
                </div>
              </section>

              <div className="invite-actions">
                {/* 旧版 groupByInvited.vue:296-309：带 grouponPromotionRecordId 进商详，商详据此参到指定的团 */}
                <Link
                  href={`/product/${detail.productId || ''}?grouponPromotionRecordId=${recordId}`}
                  className="is-primary"
                >{t('去参团')}</Link>
                <Link href="/member/group">{t('我的拼团')}</Link>
                {detail.shopId ? <Link href={`/shop/${detail.shopId}`}>{t('进店逛逛')}</Link> : null}
              </div>
            </>
          ) : <div className="comment-empty">{t('暂无拼团数据')}</div>}
        </div>
      </main>
      <PcFooter />
      </div>
    </MemberAuthGuard>
  );
}
