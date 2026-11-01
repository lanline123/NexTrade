import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Avatar, Badge, Button, Input, Tooltip, Typography } from '@douyinfe/semi-ui';
import { IconBell, IconExit, IconHelpCircle, IconMenu, IconSearch } from '@douyinfe/semi-icons';
import { navGroups, pageTitles } from '../config/adminMenu';

const { Text } = Typography;

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
  const [collapsed, setCollapsed] = useState(false);
  const [orderedKeys, setOrderedKeys] = useState<string[]>(loadNavOrder);
  const orderedRef = useRef(orderedKeys);
  const pressTimer = useRef<number | null>(null);
  const dragKeyRef = useRef<string | null>(null);
  const suppressClickRef = useRef(false);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);

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
              <div className="brand-sub">运营管理后台</div>
            </div>
          )}
        </div>

        <div className="sidebar-body">
          <div className="rail">
            {groups.map((group) => {
              const active = activeGroup.key === group.key;
              return (
                <Tooltip content={group.label} position="right" disabled={!collapsed} key={group.key}>
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
                    {!collapsed && <span className="rail-label">{group.label}</span>}
                  </button>
                </Tooltip>
              );
            })}
          </div>

          {!collapsed && (
            <div className="submenu">
              <div className="submenu-title">{activeGroup.label}</div>
              <div className="submenu-list">
                {activeGroup.items.map((item) =>
                  item.children?.length ? (
                    <div className="submenu-section" key={item.key}>
                      <div
                        className="submenu-section-title is-clickable"
                        title={`点击进入 ${item.label}`}
                        onClick={() => {
                          const target = item.children?.[0]?.key || item.key;
                          onPageChange(target);
                        }}
                      >
                        <span>{item.label}</span>
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
                      <span>{item.label}</span>
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
          <div className="topbar-left">
            <Button
              icon={<IconMenu />}
              theme="borderless"
              className="collapse-btn"
              onClick={() => setCollapsed((value) => !value)}
            />
            <div className="breadcrumb">
              <button
                type="button"
                className="breadcrumb-link"
                onClick={() => onPageChange('dashboard')}
              >
                首页
              </button>
              <span className="breadcrumb-sep">/</span>
              <button
                type="button"
                className={`breadcrumb-link ${!hasThirdLevel && !activeParent ? 'breadcrumb-current' : ''}`}
                onClick={() => {
                  const firstLeaf = activeGroup.items.find((item) => !item.children?.length) || activeGroup.items[0];
                  if (firstLeaf) {
                    onPageChange((firstLeaf.children?.[0]?.key || firstLeaf.key) as PageKey);
                  }
                }}
              >
                {activeGroup.label}
              </button>
              {hasThirdLevel && activeParent && (
                <>
                  <span className="breadcrumb-sep">/</span>
                  <button
                    type="button"
                    className="breadcrumb-link"
                    onClick={() => {
                      const target = activeParent.children?.[0]?.key || activeParent.key;
                      onPageChange(target as PageKey);
                    }}
                  >
                    {activeParent.label}
                  </button>
                </>
              )}
              <span className="breadcrumb-sep">/</span>
              <span className="breadcrumb-current">{pageTitles[page] || page}</span>
            </div>
          </div>

          <div className="topbar-right">
            <Input
              className="topbar-search"
              prefix={<IconSearch />}
              placeholder="搜索商品、订单、会员"
              onEnterPress={(value) => {
                if (String(value || '').trim()) onPageChange('products');
              }}
            />
            <Badge count={3} dot>
              <Button icon={<IconBell />} theme="borderless" className="icon-btn" />
            </Badge>
            <div className="account">
              <Avatar color="blue" size="small">
                管
              </Avatar>
              <div className="account-text">
                <span className="account-name">admin</span>
                <span className="account-role">平台管理员</span>
              </div>
            </div>
            <Button icon={<IconExit />} theme="borderless" className="icon-btn" onClick={onLogout} />
          </div>
        </header>

        <main className="page-content">
          <div className="page-inner">
            <div className="page-heading">
              <div>
                <h1 className="page-title">{pageTitles[page] || page}</h1>
                <Text type="tertiary" size="small">
                  万物新生 · 运营管理后台
                </Text>
              </div>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
