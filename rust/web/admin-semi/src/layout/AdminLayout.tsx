import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Avatar, Badge, Button, Dropdown, Input, Tooltip } from '@douyinfe/semi-ui';
import {
  IconBell,
  IconExit,
  IconHelpCircle,
  IconMenu,
  IconRefresh,
  IconSearch,
  IconShoppingBag,
  IconUserGroup,
  IconUserSetting,
} from '@douyinfe/semi-icons';
// 语言切换图标：IconPark 的 Translate（outline），对齐跨境版 LocaleSwitcher 的纯图标形态。
// 深度导入单个图标文件（而非 import { Translate } from '@icon-park/react'），
// 避免把整包 2000+ 图标的入口一起拉进依赖图，打包体积更可控。
import Translate from '@icon-park/react/es/icons/Translate';
import { navGroups, pageTitles } from '../config/adminMenu';
import { navGroupsForRole } from '../config/selfServiceMenu';
import MenuSearch from '../components/MenuSearch';
import AdminMessageCenter from '../components/AdminMessageCenter';
import LicensedBadge from '../components/LicensedBadge';
import SelectShopModal from '../components/SelectShopModal';
import VoiceBroadcast from '../components/VoiceBroadcast';
import VoiceBroadcastTip from '../components/VoiceBroadcastTip';
import { useI18n } from '../i18n';
import { translatedLocales } from '../i18n/config';
import { fetchUnreadSummary, startAdminMsgStream } from '../sse';
import { dispatchVoiceDeltas, loadVoiceSettings } from '../voice';

export type PageKey = string;

const NAV_ORDER_KEY = 'admin_nav_order_v1';
const defaultOrder = [
  'panel',
  'pos',
  'organize',
  'live',
  'product',
  'promotion',
  'order',
  'supplyChain',
  'customerService',
  'decorate',
  'salesman',
  'content',
  'finance',
  'user',
  'authority',
  'wholesale',
  'setting',
];

function loadNavOrder(): string[] {
  const allKeys = navGroups.map((group) => group.key);
  let stored: string[] = [];
  try {
    const raw = localStorage.getItem(NAV_ORDER_KEY);
    stored = raw ? JSON.parse(raw) : [];
  } catch {
    stored = [];
  }
  const valid = stored.filter((key) => allKeys.includes(key));
  return [...valid, ...defaultOrder.filter((key) => !valid.includes(key))];
}

interface AdminLayoutProps {
  page: PageKey;
  layout?: string;
  logo?: string;
  onPageChange: (page: PageKey) => void;
  onLogout: () => void;
  children: ReactNode;
}

