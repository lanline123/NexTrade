'use client';

/**
 * 我的拼团（PC 会员中心右侧内容区）—— Semi Design 现代化版
 *
 * 功能 1:1 保留（源码对照 view/pc/components/member/joining/JoiningOrderList.vue + showInviteDialog.vue）：
 * - 两个 Tab（我发起的团 / 我参与的团 → joinType 1/2，isMine=true）
 * - 卡片：拼团状态 Tag + 成团进度条（还差 N 人）+ 订单详情
 * - 信息：订单号 / 下单时间 / 共 N 件 / 拼团价 / 支付方式
 * - 拼团中：邀请好友（复制链接弹窗）；拼团详情入口
 * - Semi Pagination（自带省略号）+ Skeleton 加载 + Empty 空态
 *
 * 后端缺口备注（与旧版一致，前端兜底）：
 * 1. 旧实现读的 grouponStatusText/statusText/recordId/productId 后端列表 VO 均不下发，
 *    统一按 GrouponRecordVO 的 camelCase 字段取值。
 * 2. dateType 故意不传：生产 build-146 的 date_range(1) 仍是「今日」（Rust 已修，待部署）。
 * 3. VO 暂缺 productId/quantity/seoLink：商品链接回落 productSn，数量回落 1。
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Empty, Input, Modal, Pagination, Progress, Skeleton, Tabs, Tag, Toast } from '@douyinfe/semi-ui';
import { apiGet } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';

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
/** 状态 → Semi Tag 色 */
const STATUS_TAG: Record<number, 'orange' | 'green' | 'red'> = { 1: 'orange', 2: 'green', 3: 'red' };
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
  const { t } = useTranslation();
  const router = useRouter();
  const go = (href: string) => router.push(href);
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
        Toast.error({ content: error instanceof Error ? error.message : t('拼团列表加载失败') });
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, joinType]);

  const openInvite = (recordId: number) => {
    setInviteLink(`${window.location.origin}/joining/groupbyinvited?id=${recordId}`);
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      Toast.success({ content: t('复制成功') });
      setInviteLink('');
    } catch {
      Toast.error({ content: t('复制失败，请手动复制') });
    }
  };

  return (
    <div className="mgl">
      {/* 工具条：Tab 切换（我发起的团 / 我参与的团） */}
      <div className="mgl-toolbar">
        <Tabs
          type="button"
          activeKey={String(joinType)}
          onChange={(key) => {
            setPage(1);
            setJoinType(Number(key));
          }}
        >
          {TABS.map((tab) => (
            <Tabs.TabPane key={String(tab.joinType)} itemKey={String(tab.joinType)} tab={t(tab.label)} />
          ))}
        </Tabs>
      </div>

      <div className="mgl-body">
        {loading ? (
          <div className="mgl-skeleton">
            {[0, 1, 2].map((index) => (
              <div key={index} className="mgl-skeleton__card">
                <Skeleton active loading placeholder={<Skeleton.Paragraph rows={4} style={{ padding: '16px 16px 8px' }} />} />
              </div>
            ))}
          </div>
        ) : rows.length ? (
          rows.map((item, index) => {
            const recordId = Number(item.grouponPromotionRecordId || 0);
            const status = Number(item.joinStatus || 0);
            const statusText = item.joinStatusDesc || STATUS_TEXT[status] || t('拼团中');
            const joined = Number(item.joinNumCount || 0);
            const need = Math.max(0, Number(item.minGroupNum || 0) - joined);
            const percent = Math.min(100, Math.round((joined / Math.max(1, Number(item.minGroupNum || 1))) * 100));
            const qty = Number(item.quantity || 1);
            const price = item.grouponPrice ?? item.minGrouponPrice ?? 0;
            const href = productHref(item);
            const orderHref = item.orderId ? `/member/order/info?id=${item.orderId}` : '';
            return (
              <div className="mgl-card" key={`${recordId}-${index}`}>
                {/* 头：状态 Tag + 还差 N 人 + 订单详情 */}
                <div className="mgl-card__head">
                  <div className="mgl-card__head-left">
                    <Tag color={STATUS_TAG[status] || 'grey'}>{statusText}</Tag>
                    {status === 1 ? (
                      <span className="mgl-card__remain">{t('还差 {{count}} 人成团', { count: need })}</span>
                    ) : null}
                  </div>
                  {orderHref ? (
                    <Link className="mgl-card__detail" href={orderHref} target="_blank">
                      {t('订单详情')}
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M4 2.5L7.5 6L4 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </Link>
                  ) : null}
                </div>

                {/* 成团进度（拼团中） */}
                {status === 1 ? (
                  <div className="mgl-card__progress">
                    <Progress
                      percent={percent}
                      showInfo
                      format={() => `${joined}/${Math.max(1, Number(item.minGroupNum || 1))}`}
                      stroke="var(--semi-color-warning)"
                      aria-label={t('成团进度')}
                    />
                  </div>
                ) : null}

                {/* 商品行 */}
                <div className="mgl-card__items">
                  <div className="mgl-item">
                    <Link href={href} target="_blank" className="mgl-item__picwrap">
                      <img className="mgl-item__pic" src={item.picThumb || ''} alt={item.productName || ''} loading="lazy" />
                    </Link>
                    <div className="mgl-item__main">
                      <Link href={href} target="_blank" className="mgl-item__name">
                        <span className="mgl-item__name-text">{item.productName || t('拼团商品')}</span>
                      </Link>
                      {item.startTime || item.endTime ? (
                        <div className="mgl-item__time">
                          {item.startTime ? <span>{t('开团时间')} {item.startTime}</span> : null}
                          {item.endTime ? <span>{t('截止')} {item.endTime}</span> : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="mgl-item__right">
                      <Link href={href} target="_blank">
                        <span className="mgl-item__price">¥{money(price)}</span>
                      </Link>
                      <span className="mgl-item__qty">×{qty}</span>
                    </div>
                  </div>
                </div>

                {/* 信息行 + 操作 */}
                <div className="mgl-card__foot">
                  <div className="mgl-card__meta">
                    <span>
                      {t('订单号')}：
                      {orderHref ? (
                        <Link href={orderHref} target="_blank">{item.orderSn || '-'}</Link>
                      ) : (
                        item.orderSn || '-'
                      )}
                    </span>
                    <span>{t('下单时间')}：{item.orderAddTime || '-'}</span>
                    {item.payTypeId ? <span>{PAY_TYPE_TEXT[Number(item.payTypeId)] || t('线下支付')}</span> : null}
                  </div>
                  <div className="mgl-card__actions">
                    {status === 1 ? (
                      <Button theme="solid" type="primary" onClick={() => openInvite(recordId)}>{t('邀请好友')}</Button>
                    ) : null}
                    <Button theme="light" onClick={() => go(`/member/group/info?id=${recordId}`)}>{t('拼团详情')}</Button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="mgl mgl--state">
            <Empty title={t('当前筛选下还没有任何拼团')} description={t('发起或参与一个拼团，这里会展示进度')} />
            <Button theme="solid" type="primary" onClick={() => go('/')}>{t('去选购')}</Button>
          </div>
        )}
      </div>

      {total > size ? (
        <div className="mgl-pager">
          <Pagination total={total} pageSize={size} currentPage={page} onPageChange={(next) => setPage(next)} />
        </div>
      ) : null}

      <Modal
        title={t('通过链接邀请')}
        visible={Boolean(inviteLink)}
        okText={t('复制链接')}
        cancelText={t('关闭')}
        onOk={() => {
          void copyInvite();
        }}
        onCancel={() => setInviteLink('')}
      >
        <Input value={inviteLink} disabled />
      </Modal>
    </div>
  );
}
