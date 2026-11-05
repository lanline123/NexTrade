import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import GrouponDetailActions from '@/components/GrouponDetailActions';
import { getGrouponRecordDetail, getPcHeader } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '拼团详情 · 万物新生', robots: { index: false, follow: false } };

export default async function GrouponInfoPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const raw = searchParams?.id || searchParams?.grouponPromotionRecordId;
  const recordId = Number(Array.isArray(raw) ? raw[0] : raw) || 0;
  const [detail, header] = await Promise.all([
    recordId ? getGrouponRecordDetail(recordId).catch(() => null) : Promise.resolve(null),
    getPcHeader().catch(() => null),
  ]);
  const joinUsers = detail?.joinUsers || [];
  const remain = Math.max(0, Number(detail?.minGroupNum || 0) - Number(detail?.joinNumCount || joinUsers.length || 0));

  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <div className="pc-container">
          <nav className="pc-breadcrumb"><Link href="/">首页</Link><span>/</span><Link href="/member">会员中心</Link><span>/</span><Link href="/member/group">我的拼团</Link><span>/</span><span>拼团详情</span></nav>
          <h1 className="pc-cart-title">拼团详情</h1>
          {detail ? (
            <section className="groupon-detail">
              <div className="groupon-detail__head">
                <img src={detail.grouponImage || detail.picThumb || ''} alt={detail.productName || ''} />
                <div className="groupon-detail__info">
                  <h2>{detail.productName || '拼团商品'}</h2>
                  <div className="groupon-detail__status">{detail.joinStatusDesc || (Number(detail.joinStatus) === 1 ? '拼团中' : '已成团')}</div>
                  <div className="groupon-detail__price">拼团价：<b>¥ {Number(detail.minGrouponPrice || 0).toFixed(2)}</b></div>
                  <div className="groupon-detail__price">原价：¥ {Number(detail.productPrice || 0).toFixed(2)}</div>
                  {detail.shopTitle ? <div className="groupon-detail__shop">店铺：{detail.shopTitle}</div> : null}
                  {detail.endTime ? <div className="groupon-detail__shop">结束时间：{detail.endTime}</div> : null}
                </div>
              </div>

              <div className="groupon-detail__progress">
                <div className="groupon-detail__count">{detail.joinNumCount || joinUsers.length || 0} / {detail.minGroupNum || 0} 人</div>
                <div className="groupon-progress"><i style={{ width: `${Math.min(100, Math.round(((Number(detail.joinNumCount || joinUsers.length || 0) / Math.max(1, Number(detail.minGroupNum || 1))) * 100)))}%` }} /></div>
                <div className="groupon-detail__remain">{remain > 0 ? `还差 ${remain} 人成团` : '已成团'}</div>
              </div>

              <div className="groupon-detail__users">
                <h3>参团成员</h3>
                <div className="groupon-users">
                  {joinUsers.length ? joinUsers.map((user, index) => (
                    <div className="groupon-user" key={`${user.userId || index}`}>
                      <img src={user.avatar || ''} alt={user.nickname || '成员'} />
                      <span>{user.nickname || '匿名用户'}</span>
                    </div>
                  )) : <span className="groupon-detail__empty">暂无参团成员</span>}
                </div>
              </div>

              <div className="groupon-detail__actions">
                <GrouponDetailActions
                  recordId={Number(detail.grouponPromotionRecordId || recordId) || 0}
                  endTime={detail.endTime as string | number | undefined}
                  canInvite={remain > 0 && Number(detail.joinStatus) !== 2}
                  orderId={detail.orderId ? Number(detail.orderId) : undefined}
                />
                <Link href={`/product/${detail.productId || ''}`}>商品详情</Link>
              </div>
            </section>
          ) : <div className="comment-empty">暂无拼团信息</div>}
        </div>
      </main>
      <PcFooter />
    </>
  );
}
