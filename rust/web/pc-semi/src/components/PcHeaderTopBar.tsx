'use client';

/**
 * PC 头部顶部条（源码：PcHeaderTopBarRuntime.vue）
 *
 * 结构与源码逐段对齐：
 * .benefit-bar-wrap > .pc-header-container > .benefit-bar(--simple/--only-right)
 *   ├ .benefit-bar__left：地区选择 / 会员入口（简约风）
 *   ├ .benefit-bar__content：跨境风优惠提示（benefitNoticeGroups，静态每组首条）
 *   └ .benefit-bar__right：购物车 / 会员中心 / 消息与订单 / 站点导航
 *
 * 源码使用 el-popover 与图标字体；React 版用 hover 状态 + 绝对定位卡片、
 * IconPark 图标渲染，保留源码类名与开关口径（showBenefitBar/showTopMenuBar/...）。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import Local from '@icon-park/react/es/icons/Local';
import Message from '@icon-park/react/es/icons/Message';
import FileText from '@icon-park/react/es/icons/FileText';
import PcHeaderNoticeCarousel from '@/components/PcHeaderNoticeCarousel';
import PcSmartLink from '@/components/PcSmartLink';

interface Region {
  regionId: number | string;
  regionName: string;
}

interface NavItem {
  id?: number;
  title?: string;
  link?: any;
  children?: NavItem[];
}

interface NoticeItem {
  picId?: number | string;
  picThumb?: string;
  picUrl?: string;
  picTitle?: string;
  picDesc?: string;
  picLink?: { link?: string };
}

interface NoticeGroup {
  notices?: NoticeItem[];
}

interface MemberCenterItem {
  picTitle?: string;
  title?: string;
  picLink?: { link?: string };
  link?: string;
}

function readNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function readString(value: unknown, fallback: string): string {
  const text = String(value ?? '');
  return text ? text : fallback;
}

function noticePic(notice?: NoticeItem | null): string {
  return notice?.picUrl || notice?.picThumb || '';
}

function noticeTitle(notice?: NoticeItem | null): string {
  return String(notice?.picTitle || '');
}

function noticeDesc(notice?: NoticeItem | null): string {
  return String(notice?.picDesc || '');
}

function noticeLink(notice?: NoticeItem | null): string {
  return String(notice?.picLink?.link || '');
}

function hasNoticeContent(notice?: NoticeItem | null): boolean {
  return Boolean(noticePic(notice) || noticeTitle(notice) || noticeDesc(notice));
}

function navHref(link: any): string {
  if (!link) return '';
  if (typeof link === 'string') return link;
  return link.link || link.appLink || '';
}

export default function PcHeaderTopBar({
  config = {},
  styleType = 2,
  isWhite = true,
  wide = false,
  baseConfig = null,
}: {
  config?: Record<string, any>;
  styleType?: 1 | 2;
  isWhite?: boolean;
  wide?: boolean;
  /** 服务端预取的站点配置（shopRegClosed），避免顶部条再等一次客户端请求 */
  baseConfig?: Record<string, any> | null;
}) {
  const { t } = useTranslation();
  const [regions, setRegions] = useState<Region[]>([]);
  const [regionId, setRegionId] = useState<string>('');
  const [regionOpen, setRegionOpen] = useState(false);
  const [user, setUser] = useState<Record<string, any> | null>(null);
  const [siteNav, setSiteNav] = useState<NavItem[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [shopRegClosed, setShopRegClosed] = useState(Number(baseConfig?.shopRegClosed ?? 0));
  const [openMenu, setOpenMenu] = useState<'user' | 'member' | 'site' | null>(null);
  const hoverTimer = useRef<number | null>(null);

  const showBenefitBar = readNumber(config.showBenefitBar, 1) !== 0;
  const showTopMenuBar = readNumber(config.showTopMenuBar, 1) !== 0;
  const showTopRegion = readNumber(config.showTopRegion, 1) !== 0;
  const showTopUserMenu = readNumber(config.showTopUserMenu, 1) !== 0;
  const showTopMemberCenterEnabled = readNumber(config.showTopMemberCenter, 1) !== 0;
  const showTopMemberName = readNumber(config.showTopMemberName, 1) !== 0;
  const showTopMessage = readNumber(config.showTopMessage, 1) !== 0;
  const showTopOrders = readNumber(config.showTopOrders, 1) !== 0;
  const showTopSiteNav = readNumber(config.showTopSiteNav, 1) !== 0;
  const showTopMenuCart = readNumber(config.topMenuCartShow, 1) !== 0;

  useEffect(() => {
    fetch('/api/common/pc/getNav')
      .then((response) => response.json())
      .then((json) => setSiteNav(Array.isArray(json?.data?.topBarNav) ? json.data.topBarNav : []))
      .catch(() => undefined);

    if (!baseConfig) {
      fetch('/api/common/config/base')
        .then((response) => response.json())
        .then((json) => setShopRegClosed(Number(json?.data?.shopRegClosed ?? 0)))
        .catch(() => undefined);
    }

    const cookieId = document.cookie.match(/(?:^|; )userProvinceId=([^;]+)/)?.[1] || '';
    const listRequest = fetch('/api/sys/region/getProvinceList').then((response) => response.json());
    if (cookieId) {
      setRegionId(cookieId);
      listRequest
        .then((json) => setRegions(Array.isArray(json?.data) ? json.data : []))
        .catch(() => undefined);
    } else {
      Promise.all([listRequest, fetch('/api/sys/region/getUserRegion').then((response) => response.json())])
        .then(([regionJson, userRegionJson]) => {
          setRegions(Array.isArray(regionJson?.data) ? regionJson.data : []);
          const id = userRegionJson?.data?.regionId ?? userRegionJson?.regionId;
          if (id !== undefined && id !== null) setRegionId(String(id));
        })
        .catch(() => undefined);
    }

    const token = localStorage.getItem('accessToken');
    if (token) {
      fetch('/api/user/user/detail', { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })
        .then((response) => response.json())
        .then((json) => setUser(json?.data || null))
        .catch(() => undefined);
      fetch('/api/cart/cart/list', { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })
        .then((response) => response.json())
        .then((json) => setCartCount(Number(json?.data?.total?.totalCount || 0)))
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    };
  }, []);

  const regionDisplayText = useMemo(() => {
    const selected = regions.find((item) => String(item.regionId) === regionId);
    return String(selected?.regionName || config.topRegionText || t('全国'));
  }, [regions, regionId, config.topRegionText, t]);

  const memberCenterItems: Array<{ title: string; link: string }> = useMemo(() => {
    const configured = config.memberCenterItems;
    if (Array.isArray(configured)) {
      const mapped = configured
        .map((item: MemberCenterItem) => {
          const link = item?.picLink?.link || item?.link || '';
          const isCouponLink = String(link).replace(/\/$/, '') === '/member/coupon/list';
          return {
            title: isCouponLink ? t('我的优惠券') : item?.picTitle || item?.title || '',
            link,
          };
        })
        .filter((item) => item.title);
      if (mapped.length) return mapped;
    }
    return [
      { title: t('我的足迹'), link: '/member/browsingHistory/list' },
      { title: t('我的优惠券'), link: '/member/coupon/list' },
    ];
  }, [config.memberCenterItems, t]);

  const effectiveShowTopSiteNav = showTopSiteNav && siteNav.length > 0;
  const userDisplayName = String(user?.nickname || user?.dimUsername || t('会员'));
  const userAvatar = String(user?.avatar || '');

  const benefitNoticeGroups: NoticeGroup[] = useMemo(() => {
    const raw = Array.isArray(config.benefitNoticeGroups) ? (config.benefitNoticeGroups as NoticeGroup[]) : [];
    return raw
      .map((group) => ({ ...group, notices: (Array.isArray(group?.notices) ? group.notices : []).filter(hasNoticeContent) }))
      .filter((group) => (group.notices?.length ?? 0) > 0);
  }, [config.benefitNoticeGroups]);

  const showBenefitContent = styleType === 2 && showBenefitBar && benefitNoticeGroups.length > 0;
  const showTopMemberEntry = styleType === 1 && showTopMemberName;
  const showTopUserLinks =
    styleType === 1 && showTopMenuBar && showTopUserMenu && (showTopMessage || showTopOrders);
  const showTopMemberCenter = styleType === 1 && showTopMenuBar && showTopUserMenu && showTopMemberCenterEnabled;
  const showStripLeft = styleType === 1 && (showTopRegion || showTopMemberEntry);
  const showStripRight =
    styleType === 2
      ? effectiveShowTopSiteNav || showTopMenuCart
      : effectiveShowTopSiteNav || showTopMenuCart || showTopMemberCenter || showTopUserLinks;
  const showTopBar = showBenefitBar && (showStripLeft || showStripRight || showBenefitContent);
  const isBenefitBarOnlyRight = showStripRight && !showStripLeft && !showBenefitContent;

  /* 顶部条与首页模块共用同一套宽度口径（--pc-home-*，见 globals.scss :root）：
     1920 视口下内容区 198~1722。原先 wide 分支的 1760/80 会让内容区偏离，
     这里统一收敛；wide 仅保留给地区选择器的 .wide 类名（视觉缩进）。 */
  const containerStyle: React.CSSProperties = {
    maxWidth: 'var(--pc-home-max-width, 1600px)',
    minWidth: 'var(--pc-home-min-width, 0px)',
    width: '100%',
    margin: '0 auto',
    paddingLeft: 'var(--pc-home-padding-x, 38px)',
    paddingRight: 'var(--pc-home-padding-x, 38px)',
  };
  const wrapStyle: React.CSSProperties = config.benefitBarBackgroundColor
    ? { backgroundColor: String(config.benefitBarBackgroundColor) }
    : {};
  const topMenuTextStyle: React.CSSProperties = {
    color: readString(config.topMenuTextColor, '#ffffffd6'),
    ['--pc-header-top-menu-hover-color' as string]: readString(config.topMenuTextHoverColor, '#ffffff'),
  };
  const benefitTitleStyle: React.CSSProperties = {
    color: readString(config.benefitTitleColor || config.topMenuTextColor, '#ffffff'),
  };
  const benefitDescStyle: React.CSSProperties = {
    color: readString(config.benefitDescColor || config.topMenuTextColor, '#ffffffcc'),
  };

  const selectRegion = (region: Region) => {
    setRegionId(String(region.regionId));
    document.cookie = `userProvinceId=${region.regionId}; path=/; max-age=31536000; SameSite=Lax`;
    setRegionOpen(false);
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    document.cookie = 'accessToken=; path=/; max-age=0';
    window.location.href = '/';
  };

  const scheduleClose = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setOpenMenu(null), 120);
  };
  const cancelClose = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
  };

  if (!showTopBar) return null;

  return (
    <div
      className={`benefit-bar-wrap${styleType === 1 ? ' benefit-bar-wrap--simple' : ''}`}
      style={wrapStyle}
    >
      <div className="pc-header-container" style={containerStyle}>
        <div
          className={`benefit-bar${styleType === 1 ? ' benefit-bar--simple' : ''}${
            isBenefitBarOnlyRight ? ' benefit-bar--only-right' : ''
          }`}
        >
          {/* 左侧：地区 / 会员入口（简约风） */}
          {showStripLeft ? (
            <div className="benefit-bar__left" style={topMenuTextStyle}>
              {showTopRegion ? (
                <div
                  className={`benefit-bar__location${regionOpen ? ' is-active' : ''}${wide ? ' wide' : ''}`}
                  style={topMenuTextStyle}
                  onMouseEnter={() => setRegionOpen(true)}
                  onMouseLeave={() => setRegionOpen(false)}
                >
                  <span className="iconfont-pc icon-dizhi benefit-bar__location-ico">
                    <Local size={14} />
                  </span>
                  <span className="benefit-bar__region">{regionDisplayText}</span>
                  {regionOpen && regions.length > 0 ? (
                    <div
                      className="region-dropdown"
                      onMouseEnter={() => setRegionOpen(true)}
                      onMouseLeave={() => setRegionOpen(false)}
                    >
                      <div className="region-dropdown__list">
                        {regions.map((region) => (
                          <a
                            key={region.regionId}
                            className={`region-dropdown__item${String(region.regionId) === regionId ? ' selected' : ''}`}
                            onClick={() => selectRegion(region)}
                          >
                            {region.regionName}
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {showTopMemberEntry ? (
                user ? (
                  <div
                    className="top-link-item top-link-item--menu"
                    onMouseEnter={() => {
                      cancelClose();
                      setOpenMenu('user');
                    }}
                    onMouseLeave={scheduleClose}
                  >
                    <div className="top-link top-link--nav" style={topMenuTextStyle}>
                      <Link className="top-link__name" href="/member/">
                        {userDisplayName}
                      </Link>
                      <span className="pc-icon pc-icon--arrow top-bar-nav__arrow" aria-hidden="true" />
                    </div>
                    {openMenu === 'user' ? (
                      <div className="pc-header-popover pc-header-popover--member">
                        <div className="top-member-dropdown">
                          <div className="top-member-dropdown__profile">
                            <div className="top-member-dropdown__avatar-wrap">
                              {userAvatar ? (
                                <img className="top-member-dropdown__avatar" src={userAvatar} alt="" />
                              ) : (
                                <span className="top-member-dropdown__avatar top-member-dropdown__avatar--placeholder">
                                  {userDisplayName.slice(0, 1)}
                                </span>
                              )}
                            </div>
                            <div className="top-member-dropdown__main">
                              <div className="top-member-dropdown__name" title={userDisplayName}>
                                {userDisplayName}
                              </div>
                              <div className="top-member-dropdown__actions">
                                <Link href="/member">{t('账号管理')}</Link>
                                <span className="top-member-dropdown__divider" />
                                <a onClick={logout}>{t('退出')}</a>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="top-link-item top-link-item--auth">
                    <Link className="top-link" href="/member/login">
                      {t('你好,请登录')}
                    </Link>
                    {shopRegClosed === 0 ? (
                      <>
                        <span className="top-link-sep" />
                        <Link className="top-link" href="/member/register">
                          {t('注册')}
                        </Link>
                      </>
                    ) : null}
                  </div>
                )
              ) : null}
            </div>
          ) : null}

          {/* 中间：跨境风优惠提示（每组多条时竖向滚动切换，对齐源码 .pc-carousel） */}
          {showBenefitContent ? (
            <div className="benefit-bar__content" style={topMenuTextStyle}>
              {benefitNoticeGroups.map((group, groupIndex) => (
                <div className="tag-wrap" key={groupIndex}>
                  <PcHeaderNoticeCarousel
                    notices={(group.notices || []).map((item) => ({
                      pic: noticePic(item),
                      title: noticeTitle(item),
                      desc: noticeDesc(item),
                      href: noticeLink(item),
                    }))}
                    titleColor={benefitTitleStyle.color as string}
                    descColor={benefitDescStyle.color as string}
                  />
                </div>
              ))}
            </div>
          ) : null}

          {/* 右侧：购物车 / 消息与订单 / 站点导航 */}
          {showStripRight ? (
            <div className="benefit-bar__right" style={topMenuTextStyle}>
              {showTopMenuCart ? (
                <Link href="/cart/" className="top-link top-link--cart">
                  <span className="pc-icon pc-icon--cart top-link__ico" aria-hidden="true" />
                  <span className="top-link__txt">
                    {t('购物车')}
                    {cartCount > 0 ? ` ${cartCount}` : ''}
                  </span>
                </Link>
              ) : null}

              {showTopMemberCenter ? (
                <div
                  className="top-site-nav-wrap top-member-center"
                  onMouseEnter={() => {
                    cancelClose();
                    setOpenMenu('member');
                  }}
                  onMouseLeave={scheduleClose}
                >
                  <a className="top-link top-link--nav">
                    <span className="top-bar-nav__name">{t('会员中心')}</span>
                    <span className="pc-icon pc-icon--arrow top-bar-nav__arrow" aria-hidden="true" />
                  </a>
                  {openMenu === 'member' ? (
                    <div className="pc-header-popover">
                      <div className="top-site-nav__dropdown">
                        {memberCenterItems.map((item, itemIndex) => (
                          <Link key={itemIndex} href={item.link || '#'}>
                            {item.title}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {showTopUserLinks ? (
                <div className="top-links">
                  {showTopMessage ? (
                    <Link className="top-link top-link--icon" href="/member/userMessage/list/">
                      <span className="iconfont-pc icon-xiaoxi">
                        <Message size={15} />
                      </span>
                      <span>{t('站内消息')}</span>
                    </Link>
                  ) : null}
                  {showTopOrders ? (
                    <Link className="top-link top-link--icon" href="/member/order/list/">
                      <span className="iconfont-pc icon-dingdan">
                        <FileText size={15} />
                      </span>
                      <span>{t('我的订单')}</span>
                    </Link>
                  ) : null}
                </div>
              ) : null}

              {effectiveShowTopSiteNav ? (
                <div
                  className="top-site-nav-wrap"
                  onMouseEnter={() => {
                    cancelClose();
                    setOpenMenu('site');
                  }}
                  onMouseLeave={scheduleClose}
                >
                  <a className="top-link top-link--nav">
                    <span className="top-bar-nav__name">{t('站点导航')}</span>
                    <span className="pc-icon pc-icon--arrow top-bar-nav__arrow" aria-hidden="true" />
                  </a>
                  {openMenu === 'site' ? (
                    <div className="pc-header-popover">
                      <div className="top-site-nav__dropdown">
                        {siteNav.map((nav) => (
                          <SiteNavNode key={nav.id ?? nav.title} nav={nav} />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** 站点导航节点：有子级时平铺子级链接（对齐源码 CommonLink 列表） */
function SiteNavNode({ nav }: { nav: NavItem }) {
  const children = Array.isArray(nav.children) ? nav.children : [];
  if (children.length) {
    return (
      <>
        {children.map((child) => (
          <PcSmartLink key={child.id ?? child.title} href={navHref(child.link)}>
            {child.title}
          </PcSmartLink>
        ))}
      </>
    );
  }
  return <PcSmartLink href={navHref(nav.link)}>{nav.title}</PcSmartLink>;
}

