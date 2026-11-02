import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Avatar, Badge, Button, Dropdown, Input, Tooltip } from '@douyinfe/semi-ui';
import { IconBell, IconExit, IconHelpCircle, IconMenu, IconSearch } from '@douyinfe/semi-icons';
import { navGroups, pageTitles } from '../config/adminMenu';
import MenuSearch from '../components/MenuSearch';
import AdminMessageCenter from '../components/AdminMessageCenter';
import LicensedBadge from '../components/LicensedBadge';
import VoiceBroadcast from '../components/VoiceBroadcast';
import { useI18n } from '../i18n';
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
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [messageVisible, setMessageVisible] = useState(false);
  const prevVoiceCount = useRef<Record<string, number> | null>(null);
  const [orderedKeys, setOrderedKeys] = useState<string[]>(loadNavOrder);
  const orderedRef = useRef(orderedKeys);
  const pressTimer = useRef<number | null>(null);
  const dragKeyRef = useRef<string | null>(null);
  const suppressClickRef = useRef(false);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void fetchUnreadSummary().then((count) => {
        if (alive && count !== null) setMsgCount(count);
      });
    };
    refresh();
    const pollTimer = window.setInterval(refresh, 30000);
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
    return () => {
      alive = false;
      window.clearInterval(pollTimer);
      stop();
    };
  }, []);

  useEffect(() => {
    orderedRef.current = orderedKeys;
  }, [orderedKeys]);

  const groups = useMemo(
    () => orderedKeys.map((key) => navGroups.find((group) => group.key === key)).filter(Boolean) as typeof navGroups,
    [orderedKeys],
  );

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
  const adminType = (() => {
    try {
      return localStorage.getItem('adminType') || '';
    } catch {
      return '';
    }
  })();
  const showSwitchOrg = Boolean(adminType && adminType !== 'admin');
  const switchOrganization = () => {
    localStorage.removeItem('adminType');
    localStorage.removeItem('shopId');
    localStorage.removeItem('shopTitle');
    window.location.reload();
  };
  const clearCache = () => {
    localStorage.removeItem('admin_nav_order_v1');
    localStorage.removeItem('lastOpenTime');
    window.location.reload();
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
          <div className="rail">
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
                          <span className="submenu-dot" />
                          <span>{child.label}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={`submenu-item ${page === item.key ? 'is-active' : ''}`}
                      onClick={() => onPageChange(item.key)}
                      key={item.key}
                    >
                      <span className="submenu-dot" />
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
                <span>帮助与文档</span>
                <span className="side-version">v0.1.0 · Semi UI</span>
              </div>
            </>
          ) : (
            <Tooltip content="帮助与文档" position="right">
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
            <Badge count={msgCount} overflowCount={99}>
              <Button
                icon={<IconBell />}
                theme="borderless"
                className="icon-btn"
                title={t('消息')}
                onClick={() => setMessageVisible(true)}
              >
                <span className="topbar-text-btn">{t('消息')}</span>
                {newOrderCount > 0 && (
                  <span className="admin-msg-order-count">
                    {t('新订单')}{newOrderCount}
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
                  <Dropdown.Item onClick={() => void setLocale('zh')}>中文</Dropdown.Item>
                  <Dropdown.Item onClick={() => void setLocale('en')}>English</Dropdown.Item>
                </Dropdown.Menu>
              }
            >
              <Button theme="borderless" className="icon-btn" title={t('切换语言')}>
                {locale === 'en' ? 'EN' : '中'}
              </Button>
            </Dropdown>
            <Dropdown
              position="bottomRight"
              trigger="click"
              render={
                <Dropdown.Menu>
                  {showSwitchOrg && (
                    <Dropdown.Item onClick={switchOrganization}>{t('切换组织')}</Dropdown.Item>
                  )}
                  <Dropdown.Item onClick={() => onPageChange('accountManage')}>{t('管理账号')}</Dropdown.Item>
                  <Dropdown.Item onClick={clearCache}>{t('清除缓存')}</Dropdown.Item>
                  <Dropdown.Item onClick={onLogout}>{t('退出登录')}</Dropdown.Item>
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
          onClose={() => setMessageVisible(false)}
          onRead={() => {
            void fetchUnreadSummary().then((count) => {
              if (count !== null) setMsgCount(count);
            });
          }}
        />
      </div>
    </div>
  );
}
