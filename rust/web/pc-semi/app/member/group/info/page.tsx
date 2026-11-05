import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import GrouponDetailActions from '@/components/GrouponDetailActions';
import GrouponCountdown from '@/components/GrouponCountdown';
import { getGrouponRecordDetail, getPcHeader } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '拼团详情 · 万物新生', robots: { index: false, follow: false } };

function money(value: unknown): string {
  return Number(value || 0).toFixed(2);
}

/** 拼团流程（源码 group/Info.vue：1.开团/参加 → 2.邀友参团 → 3.人满成团） */
const GROUP_STEPS = ['1.开团/参加', '2.邀友参团', '3.人满成团'];

export default async function GrouponInfoPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
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
  const order: any = (detail as any)?.order || {};
  const orderItems: any[] = order?.items || order?.itemList || (detail as any)?.items || [];
  const joinStatus = Number(detail?.joinStatus ?? 0);

  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <div className="pc-container">
          <nav className="pc-breadcrumb"><Link href="/">首页</Link><span>/</span><Link href="/member">会员中心</Link><span>/</span><Link href="/member/group">我的拼团</Link><span>/</span><span>拼团详情</span></nav>
          <h1 className="pc-cart-title">拼团详情</h1>
          {detail ? (
            <>
              {/* 拼团状态 + 商品 */}
              <section className="groupon-detail">
                <div className="groupon-detail__head">
                  <img src={detail.grouponImage || detail.picThumb || ''} alt={detail.productName || ''} />
                  <div className="groupon-detail__info">
                    <h2>{detail.productName || '拼团商品'}</h2>
                    <div className="groupon-detail__status">
                      拼团状态：{detail.joinStatusDesc || (joinStatus === 1 ? '拼团中' : joinStatus === 2 ? '已成团' : '已结束')}
                      {joinStatus === 1 ? `，还差 ${remain} 人成团` : ''}
                    </div>
                    <div className="groupon-detail__price">
                      拼团价：<b>¥ {money(detail.minGrouponPrice)}</b>
                      <s className="groupon-detail__origin">原价 ¥ {money(detail.productPrice)}</s>
                    </div>
                    <div className="groupon-detail__meta">
                      {required ? <span>{required} 人团</span> : null}
                      <span>已有 {joined} 人参团</span>
                      {detail.shopTitle ? <span>门店：{detail.shopTitle}</span> : null}
                      {detail.endTime ? <span>结束时间：{String(detail.endTime)}</span> : null}
                    </div>
                    {joinStatus === 1 && detail.endTime ? (
                      <GrouponCountdown endTime={detail.endTime as string | number} />
                    ) : null}
                  </div>
                </div>

                <div className="groupon-detail__progress">
                  <div className="groupon-detail__count">{joined} / {required || '-'} 人</div>
                  <div className="groupon-progress"><i style={{ width: `${Math.min(100, Math.round((joined / Math.max(1, required || 1)) * 100))}%` }} /></div>
                  <div className="groupon-detail__remain">{remain > 0 ? `还差 ${remain} 人成团` : '人满成团'}</div>
                </div>

                {/* 参团成员：团长标识 + 待加入占位 */}
                <div className="groupon-detail__users">
                  <h3>参团成员</h3>
                  <div className="groupon-users">
                    {joinUsers.map((user, index) => (
                      <div className={`groupon-user${user.leader ? ' is-leader' : ''}`} key={`${user.userId || index}`}>
                        <img src={user.avatar || ''} alt={user.nickname || '成员'} />
                        {user.leader ? <span className="groupon-user__badge">团长</span> : null}
                        <span>{user.nickname || '匿名用户'}</span>
                      </div>
                    ))}
                    {Array.from({ length: Math.min(remain, 5) }).map((_, index) => (
                      <div className="groupon-user is-placeholder" key={`pending-${index}`}>
                        <div className="groupon-user__avatar-placeholder">?</div>
                        <span>待加入</span>
                      </div>
                    ))}
                    {!joinUsers.length && !remain ? <span className="groupon-detail__empty">暂无参团成员</span> : null}
                  </div>
                </div>

                {/* 拼团流程 */}
                <div className="groupon-detail__flow">
                  <h3>拼团流程</h3>
                  <div className="groupon-flow">
                    {GROUP_STEPS.map((label, index) => (
                      <div className={`groupon-flow__item${joined >= index + 1 ? ' is-done' : ''}`} key={label}>
                        <b>{index + 1}</b>
                        <span>{label.replace(/^\d\./, '')}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="groupon-detail__actions">
                  <GrouponDetailActions
                    recordId={Number(detail.grouponPromotionRecordId || recordId) || 0}
                    endTime={detail.endTime as string | number | undefined}
                    canInvite={remain > 0 && joinStatus !== 2}
                    orderId={detail.orderId ? Number(detail.orderId) : undefined}
                  />
                  <Link href={`/product/${detail.productId || ''}`}>去参团</Link>
                  <Link href="/member/group">我的拼团</Link>
                  {detail.shopId ? <Link href={`/shop/${detail.shopId}`}>进店逛逛</Link> : null}
                </div>
              </section>

              {/* 订单信息（源码 orderFormState） */}
              {order?.orderSn || orderItems.length ? (
                <section className="member-card groupon-order">
                  <h3>订单商品</h3>
                  <div className="groupon-order__sn">
                    订单号：<strong>{order.orderSn || '-'}</strong>
                    <span>{order.orderStatusText || order.payStatusText || ''}</span>
                  </div>
                  <table className="groupon-order__table">
                    <thead>
                      <tr>
                        <th>商品名称</th>
                        <th>商品价格</th>
                        <th>购买数量</th>
                        <th>小计</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderItems.map((item, index) => (
                        <tr key={`${item.orderItemId || index}`}>
                          <td>
                            <div className="groupon-order__product">
                              <img src={item.picThumb || item.productPicThumb || ''} alt={item.productName || ''} />
                              <span>{item.productName || '商品'}</span>
                            </div>
                          </td>
                          <td>¥ {money(item.price)}</td>
                          <td>{Number(item.num || item.quantity || 0)}</td>
                          <td>¥ {money(item.subtotal ?? Number(item.price || 0) * Number(item.num || item.quantity || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="groupon-order__amounts">
                    <div><span>商品总价</span><b>¥ {money(order.productAmount)}</b></div>
                    {Number(order.shippingFee || 0) > 0 ? <div><span>运费</span><b>+ ¥ {money(order.shippingFee)}</b></div> : null}
                    {Number(order.serviceFee || 0) > 0 ? <div><span>附加费用</span><b>+ ¥ {money(order.serviceFee)}</b></div> : null}
                    {Number(order.couponAmount || 0) > 0 ? <div className="is-discount"><span>优惠券优惠</span><b>- ¥ {money(order.couponAmount)}</b></div> : null}
                    {Number(order.discountAmount || 0) > 0 ? <div className="is-discount"><span>其他优惠</span><b>- ¥ {money(order.discountAmount)}</b></div> : null}
                    {Number(order.pointsAmount || 0) > 0 ? <div className="is-discount"><span>积分抵扣</span><b>- ¥ {money(order.pointsAmount)}</b></div> : null}
                    {Number(order.balance || 0) > 0 ? <div className="is-discount"><span>使用余额</span><b>- ¥ {money(order.balance)}</b></div> : null}
                    {Number(order.unpaidAmount || 0) > 0 ? <div><span>待支付金额</span><b>¥ {money(order.unpaidAmount)}</b></div> : null}
                    <div className="groupon-order__total"><span>实付款</span><b>¥ {money(order.totalAmount)}</b></div>
                  </div>
                </section>
              ) : null}
            </>
          ) : <div className="comment-empty">暂无拼团数据</div>}
        </div>
      </main>
      <PcFooter />
    </>
  );
}
