'use client';

/**
 * 我的拼团（PC 会员中心右侧内容区）
 *
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/components/member/joining/JoiningOrderList.vue
 *          + .../src/showInviteDialog.vue
 *          + .../JoiningOrderList.v1.vue（支付方式字段）
 * 页面壳：pages/member/group/List.vue（TopJumpBar + 左 MemberNav + 右 JoiningOrderList）
 * 接口：GET /api/promotion/groupon/record/list → Rust `GrouponRecordVO`
 *
 * 对齐点（parity 修复）：
 * - 标题「我的拼团」+ 两个 Tab（我发起的团 / 我参与的团 → joinType 1/2，isMine=true）
 * - 卡片头部：拼团状态 + 还差 N 人 + 「订单详情」
 * - 卡片信息行：订单号 / 下单时间 / 共 N 件 / 拼团价 / 支付方式
 * - 卡片商品行：图 / 商品名 / 单价 / 数量
 * - 卡片底部：邀请好友（仅拼团中，复制链接弹窗）/ 拼团详情
 * - 分页 + 空态文案
 *
 * 注意：
 * 1. 旧实现读的 `grouponStatusText` / `statusText` / `recordId` / `productId` 后端列表 VO
 *    均不下发，导致状态永远显示「拼团中」、商品链接跳 /product/ 空路径。这里统一按
 *    `GrouponRecordVO` 的 camelCase 字段取值。
 * 2. 暂不传 dateType：Java `DateTypeEnum` 里 `1 = 最近三个月订单`，而生产
 *    build-146 的 `date_range(1)` 仍是「今日」。Rust 源码已按 DateTypeEnum 修复，
 *    但生产未部署前前端传 1 会把列表过滤成当天数据。待后端部署后改回
 *    `dateType: 1` 才能恢复原版默认（近三个月）。
 * 3. 后端列表 VO 暂缺 `productId` / `quantity` / `seoLink`（Java 有）：商品链接回落
 *    `productSn`，数量回落 1。后端补齐后前端无需改动即可自动生效。
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Input, Modal, Spin, Toast } from '@douyinfe/semi-ui';
import { apiGet } from '@/lib/client-api';

interface GrouponRecord {
  grouponPromotionRecordId?: number;
  grouponPromotionItemId?: number;
  grouponPromotionId?: number;
  productId?: number;
  productName?: string;
  productSn?: string | number;
  seoLink?: string;
  picThumb?: string;
  quantity?: number;
  grouponPrice?: string | number;
  minGrouponPrice?: string | number;
  productPrice?: string | number;
  minGroupNum?: number;
  joinNumCount?: number;
  joinStatus?: number;
  joinStatusDesc?: string;
  orderSn?: string;
  orderId?: number;
  orderAddTime?: string;
  payTypeId?: number;
  startTime?: string;
  endTime?: string;
  [key: string]: unknown;
}

const TABS = [
  { joinType: 1, label: '我发起的团' },
  { joinType: 2, label: '我参与的团' },
] as const;

/** 后端 joinStatusDesc 缺失时的兜底，对齐原版 joinStatusName。 */
const STATUS_TEXT: Record<number, string> = { 1: '拼团中', 2: '拼团成功', 3: '拼团失败' };
/** 对齐 JoiningOrderList.v1.vue 的 payTypeId 文案。 */
const PAY_TYPE_TEXT: Record<number, string> = { 1: '在线支付', 2: '货到付款', 3: '线下支付' };

