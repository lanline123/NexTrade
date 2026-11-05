import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import MemberAuthGuard from '@/components/MemberAuthGuard';
import GrouponCountdown from '@/components/GrouponCountdown';
import { getGrouponRecordDetail, getPcHeader } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '邀请好友参团 · 万物新生' };

export default async function GroupInvitePage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const raw = searchParams?.id;
  const recordId = Number(Array.isArray(raw) ? raw[0] : raw) || 0;
  const [detail, header] = await Promise.all([
    recordId ? getGrouponRecordDetail(recordId).catch(() => null) : Promise.resolve(null),
    getPcHeader().catch(() => null),
  ]);
  const joinUsers = detail?.joinUsers || [];
  const joined = Number(detail?.joinNumCount || joinUsers.length || 0);
  const required = Number(detail?.minGroupNum || 0);
  const remain = Math.max(0, required - joined);

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
                  <h1>{detail.productName || '拼团商品'}</h1>
                  <div className="invite-tag">{required} 人团 · 已有 {joined} 人参团</div>
                  <div className="invite-price">拼团价：<b>¥ {Number(detail.minGrouponPrice || 0).toFixed(2)}</b> <s>¥ {Number(detail.productPrice || 0).toFixed(2)}</s></div>
                  {detail.shopTitle ? <div className="invite-shop">店铺：{detail.shopTitle}</div> : null}
                </div>
              </section>

              <section className="invite-status">
                <div className="invite-status__text">
                  {detail.joinStatusDesc || (Number(detail.joinStatus) === 1 ? '拼团中' : '已成团')}
                  {Number(detail.joinStatus) === 1 ? `，还差 ${remain} 人成团` : ''}
                </div>
                {Number(detail.joinStatus) === 1 && detail.endTime ? (
                  <GrouponCountdown endTime={detail.endTime as string | number} />
                ) : null}
                {detail.endTime ? <div className="invite-status__time">结束时间：{detail.endTime}</div> : null}
                <div className="invite-progress"><i style={{ width: `${Math.min(100, Math.round((joined / Math.max(1, required)) * 100))}%` }} /></div>
              </section>

              <section className="invite-users">
                <h2>拼团成员</h2>
                <div className="invite-user-list">
                  {joinUsers.length ? joinUsers.map((user, index) => (
                    <div className={`invite-user${user.leader ? ' is-leader' : ''}`} key={`${user.userId || index}`}>
                      <img src={user.avatar || ''} alt={user.nickname || ''} />
                      {user.leader ? <span className="invite-user__badge">团长</span> : null}
                      <span>{user.nickname || '匿名用户'}</span>
                    </div>
                  )) : <span className="invite-empty">暂无成员</span>}
                  {remain > 0 && Number(detail.joinStatus) === 1 ? (
                    <div className="invite-user is-placeholder">
                      <div className="invite-user__placeholder">?</div>
                      <span>待加入</span>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="invite-steps">
                <h2>拼团流程</h2>
                <div className="invite-steps__row">
                  <div><b>1</b><span>开团/参加</span></div>
                  <i>→</i>
                  <div><b>2</b><span>邀友参团</span></div>
                  <i>→</i>
                  <div><b>3</b><span>人满成团</span></div>
                </div>
              </section>

              <div className="invite-actions">
                <Link href={`/product/${detail.productId || ''}`} className="is-primary">去参团</Link>
                <Link href="/member/group">我的拼团</Link>
                {detail.shopId ? <Link href={`/shop/${detail.shopId}`}>进店逛逛</Link> : null}
              </div>
            </>
          ) : <div className="comment-empty">暂无拼团数据</div>}
        </div>
      </main>
      <PcFooter />
      </div>
    </MemberAuthGuard>
  );
}
