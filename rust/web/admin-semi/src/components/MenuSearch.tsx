import { useEffect, useRef, useState } from 'react';
import { Empty, Input, Spin } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';
import { apiGet } from '../api';
import { navGroups } from '../config/adminMenu';
import { useI18n } from '../i18n';

interface MenuSearchResult {
  authorityId: number;
  authorityName: string;
  authorityNames: string[];
  authoritySn: string;
  routeLink?: string;
}

interface MenuEntry {
  key: string;
  label: string;
}

const ALIAS: Record<string, string> = {
  product: 'products',
  productManage: 'products',
  order: 'orders',
  orderManage: 'orders',
  member: 'members',
  memberManage: 'members',
  contentManage: 'content',
  coupon: 'couponManage',
  groupon: 'grouponPromotionManage',
  seckill: 'seckillManage',
};

function buildMenuEntries(): MenuEntry[] {
  const entries: MenuEntry[] = [];
  navGroups.forEach((group) => {
    entries.push({ key: group.key, label: group.label });
    group.items.forEach((item) => {
      entries.push({ key: item.key, label: item.label });
      (item.children || []).forEach((child) => entries.push({ key: child.key, label: child.label }));
    });
  });
  return entries;
}

const MENU_ENTRIES = buildMenuEntries();

function resolvePage(item: MenuSearchResult): string | null {
  const exact = MENU_ENTRIES.find((entry) => entry.key === item.authoritySn);
  if (exact) return exact.key;
  const alias = ALIAS[item.authoritySn];
  if (alias && MENU_ENTRIES.some((entry) => entry.key === alias)) return alias;
  const byLabel = MENU_ENTRIES.find((entry) => entry.label === item.authorityName && entry.key !== item.authorityName);
  if (byLabel) return byLabel.key;
  const route = (item.routeLink || '').toLowerCase();
  const routeAlias: Array<[string, string]> = [
    ['product/category', 'categoryManage'],
    ['product/brand', 'brandManage'],
    ['product/comment', 'commentManage'],
    ['product/product_services', 'productServicesManage'],
    ['product/list', 'products'],
    ['order/list', 'orders'],
    ['user/list', 'members'],
    ['promotion/coupon', 'couponManage'],
    ['promotion/groupon', 'grouponPromotionManage'],
    ['promotion/seckill', 'seckillManage'],
  ];
  const matched = routeAlias.find(([prefix]) => route.includes(prefix));
  return matched ? matched[1] : null;
}

export default function MenuSearch({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { t } = useI18n();
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [results, setResults] = useState<MenuSearchResult[]>([]);
  const timer = useRef<number | null>(null);
  const blurTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      if (blurTimer.current !== null) window.clearTimeout(blurTimer.current);
    };
  }, []);

  const search = (value: string) => {
    setKeyword(value);
    if (timer.current !== null) window.clearTimeout(timer.current);
    if (!value.trim()) {
      setVisible(false);
      setResults([]);
      return;
    }
    timer.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const result = await apiGet<MenuSearchResult[]>('/panel/panel/searchMenu', { keyword: value.trim() });
        setResults(Array.isArray(result) ? result : []);
        setVisible(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 220);
  };

  const pick = (item: MenuSearchResult) => {
    const page = resolvePage(item);
    setVisible(false);
    setKeyword('');
    setResults([]);
    if (page) onNavigate(page);
  };

  return (
    <div className="topbar-menu-search">
      <Input
        prefix={<IconSearch />}
        value={keyword}
        placeholder={t('在这里查找功能，一键直达')}
        onChange={search}
        onFocus={() => {
          if (keyword.trim() && results.length) setVisible(true);
        }}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => setVisible(false), 160);
        }}
        onEnterPress={() => {
          if (results[0]) pick(results[0]);
        }}
      />
      {visible && (
        <div className="topbar-menu-search__panel" onMouseDown={(event) => event.preventDefault()}>
          <div className="topbar-menu-search__title">{t('搜索结果')}</div>
          {loading ? (
            <div className="topbar-menu-search__state"><Spin size="small" /></div>
          ) : results.length ? (
            results.slice(0, 8).map((item) => (
              <button
                type="button"
                key={`${item.authorityId}-${item.authoritySn}`}
                className="topbar-menu-search__item"
                onMouseDown={() => pick(item)}
              >
                {(item.authorityNames && item.authorityNames.length ? item.authorityNames : [item.authorityName]).join(' / ')}
              </button>
            ))
          ) : (
            <Empty description={t('没有搜索到栏目！')} style={{ padding: 16 }} />
          )}
        </div>
      )}
    </div>
  );
}
