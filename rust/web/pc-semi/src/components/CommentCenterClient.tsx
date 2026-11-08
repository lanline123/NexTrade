'use client';

/**
 * 评价晒单（PC 会员中心）—— Semi Design 现代化版
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/comment/List.vue
 *
 * 功能 1:1 保留：
 * - 三个 Tab（待评价 / 待晒单 / 晒单评价）+ subNum 角标
 *   待评价(0)：GET user/order/list {commentStatus:0}；待晒单(1)：user/comment/showedList {isShowed:0}；
 *   已评价(2)：user/comment/list
 * - D1146 评价总开关：关闭时页面保留、内容区空态；?orderType= 初始化 Tab
 * - 待评价/待晒单：订单卡（订单号/下单时间/商品行/收货人/总额/去评价或待晒单入口）
 * - 已评价：MemberCommentList 卡片流（星级/标签/晒图预览/客服答复）
 * - Semi Pagination + Skeleton + Empty
 *
 * 角标口径说明：Tab 角标来自 user/comment/subNum；左侧会员导航角标来自
 * user/order/orderNum.awaitComment——两者都由「已完成且未评价」订单驱动。
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Empty, Image, Pagination, Rating, Skeleton, Tabs, Tag, Toast } from '@douyinfe/semi-ui';
import { apiGet } from '@/lib/client-api';
import MemberCommentList, { MemberCommentItem } from '@/components/MemberCommentList';

import { useTranslation } from 'react-i18next';

type TabKey = 'pending' | 'showed' | 'commented';

interface OrderItem {
  productId?: number;
  productName?: string;
  productSn?: string;
  picThumb?: string;
  productImage?: string;
  quantity?: number;
  price?: number | string;
  skuData?: Array<{ name?: string; value?: string }>;
}

interface OrderRow {
  orderId?: number;
  orderSn?: string;
  addTime?: string;
  consignee?: string;
  totalAmount?: number | string;
  items?: OrderItem[];
}

interface CommentReply {
  commentId?: number;
  content?: string;
  addTime?: string;
  kefuName?: string;
}

interface CommentRow {
  productId?: number;
  productName?: string;
  picThumb?: string;
  commentRank?: number;
  content?: string;
  addTime?: string;
  status?: number;
  statusText?: string;
  username?: string;
  commentTag?: string[];
  skuData?: Array<{ name?: string; value?: string }>;
  showPics?: Array<{ picUrl?: string; picThumb?: string }>;
  replies?: CommentReply[];
  kefuName?: string;
  isShowed?: number;
}

interface SubNum {
  awaitComment?: number;
  showPics?: number;
  commented?: number;
}

const TABS: Array<{ key: TabKey; label: string; orderType: number }> = [
  { key: 'pending', label: '待评价', orderType: 0 },
  { key: 'showed', label: '待晒单', orderType: 1 },
  { key: 'commented', label: '晒单评价', orderType: 2 },
];

function money(value: unknown): string {
  return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 规格数据 → 文本（与订单列表 skuText 保持一致，兼容对象/字符串数组） */
function skuText(sku: OrderItem['skuData']): string {
  if (!Array.isArray(sku)) return '';
  return sku
    .map((item) => (item?.name || item?.value ? `${item.name ?? ''}${item.name && item.value ? '：' : ''}${item.value ?? ''}` : ''))
    .filter(Boolean)
    .join('；');
}

