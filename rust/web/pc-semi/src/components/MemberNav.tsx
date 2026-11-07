'use client';

/**
 * 会员中心左侧导航（PC）
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/components/member/Nav.vue
 *
 * - 5 个分组（订单/关注/资产/客户服务/账户设置），标题可折叠（useRef 状态跨页保留语义：默认全展开）
 * - 角标：评价晒单=orderNum.awaitComment，优惠券=memberCenter.awaitCoupon；售后管理红点=awaitAftersalesCollect
 * - D1146：评价关闭隐藏「评价晒单」
 * - 跨境守卫：拼团→/member/group/list；B2B 专属项（账期支付/询价单/实名认证）隐藏
 * - 发票入口受 canInvoice / invoiceAdded 控制
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { apiGet } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
interface MenuItem {
  name: string;
  url: string;
  show: boolean;
  badge?: 'awaitComment';
  dot?: boolean;
}

interface MenuGroup {
  tit: string;
  list: MenuItem[];
}

interface ConfigBase {
  canInvoice?: number;
  invoiceAdded?: number;
  integralName?: string;
  /** D1146：商品评价总开关（关闭时隐藏「评价晒单」入口） */
  productCommentEnabled?: number;
}

const OVERSEAS = true;

export default function MemberNav() {
    const { t } = useTranslation();
  const pathname = usePathname() || '';
  const [expanded, setExpanded] = useState<boolean[]>([true, true, true, true, true]);
  const [orderNum, setOrderNum] = useState<Record<string, number>>({});
  const [awaitCoupon, setAwaitCoupon] = useState(0);
  const [config, setConfig] = useState<ConfigBase>({});

  useEffect(() => {
    fetch('/api/common/config/base')
      .then((response) => response.json())
      .then((json) => setConfig(json?.data || {}))
      .catch(() => undefined);
  }, []);

  const fetchBadges = () => {
    apiGet<Record<string, number>>('user/order/orderNum')
      .then((result) => setOrderNum(result || {}))
      .catch(() => undefined);
    apiGet<{ awaitCoupon?: number; item?: { awaitCoupon?: number } }>('user/user/memberCenter')
      .then((result) => setAwaitCoupon(Number(result?.awaitCoupon ?? result?.item?.awaitCoupon ?? 0)))
      .catch(() => undefined);
  };

  // 路由变化时重取角标（对齐原版每次页面挂载重新拉取的行为）
  useEffect(() => {
    fetchBadges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // 页面内订单/评价操作后广播 member-badges-changed，导航角标即时刷新
  useEffect(() => {
    const handler = () => fetchBadges();
    window.addEventListener('member-badges-changed', handler);
    return () => window.removeEventListener('member-badges-changed', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getBasePath = (path: string) => {
    if (path.match(/\//g)?.length === 1) return path;
    return path.slice(0, path.lastIndexOf('/'));
  };

  const activePage = (url: string) => {
    let current = pathname.split('?')[0] || pathname;
    current = current.endsWith('/') ? current.slice(0, -1) : current;
    return getBasePath(current) === getBasePath(url);
  };

  const getBadge = (item: MenuItem): number => {
    if (item.badge === 'awaitComment') return Number(orderNum.awaitComment ?? 0);
    if (item.url === '/member/coupon/list') return awaitCoupon;
    return 0;
  };

  const canInvoice = Number(config.canInvoice ?? 0) === 1;
  // D1146：商品评价总开关（对应旧版 Nav.vue:132 的 commonStore.productCommentEnabled === 1）
  const commentEnabled = Number(config.productCommentEnabled ?? 1) === 1;
  const menuList = useMemo<MenuGroup[]>(
    () => [
      {
        tit: '订单中心',
        list: [
          { name: '我的订单', url: '/member/order/list', show: true },
          { name: '我的拼团', url: OVERSEAS ? '/member/group/list' : '/member/joining/list', show: true },
          // D1146：评价功能关闭时隐藏该入口
          { name: '评价晒单', url: '/member/comment/list', show: commentEnabled, badge: 'awaitComment' },
          { name: '我的购物车', url: '/cart', show: true },
          { name: '发票申请', url: '/member/orderinvoice/list', show: canInvoice },
          { name: '增票资质', url: '/member/userinvoice/info', show: canInvoice && Number(config.invoiceAdded ?? 0) === 1 },
        ],
      },
      {
        tit: '关注中心',
        list: [
          { name: '心愿单', url: '/member/collectproduct/list', show: true },
          { name: '收藏的店铺', url: '/member/collectshop/list', show: true },
          { name: '浏览历史', url: '/member/browsinghistory/list', show: true },
        ],
      },
      {
        tit: '资产中心',
        list: [
          { name: '我的优惠券', url: '/member/coupon/list', show: true },
          // 账期支付：B2B 且开通信用支付（跨境 B2C 隐藏）
          { name: '账期支付', url: '/member/termpay/list', show: false },
          { name: '账户信息', url: '/member/account/detail', show: true },
          { name: `${config.integralName || t('积分')}明细`, url: '/member/point/list', show: true },
          { name: '礼品卡兑换', url: '/member/giftcard/exchange', show: true },
        ],
      },
      {
        tit: '客户服务',
        list: [
          { name: '售后管理', url: '/member/return/list', show: true, dot: true },
          { name: '留言/咨询', url: '/member/feedback/list', show: true },
          // 我的询价单：B2B（跨境 B2C 隐藏）
          { name: '我的询价单', url: '/member/inquiry/list', show: false },
        ],
      },
      {
        tit: '账户设置',
        list: [
          { name: '账户安全', url: '/member/security/info', show: true },
          // 会员实名认证：B2B 且开关开启（跨境 B2C 隐藏）
          { name: '会员实名认证', url: '/member/usercertification/info', show: false },
          { name: '地址', url: '/member/address/list', show: true },
        ],
      },
    ],
    [canInvoice, config.invoiceAdded, config.integralName, commentEnabled],
  );

  const toggleGroup = (idx: number) => {
    setExpanded((state) => state.map((value, index) => (index === idx ? !value : value)));
  };

  return (
    <div className="pc-member-nav">
      {menuList.map((group, groupIndex) => {
        const visible = group.list.some((item) => item.show);
        if (!visible) return null;
        return (
          <div key={group.tit} className="pc-member-nav__group">
            <div
              className={`pc-member-nav__title${expanded[groupIndex] ? '' : ' is-collapsed'}`}
              onClick={() => toggleGroup(groupIndex)}
            >
              <span>{group.tit}</span>
              <i className="pc-member-nav__arrow" />
            </div>
            <div className={`pc-member-nav__list-wrap${expanded[groupIndex] ? '' : ' is-collapsed'}`}>
              <div className="pc-member-nav__list">
                {group.list.filter((item) => item.show).map((item) => {
                  const badge = getBadge(item);
                  const dot = item.dot && Number(orderNum.awaitAftersalesCollect ?? 0) > 0;
                  return (
                    <Link
                      key={item.url}
                      href={item.url}
                      className={activePage(item.url) ? 'is-active' : ''}
                    >
                      <span className="pc-member-nav__name">{item.name}</span>
                      {badge > 0 ? <span className="pc-member-nav__badge">{badge}</span> : null}
                      {!badge && dot ? <span className="pc-member-nav__badge-dot" /> : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