export default function AdminLayout({ page, layout = 'default', logo, onPageChange, onLogout, children }: AdminLayoutProps) {
  const { locale, setLocale, t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [msgCount, setMsgCount] = useState(0);
  /** 「新订单 N」角标：口径 = is_broadcast=1 且 send_time >= lastOpenTime 的新订单消息数（同原版 MsgCount.vue） */
  const [newOrderCount, setNewOrderCount] = useState(0);
  /** 自增以强制重建 SSE 连接（原版 initSSE：换新的 startTime 必须重连才生效） */
  const [streamEpoch, setStreamEpoch] = useState(0);
  const [messageVisible, setMessageVisible] = useState(false);
  const prevVoiceCount = useRef<Record<string, number> | null>(null);
  const [orderedKeys, setOrderedKeys] = useState<string[]>(loadNavOrder);
  const orderedRef = useRef(orderedKeys);
  const pressTimer = useRef<number | null>(null);
  const dragKeyRef = useRef<string | null>(null);
  const suppressClickRef = useRef(false);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);

  /**
   * 刷新「新订单」统计基准（对齐原版 MsgCount.vue::markAsRead / handleDialogClose）。
   * 后端 newOrderMsgCount 是 `send_time >= lastOpenTime` 的窗口计数，
   * 不更新这个时间戳的话计数永远不会归零，角标会常驻。
   */
  const writeLastOpenTime = () => {
    try {
      localStorage.setItem('lastOpenTime', String(Math.floor(Date.now() / 1000)));
    } catch {
      // localStorage 不可用时忽略，角标最多不归零
    }
  };

  /** 重连消息 SSE（原版 initSSE）：清空播报基线，避免跨连接误判语音增量 */
  const restartMsgStream = () => {
    prevVoiceCount.current = null;
    setStreamEpoch((value) => value + 1);
  };

  /**
   * 一级菜单宽度随多语言文案自适应（rail 用 max-content）。
   * 顶部栏的 logo 区与左侧留白要跟着让位，这里用 ResizeObserver 实测宽度
   * 写入 CSS 变量 --rail-width，避免顶部栏与侧栏错位。
   */
  const railRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const apply = () => {
      const width = Math.round(el.getBoundingClientRect().width);
      if (width > 0) {
        document.documentElement.style.setProperty('--rail-width', `${width}px`);
      }
    };
    apply();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', apply);
      return () => window.removeEventListener('resize', apply);
    }
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, [collapsed, locale]);

  /**
   * 未读兜底轮询（本项目的补充，原版没有）。
   * 单独一个 effect：不能挂在 streamEpoch 上，否则每次重连都会立刻拉一次 homeSummary，
   * 把「点击消息后刚清零的红点」马上用旧值顶回去。
   */
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void fetchUnreadSummary().then((count) => {
        if (alive && count !== null) setMsgCount(count);
      });
    };
    refresh();
    const pollTimer = window.setInterval(refresh, 30000);
    return () => {
      alive = false;
      window.clearInterval(pollTimer);
    };
  }, []);

  /** 消息计数 SSE（streamEpoch 变化 = 原版 initSSE 重连） */
  useEffect(() => {
    const stop = startAdminMsgStream({
      onCount: (count) => {
        setMsgCount(Number(count.unreadMsgCount) || 0);
        setNewOrderCount(Number(count.newOrderMsgCount) || 0);
        const voiceSettings = loadVoiceSettings();
        dispatchVoiceDeltas(prevVoiceCount.current, count as unknown as Record<string, number>, voiceSettings, (type) => {
          if (voiceSettings.popupEnabled) {
            window.dispatchEvent(new CustomEvent('admin-voice-popup', { detail: type }));
          }
        });
        prevVoiceCount.current = count as unknown as Record<string, number>;
      },
    });
    return () => stop();
  }, [streamEpoch]);

  useEffect(() => {
    orderedRef.current = orderedKeys;
  }, [orderedKeys]);

  /** 全量菜单（含角色专属组）：商户端/供应商端登录后在平台组后追加自己的自助页面组。 */
  const roleNavGroups = useMemo(() => navGroupsForRole(localStorage.getItem('adminType')), []);

  const groups = useMemo(() => {
    const ordered = orderedKeys
      .map((key) => roleNavGroups.find((group) => group.key === key))
      .filter(Boolean) as typeof navGroups;
    // 角色专属组（shopCapital 等）不在 localStorage 排序里，追加到末尾，
    // 否则会被 loadNavOrder 的平台组 key 过滤掉而永远不显示。
    const extra = roleNavGroups.filter((group) => !orderedKeys.includes(group.key));
    return [...ordered, ...extra];
  }, [orderedKeys, roleNavGroups]);

  const activeGroup =
    groups.find((group) =>
      group.items.some(
        (item) => item.key === page || item.children?.some((child) => child.key === page),
      ),
    ) || groups[0];

  const activeParent = activeGroup.items.find(
    (item) => item.key === page || item.children?.some((child) => child.key === page),
  );
  const hasThirdLevel = Boolean(activeParent?.children?.length);

  const mallUrl = import.meta.env.VITE_MALL_URL || (import.meta.env.DEV ? 'http://127.0.0.1:3004/' : '/');
  /**
   * 「切换组织」显示条件 —— 对齐跨境版 MsgCount.vue 的
   * `v-if="isMerchant() || isS2b2c() || isStore()"`。
   *
   * 跨境版是「多商户 + 供应商 + 非多门店」构建（.env.production:
   * VITE_IS_MERCHANT=1 / VITE_IS_VENDOR=1 / VITE_IS_STORE=0），
   * 即只要版本具备多商户或供应商能力就显示该入口。
   *
   * 原来这里写的是 `adminType !== 'admin'`，会导致平台管理员账号永远看不到
   * 「切换组织」，而这正是需要切组织的场景，属于条件写反。
   * 版本能力默认按跨境版（多商户 + 供应商）视为开启，可用 Vite 变量覆盖。
   */
  const isMerchantBuild = import.meta.env.VITE_IS_MERCHANT ?? '1';
  const isVendorBuild = import.meta.env.VITE_IS_VENDOR ?? '1';
  const isStoreBuild = import.meta.env.VITE_IS_STORE ?? '0';
  const showSwitchOrg =
    isMerchantBuild === '1' || isVendorBuild === '1' || isStoreBuild === '1';

  /** 窄屏判定：与 styles.css 里隐藏 .topbar-text-btn 的 1280px 断点保持一致 */
  const [isNarrowScreen, setIsNarrowScreen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 1280,
  );
  useEffect(() => {
    const onResize = () => setIsNarrowScreen(window.innerWidth <= 1280);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /**
   * 切换组织弹窗 —— 对齐跨境版 MsgCount.vue 的 `switchShop()`：
   * 点击后打开 SelectShop 弹窗，由弹窗列出「管理后台 / 店铺 / 门店 / 供应商」
   * 供用户选择，选中后写 localStorage 并 reload。
   * （原来这里只是清空 localStorage 直接 reload，等于把用户踢回组织选择页，
   *   与"切换组织"语义不符。）
   */
  const [orgModalVisible, setOrgModalVisible] = useState(false);
  const switchOrganization = () => setOrgModalVisible(true);

  const clearCache = () => {
    localStorage.removeItem('admin_nav_order_v1');
    localStorage.removeItem('lastOpenTime');
    window.location.reload();
  };

  /**
   * 打开消息中心（对齐原版 MsgCount.vue::markAsRead）。
   * 1) 立刻把「新订单 / 未读」角标清零（原版是本地先归零，不等接口）；
   * 2) 把 lastOpenTime 刷新为当前时间；
   * 3) 重连 SSE —— 否则旧连接仍按旧 startTime 推送，5 秒内会把角标顶回非 0。
   */
  const openMessageCenter = () => {
    setMsgCount(0);
    setNewOrderCount(0);
    writeLastOpenTime();
    restartMsgStream();
    setMessageVisible(true);
  };

  /**
   * 关闭消息中心（对齐原版 MsgCount.vue::handleDialogClose）。
   * 弹窗内读消息只动未读红点，不动按 startTime 计的「新订单」；关闭时再刷一次基准并重连，
   * 让顶部计数按最新基准从服务端重新取一帧。
   */
  const closeMessageCenter = () => {
    setMessageVisible(false);
    writeLastOpenTime();
    restartMsgStream();
  };

  return (
    <div className={`app-shell layout-${layout} ${collapsed ? 'is-collapsed' : ''}`}>
      <aside className="sidebar">
        <div
          className={`brand ${collapsed ? 'brand-collapsed' : ''}`}
          role="button"
          tabIndex={0}
          aria-label="返回首页"
          onClick={() => onPageChange('dashboard')}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') onPageChange('dashboard');
          }}
        >
          {logo ? (
            <img className="brand-logo" src={logo} alt="后台 Logo" />
          ) : (
            <span className="brand-mark">W</span>
          )}
          {!collapsed && !logo && (
            <div className="brand-text">
              <div className="brand-name">万物新生</div>
              <div className="brand-sub">{t('运营管理后台')}</div>
            </div>
          )}
        </div>

        <div className="sidebar-body">
          <div className="rail" ref={railRef}>
            {groups.map((group) => {
              const active = activeGroup.key === group.key;
              return (
                <Tooltip content={t(group.label)} position="right" disabled={!collapsed} key={group.key}>
                  <button
                    type="button"
                    className={`rail-item ${active ? 'is-active' : ''} ${
                      draggingKey === group.key ? 'is-dragging' : ''
                    }`}
                    data-group-key={group.key}
                    onPointerDown={(event) => {
                      if (event.button !== 0) return;
                      suppressClickRef.current = false;
                      event.currentTarget.setPointerCapture?.(event.pointerId);
                      if (pressTimer.current) window.clearTimeout(pressTimer.current);
                      pressTimer.current = window.setTimeout(() => {
                        dragKeyRef.current = group.key;
                        setDraggingKey(group.key);
                        suppressClickRef.current = true;
                      }, 350);
                    }}
                    onPointerMove={(event) => {
                      if (!dragKeyRef.current) return;
                      event.preventDefault();
                      const target = (
                        document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null
                      )?.closest('[data-group-key]') as HTMLElement | null;
                      const targetKey = target?.dataset.groupKey;
                      if (!targetKey || targetKey === dragKeyRef.current) return;
                      setOrderedKeys((current) => {
                        const from = current.indexOf(dragKeyRef.current as string);
                        const to = current.indexOf(targetKey);
                        if (from < 0 || to < 0 || from === to) return current;
                        const next = [...current];
                        const [moved] = next.splice(from, 1);
                        next.splice(to, 0, moved);
                        orderedRef.current = next;
                        return next;
                      });
                    }}
                    onPointerUp={() => {
                      if (pressTimer.current) window.clearTimeout(pressTimer.current);
                      if (dragKeyRef.current) {
                        localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(orderedRef.current));
                        dragKeyRef.current = null;
                        setDraggingKey(null);
                        window.setTimeout(() => {
                          suppressClickRef.current = false;
                        }, 50);
                      }
                    }}
                    onPointerCancel={() => {
                      if (pressTimer.current) window.clearTimeout(pressTimer.current);
                      dragKeyRef.current = null;
                      setDraggingKey(null);
                    }}
                    onClick={() => {
                      if (suppressClickRef.current) return;
                      const first = group.items[0];
                      onPageChange(first.children?.[0]?.key || first.key);
                    }}
                  >
                    <span className="rail-icon">{group.icon}</span>
                    {!collapsed && <span className="rail-label">{t(group.label)}</span>}
                  </button>
                </Tooltip>
              );
            })}
          </div>

          {!collapsed && (
            <div className="submenu">
              <div className="submenu-title">{t(activeGroup.label)}</div>
              <div className="submenu-list">
                {activeGroup.items.map((item) =>
                  item.children?.length ? (
                    <div className="submenu-section" key={item.key}>
                      <div
                        className="submenu-section-title is-clickable"
                        title={`${t('点击进入')} ${t(item.label)}`}
                        onClick={() => {
                          const target = item.children?.[0]?.key || item.key;
                          onPageChange(target);
                        }}
                      >
                        <span>{t(item.label)}</span>
                        <span className="submenu-section-arrow">›</span>
                      </div>
                      {item.children.map((child) => (
                        <button
                          type="button"
                          className={`submenu-item submenu-item-child ${
                            page === child.key ? 'is-active' : ''
                          }`}
                          onClick={() => onPageChange(child.key)}
                          key={child.key}
                        >
                          {/* 对齐跨境版 pageLeftMenu 的 menu-chider-item：三级项只有文字，无装饰点 */}
                          <span>{t(child.label)}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={`submenu-item submenu-item-leaf ${page === item.key ? 'is-active' : ''}`}
                      onClick={() => onPageChange(item.key)}
                      key={item.key}
                    >
                      {/* 对齐跨境版 pageLeftMenu：叶子菜单项只有文字，无装饰点 */}
                      <span>{t(item.label)}</span>
                    </button>
                  ),
                )}
              </div>
            </div>
          )}
        </div>

        <div className="side-footer">
          {!collapsed ? (
            <>
              <div className="side-help">
                <IconHelpCircle />
                <span>{t('帮助与文档')}</span>
                <span className="side-version">v0.1.0 · Semi UI</span>
              </div>
            </>
          ) : (
            <Tooltip content={t('帮助与文档')} position="right">
              <button type="button" className="rail-help">
                <IconHelpCircle />
              </button>
            </Tooltip>
          )}
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div
            className="topbar-brand"
            role="button"
            tabIndex={0}
            aria-label="返回首页"
            onClick={() => onPageChange('dashboard')}
          >
            <img
              src={logo || `${import.meta.env.BASE_URL}admin-assets/admin-light-logo.jpeg`}
              alt="万物新生"
            />
          </div>
          <div className="topbar-left">
            <Button
              icon={<IconMenu />}
              theme="borderless"
              className="collapse-btn"
              onClick={() => setCollapsed((value) => !value)}
            />
            <MenuSearch onNavigate={(next) => onPageChange(next as PageKey)} />
          </div>

          <div className="topbar-right">
            <LicensedBadge />
            <Badge
              // 对齐原版 `v-if="messageCount > 0"`：Semi 的 Badge 在 count=0 时仍会渲染出「0」，
              // 传 undefined 才是真正不显示
              count={msgCount > 0 ? msgCount : undefined}
              overflowCount={99}
            >
              <Button
                icon={<IconBell />}
                theme="borderless"
                className="icon-btn"
                title={t('消息')}
                onClick={openMessageCenter}
              >
                <span className="topbar-text-btn">{t('消息')}</span>
                {newOrderCount > 0 && layout !== 'top' && (
                  <span className="admin-msg-order-count">
                    {t('新订单{newOrderMsgCount}', { newOrderMsgCount: newOrderCount })}
                  </span>
                )}
              </Button>
            </Badge>
            <VoiceBroadcast />
            <Button
              theme="borderless"
              className="topbar-text-btn"
              onClick={() => window.open(mallUrl, '_blank', 'noopener')}
            >
              {t('查看商城')}
            </Button>
            <Dropdown
              position="bottomRight"
              trigger="click"
              render={
                <Dropdown.Menu>
                  {translatedLocales().map((item) => (
                    <Dropdown.Item key={item.code} onClick={() => void setLocale(item.code)}>
                      {item.nativeLabel}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              }
            >
              <Button
                theme="borderless"
                className="icon-btn topbar-lang-btn"
                title={t('切换语言')}
                aria-label={t('切换语言')}
                icon={<Translate theme="outline" size={24} fill="currentColor" />}
              />
            </Dropdown>
            <Dropdown
              position="bottomRight"
              trigger="click"
              render={
                <Dropdown.Menu>
                  {/* 图标语义对齐跨境版 MsgCount.vue 的 iconfont-tig：
                      icon-shanghu → IconUserGroup（商户/组织）
                      icon-guanlizhanghao → IconUserSetting（管理账号）
                      icon-qingchuhuancun → IconRefresh（清除缓存）
                      icon-tuichudenglu → IconExit（退出登录） */}
                  {showSwitchOrg && (
                    <Dropdown.Item icon={<IconUserGroup />} onClick={switchOrganization}>
                      {t('切换组织')}
                    </Dropdown.Item>
                  )}
                  {/* 对齐原版 MsgCount.vue：下拉里原本没有「查看商城」，
                      只在窄屏（顶栏按钮被 .topbar-text-btn 隐藏）时才补进下拉 */}
                  {isNarrowScreen && (
                    <Dropdown.Item
                      icon={<IconShoppingBag />}
                      onClick={() => window.open(mallUrl, '_blank', 'noopener')}
                    >
                      {t('查看商城')}
                    </Dropdown.Item>
                  )}
                  <Dropdown.Item icon={<IconUserSetting />} onClick={() => onPageChange('accountManage')}>
                    {t('管理账号')}
                  </Dropdown.Item>
                  <Dropdown.Item icon={<IconRefresh />} onClick={clearCache}>
                    {t('清除缓存')}
                  </Dropdown.Item>
                  <Dropdown.Item icon={<IconExit />} onClick={onLogout}>
                    {t('退出登录')}
                  </Dropdown.Item>
                </Dropdown.Menu>
              }
            >
              <div className="account">
                <Avatar color="blue" size="small">管</Avatar>
                <div className="account-text">
                  <span className="account-name">admin</span>
                  <span className="account-role">{t('平台管理员')}</span>
                </div>
              </div>
            </Dropdown>
          </div>
        </header>

        <main className="page-content">
          <VoiceBroadcastTip />
          <div className="page-inner">
            <div className="page-heading">
              <div>
                <h1 className="page-title">{t(pageTitles[page] || page)}</h1>
              </div>
            </div>
            {children}
          </div>
        </main>
        <AdminMessageCenter
          visible={messageVisible}
          onClose={closeMessageCenter}
          onRead={(unread) => {
            // 传了未读数：只做乐观更新，不去请求（此时服务端可能还没改完，请求会拿回旧值把角标顶回去）
            // 用 min 取小值：打开消息中心时角标已按原版清零，之后读消息算出的数不应把它顶回去
            if (typeof unread === 'number') {
              setMsgCount((current) => Math.min(current, unread));
              return;
            }
            // 不传参：已读接口成功后再按服务端真实值对齐
            void fetchUnreadSummary().then((count) => {
              if (count !== null && !messageVisible) setMsgCount(count);
            });
          }}
        />
        <SelectShopModal visible={orgModalVisible} onClose={() => setOrgModalVisible(false)} />
      </div>
    </div>
  );
}