export default function CommentCenterClient({ initialTab }: { initialTab?: TabKey }) {
  const { t } = useTranslation();
  const router = useRouter();
  const go = (href: string) => router.push(href);
  const [tab, setTab] = useState<TabKey>(initialTab && TABS.some((item) => item.key === initialTab) ? initialTab : 'pending');
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [subNum, setSubNum] = useState<SubNum>({});
  const [commentEnabled, setCommentEnabled] = useState<number | null>(null);
  const size = 10;

  useEffect(() => {
    // D1146：评价总开关（对应旧版 commonStore.productCommentEnabled）
    fetch('/api/common/config/base')
      .then((response) => response.json())
      .then((json) => setCommentEnabled(Number(json?.data?.productCommentEnabled ?? 1)))
      .catch(() => setCommentEnabled(1));
  }, []);

  const loadSubNum = () => {
    apiGet<SubNum>('user/comment/subNum')
      .then((result) => setSubNum(result || {}))
      .catch(() => setSubNum({}));
  };

  useEffect(() => {
    // D1146：开关关闭时不取数，页面直接呈现空态
    if (commentEnabled === 0) {
      setLoading(false);
      return;
    }
    if (commentEnabled === null) return;
    loadSubNum();
  }, [commentEnabled]);

  useEffect(() => {
    if (commentEnabled !== 1) return;
    setLoading(true);
    const path = tab === 'pending' ? 'user/order/list' : tab === 'showed' ? 'user/comment/showedList' : 'user/comment/list';
    const params = tab === 'pending' ? { page, size, commentStatus: 0 } : { page, size, isShowed: tab === 'showed' ? 0 : undefined };
    apiGet<{ records?: Array<OrderRow & CommentRow>; total?: number }>(path, params)
      .then((result) => {
        const rows = Array.isArray(result?.records) ? result.records : [];
        if (tab === 'commented') {
          setComments(rows as CommentRow[]);
          setOrders([]);
        } else {
          setOrders(rows as OrderRow[]);
          setComments([]);
        }
        setTotal(Number(result?.total || 0));
      })
      .catch((error) => {
        setOrders([]);
        setComments([]);
        Toast.error({ content: error instanceof Error ? error.message : t('评价列表加载失败') });
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, commentEnabled]);

  const countOf = (key: TabKey) =>
    key === 'pending'
      ? Number(subNum.awaitComment || 0)
      : key === 'showed'
        ? Number(subNum.showPics || 0)
        : Number(subNum.commented || 0);

  return (
    <div className="mcc">
      {/* 工具条：三 Tab + 角标 */}
      <div className="mcc-toolbar">
        <Tabs
          type="button"
          activeKey={tab}
          onChange={(key) => {
            setPage(1);
            setTab(key as TabKey);
          }}
        >
          {TABS.map((item) => (
            <Tabs.TabPane
              key={item.key}
              itemKey={item.key}
              tab={
                <span className="mol-tab">
                  {t(item.label)}
                  {countOf(item.key) > 0 ? <span className="mol-tab__num">{countOf(item.key)}</span> : null}
                </span>
              }
            />
          ))}
        </Tabs>
      </div>

      {commentEnabled === 0 ? (
        /* D1146：评价功能关闭时保留页面、内容区换空态 */
        <div className="mcc mcc--state">
          <Empty title={t('评价功能已关闭')} description={t('如需评价商品，请联系商家开启评价功能')} />
        </div>
      ) : (
        <div className="mcc-body">
          {loading ? (
            <div className="mcc-skeleton">
              {[0, 1, 2].map((index) => (
                <div key={index} className="mcc-skeleton__card">
                  <Skeleton active loading placeholder={<Skeleton.Paragraph rows={3} style={{ padding: '16px 16px 8px' }} />} />
                </div>
              ))}
            </div>
          ) : tab === 'commented' ? (
            <MemberCommentList comments={comments as MemberCommentItem[]} />
          ) : orders.length ? (
            orders.map((item, index) => (
              <div className="mcc-card" key={item.orderId || index}>
                <div className="mcc-card__head">
                  <div className="mcc-card__head-left">
                    <span className="mcc-card__label">{t('订单号')}：</span>
                    <Link className="mcc-card__sn" href={`/member/order/info?id=${item.orderId || ''}`} target="_blank">
                      {item.orderSn}
                    </Link>
                    {item.addTime ? <span className="mcc-card__time">{item.addTime}</span> : null}
                  </div>
                  <Link className="mcc-card__detail" href={`/member/order/info?id=${item.orderId || ''}`} target="_blank">
                    {t('订单详情')}
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M4 2.5L7.5 6L4 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </Link>
                </div>

                <div className="mcc-card__items">
                  {(item.items || []).map((product, productIndex) => (
                    <div className="mcc-item" key={`${product.productId || productIndex}-${productIndex}`}>
                      <Link
                        className="mcc-item__picwrap"
                        href={product.productId ? `/product/${product.productId}` : '/search'}
                        target="_blank"
                        title={product.productName || ''}
                      >
                        <img
                          className="mcc-item__pic"
                          src={product.picThumb || product.productImage || ''}
                          alt={product.productName || ''}
                          loading="lazy"
                        />
                      </Link>
                      <div className="mcc-item__main">
                        <Link
                          className="mcc-item__name"
                          href={product.productId ? `/product/${product.productId}` : '/search'}
                          target="_blank"
                        >
                          <span className="mol-item__name-text">{product.productName}</span>
                        </Link>
                        {skuText(product.skuData) ? <div className="mcc-item__sku">{skuText(product.skuData)}</div> : null}
                      </div>
                      <div className="mcc-item__right">
                        <span className="mcc-item__qty">×{product.quantity}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mcc-card__foot">
                  <div className="mcc-card__meta">
                    <span>{t('收货人')}：{item.consignee || '-'}</span>
                    <span>
                      {t('订单总额')}：
                      <b className="mcc-card__amount">¥{money(item.totalAmount)}</b>
                    </span>
                  </div>
                  <div className="mcc-card__actions">
                    <Button theme="solid" type="primary" onClick={() => go(`/member/comment/info?id=${item.orderId || ''}`)}>
                      {tab === 'pending' ? t('去评价') : t('待晒单')}
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="mcc mcc--state">
              <Empty title={t('当前筛选下还没有任何订单')} description={t('去逛逛，发现心仪商品')} />
              <Button theme="solid" type="primary" onClick={() => go('/')}>{t('去选购')}</Button>
            </div>
          )}

          {total > size ? (
            <div className="mol-pager">
              <Pagination total={total} pageSize={size} currentPage={page} onPageChange={(next) => setPage(next)} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