function money(value: unknown): string {
  return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 原版 urlFormat({ path: 'product', seoLink, sn })；Rust 商品页按最后一段（点号后为 SN）解析。 */
function productHref(item: GrouponRecord): string {
  if (item.seoLink && item.productSn) return `/product/${item.seoLink}.${item.productSn}`;
  if (item.productSn) return `/product/${item.productSn}`;
  if (item.productId) return `/product/${item.productId}`;
  return '/search';
}

export default function MyGrouponClient() {
  const [rows, setRows] = useState<GrouponRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [joinType, setJoinType] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [inviteLink, setInviteLink] = useState('');
  const size = 10;

  useEffect(() => {
    setLoading(true);
    apiGet<{ records?: GrouponRecord[]; total?: number }>('promotion/groupon/record/list', {
      page,
      size,
      joinType,
      isMine: true,
      joining: 1,
      // dateType 故意不传，见文件头注释 2
    })
      .then((result) => {
        setRows(Array.isArray(result?.records) ? result.records : []);
        setTotal(Number(result?.total || 0));
      })
      .catch((error) => {
        setRows([]);
        setTotal(0);
        Toast.error({ content: error instanceof Error ? error.message : '拼团列表加载失败' });
      })
      .finally(() => setLoading(false));
  }, [page, joinType]);

  const pages = Math.max(1, Math.ceil(total / size));

  const openInvite = (recordId: number) => {
    setInviteLink(`${window.location.origin}/joining/groupByInvited?id=${recordId}`);
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      Toast.success({ content: '复制成功' });
      setInviteLink('');
    } catch {
      Toast.error({ content: '复制失败，请手动复制' });
    }
  };

  return (
    <div className="member-orders pc-groupon-list">
      <div className="pc-order-panel">
        <div className="pc-order-panel__head">
          <div className="pc-groupon-list__title">我的拼团</div>
          <div className="member-orders__tabs">
            {TABS.map((tab) => (
              <button
                key={tab.joinType}
                type="button"
                className={joinType === tab.joinType ? 'is-active' : ''}
                onClick={() => {
                  setPage(1);
                  setJoinType(tab.joinType);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pc-order-panel__body">
          {loading ? (
            <div className="member-orders__loading"><Spin size="large" /></div>
          ) : rows.length ? (
            <div className="member-orders__list">
              {rows.map((item, index) => {
                const recordId = Number(item.grouponPromotionRecordId || 0);
                const status = Number(item.joinStatus || 0);
                const statusText = item.joinStatusDesc || STATUS_TEXT[status] || '拼团中';
                const remain = Math.max(0, Number(item.minGroupNum || 0) - Number(item.joinNumCount || 0));
                const qty = Number(item.quantity || 1);
                const price = item.grouponPrice ?? item.minGrouponPrice ?? 0;
                const href = productHref(item);
                const orderHref = item.orderId ? `/member/order/info?id=${item.orderId}` : '';
                return (
                  <article className="member-order pc-groupon-card" key={`${recordId}-${index}`}>
                    <header className="member-order__head">
                      <span className={`member-order__status is-g${status}`}>{statusText}</span>
                      {status === 1 ? <span className="pc-groupon-card__remain">（还差 {remain} 人）</span> : null}
                      <span className="pc-groupon-card__spacer" />
                      {orderHref ? (
                        <Link className="member-order__detail" href={orderHref} target="_blank">
                          订单详情
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M4 2.5L7.5 6L4 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </Link>
                      ) : null}
                    </header>

                    <div className="pc-groupon-card__meta">
                      <span>
                        订单号：
                        {orderHref
                          ? <Link href={orderHref} target="_blank">{item.orderSn || '-'}</Link>
                          : (item.orderSn || '-')}
                      </span>
                      <span>下单时间：{item.orderAddTime || '-'}</span>
                      <span>共 {qty} 件</span>
                      <span>拼团价：<b>¥ {money(price)}</b></span>
                      {item.payTypeId ? <span>{PAY_TYPE_TEXT[Number(item.payTypeId)] || '线下支付'}</span> : null}
                    </div>

                    <div className="member-order__shop">
                      <Link href={href} target="_blank" className="member-order__shop-main">
                        <img src={item.picThumb || ''} alt={item.productName || ''} />
                        <div className="member-order__shop-text">
                          <div className="member-order__shop-name">{item.productName || '拼团商品'}</div>
                        </div>
                      </Link>
                      <div className="member-order__shop-price">
                        <Link href={href} target="_blank">¥ {money(price)}</Link>
                        <Link href={href} target="_blank"><span className="member-order__qty">×{qty}</span></Link>
                      </div>
                    </div>

                    <footer className="member-order__foot">
                      <div className="member-order__total pc-groupon-card__period">
                        {item.startTime ? <span>开团时间 {item.startTime}</span> : null}
                        {item.endTime ? <span>截止 {item.endTime}</span> : null}
                      </div>
                      <div className="member-order__bot-actions">
                        {status === 1 ? (
                          <Button size="small" theme="solid" type="primary" onClick={() => openInvite(recordId)}>邀请好友</Button>
                        ) : null}
                        <Link href={`/member/group/info?id=${recordId}`} target="_blank"><Button size="small">拼团详情</Button></Link>
                      </div>
                    </footer>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="member-orders__empty">
              <p className="member-orders__empty-title">当前筛选下还没有任何订单哦!</p>
              <p className="member-orders__empty-sub">现在就去：<Link href="/">选购商品</Link></p>
            </div>
          )}
        </div>

        {pages > 1 ? (
          <div className="pc-order-panel__foot">
            <div className="pc-pagination">
              {Array.from({ length: pages }).map((_, index) => (
                <button key={index} type="button" className={index + 1 === page ? 'is-active' : ''} onClick={() => setPage(index + 1)}>
                  {index + 1}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <Modal
        title="通过链接邀请"
        visible={Boolean(inviteLink)}
        okText="复制链接"
        cancelText="关闭"
        onOk={() => { void copyInvite(); }}
        onCancel={() => setInviteLink('')}
      >
        <Input value={inviteLink} disabled />
      </Modal>
    </div>
  );
}
