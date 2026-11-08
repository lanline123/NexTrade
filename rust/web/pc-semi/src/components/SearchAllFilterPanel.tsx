'use client';

/**
 * PC 搜索页「全部筛选」浮层面板。
 *
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/search/components/SortFilter.vue
 * （filterPanelVisible 区块，约 140-215 行）。
 *
 * 旧版行为：
 * - 顶部筛选版（filterStyle=2）在排序栏右侧有「筛选」触发器，带已选数量角标；
 * - 点击展开右侧浮层：顶部是分区 tab（品牌 / 各 ES 属性 / 其他），点击 tab 滚动到对应分区；
 * - 每个分区内选项超过阈值时折叠，显示「展开全部 / 收起」；
 * - 底部「重置筛选」清空所有筛选条件。
 *
 * 组件只负责 URL 拼接（服务端页面读取 searchParams 完成筛选），保持搜索页为 server component。
 */
import { useMemo, useState, useRef, useEffect } from 'react';
import Link from 'next/link';

import { useTranslation } from 'react-i18next';

export interface SearchFilterBrand {
  id: string;
  name: string;
  firstWord?: string;
}

export interface SearchFilterAttr {
  name?: string;
  values?: Array<{ value?: string }>;
}

interface SearchAllFilterPanelProps {
  brands: SearchFilterBrand[];
  attrs: SearchFilterAttr[];
  /** 已选品牌 id */
  selectedBrands: string[];
  /** 已选属性：名称 → 值数组 */
  selectedAttrs: Record<string, string[]>;
  /** 生成链接用的查询串（不含 brand/attr/page） */
  baseQuery: string;
  basePath?: string;
  /** 分区内选项折叠阈值 */
  collapsedCount?: number;
}

type PanelSection = {
  key: string;
  title: string;
  type: 'brand' | 'attr' | 'other';
  attrName?: string;
  options: Array<{ key: string; label: string; active: boolean }>;
};

export default function SearchAllFilterPanel({
  brands,
  attrs,
  selectedBrands,
  selectedAttrs,
  baseQuery,
  basePath = '/search',
  collapsedCount = 8,
}: SearchAllFilterPanelProps) {
    const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  /* 旧版 SortFilter.vue：filterPanelTabsRef + showPanelTabsLeftArrow / showPanelTabsRightArrow */
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const [tabArrow, setTabArrow] = useState({ left: false, right: false });

  const selectedBrandSet = useMemo(() => new Set(selectedBrands.filter(Boolean)), [selectedBrands]);

  /** 已选条件总数（用于触发器角标） */
  const selectedCount = useMemo(() => {
    let n = selectedBrandSet.size;
    Object.values(selectedAttrs).forEach((values) => {
      n += (values || []).length;
    });
    return n;
  }, [selectedBrandSet, selectedAttrs]);

  /** 分区：品牌 + 各 ES 属性 */
  const sections = useMemo<PanelSection[]>(() => {
    const list: PanelSection[] = [];
    if (brands.length) {
      list.push({
        key: 'brand',
        title: t('品牌'),
        type: 'brand',
        options: brands.map((item) => ({
          key: String(item.id),
          label: item.name,
          active: selectedBrandSet.has(String(item.id)),
        })),
      });
    }
    attrs.forEach((attr, index) => {
      const name = String(attr.name ?? '');
      if (!name) return;
      const chosen = selectedAttrs[name] || [];
      list.push({
        key: `attr-${index}`,
        title: name,
        type: 'attr',
        attrName: name,
        options: (attr.values || []).map((option) => {
          const value = String(option.value ?? '');
          return { key: value, label: value, active: chosen.includes(value) };
        }),
      });
    });
    return list;
  }, [brands, attrs, selectedAttrs, selectedBrandSet, t]);

  useEffect(() => {
    if (visible && sections.length) setActiveTab(sections[0].key);
  }, [visible, sections]);

  useEffect(() => {
    if (!visible) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setVisible(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible]);

  /** 分区锚点滚动 */
  const scrollToSection = (key: string) => {
    setActiveTab(key);
    const target = bodyRef.current?.querySelector(`[data-section-key="${key}"]`);
    if (target && bodyRef.current) {
      bodyRef.current.scrollTo({ top: (target as HTMLElement).offsetTop - 8, behavior: 'smooth' });
    }
  };

  /** 旧版 SortFilter.vue 的 updatePanelTabsArrows：标签条能不能左右滚 */
  const measureTabs = () => {
    const el = tabsRef.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setTabArrow((current) => (current.left === left && current.right === right ? current : { left, right }));
  };

  /** 旧版 scrollPanelTabs：点箭头左右滚一段 */
  const scrollTabs = (direction: number) => {
    const el = tabsRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(160, el.clientWidth * 0.6), behavior: 'smooth' });
  };

  useEffect(() => {
    if (!visible) return undefined;
    const id = window.setTimeout(measureTabs, 0);
    window.addEventListener('resize', measureTabs);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('resize', measureTabs);
    };
  }, [visible, sections]);

  /** 生成品牌 / 属性的切换链接 */
  const buildToggleHref = (section: PanelSection, optionKey: string) => {
    const params = new URLSearchParams(baseQuery);
    if (section.type === 'brand') {
      const current = selectedBrands.filter(Boolean);
      const next = current.includes(optionKey)
        ? current.filter((item) => item !== optionKey)
        : [...current, optionKey];
      if (next.length) params.set('brand', next.join(','));
      else params.delete('brand');
    } else if (section.type === 'attr' && section.attrName) {
      const current = selectedAttrs[section.attrName] || [];
      const next = current.includes(optionKey)
        ? current.filter((item) => item !== optionKey)
        : [...current, optionKey];
      // 重建全部 attr 参数；清空的属性不保留
      const merged = Object.entries(selectedAttrs).map(([name, values]) =>
        name === section.attrName ? [name, next] as const : [name, values] as const,
      );
      params.delete('attr');
      /**
       * 属性参数格式必须与页面既有序列化一致（app/search/page.tsx serializeSelectedAttrs）：
       * 每个值一个 `attr=名称::值` 参数，同名属性的多个值追加多个参数。
       * 不能写成 `attr=名称::值1|值2` —— 后端按 `::` 分割后 `|` 会被当作值的一部分。
       */
      merged
        .filter(([, values]) => (values || []).length > 0)
        .forEach(([name, values]) => {
          (values || []).forEach((value) => params.append('attr', `${name}::${value}`));
        });
    }
    params.delete('page');
    const query = params.toString();
    return `${basePath}${query ? `?${query}` : ''}`;
  };

  /** 清空所有筛选（品牌 + 属性） */
  const resetHref = (() => {
    const params = new URLSearchParams(baseQuery);
    params.delete('brand');
    params.delete('attr');
    params.delete('page');
    const query = params.toString();
    return `${basePath}${query ? `?${query}` : ''}`;
  })();

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className={`sort-item sort-filter__trigger${visible || selectedCount > 0 ? ' active' : ''}`}
        onClick={() => setVisible((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') setVisible((current) => !current);
        }}
      >
        <div className="sort-name">
          <span className="sort-filter__trigger-icon" aria-hidden />
          <span>{t('筛选')}</span>
        </div>
        {selectedCount > 0 ? <span className="sort-filter__badge">{selectedCount}</span> : null}
      </div>

      {visible ? <div className="sort-filter-panel-mask" onClick={() => setVisible(false)} /> : null}

      {visible ? (
        <div className="sort-filter-panel" ref={panelRef}>
          <div className="sort-filter-panel__header">
            <div className="sort-filter-panel__title">{t('全部筛选')}</div>
            <button type="button" className="sort-filter-panel__close" onClick={() => setVisible(false)} aria-label={t('关闭')}>
              ×
            </button>
          </div>

          {sections.length ? (
            <div className="sort-filter-panel__tabs-wrapper">
              {tabArrow.left ? (
                <div
                  className="filter-category__arrow filter-category__arrow--left"
                  role="button"
                  tabIndex={0}
                  onClick={() => scrollTabs(-1)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') scrollTabs(-1);
                  }}
                >
                  <span className="filter-category__arrow-btn">
                    <span className="tig-icon filter-category__arrow-icon filter-category__arrow-icon--flip" />
                  </span>
                </div>
              ) : null}
              <div className="sort-filter-panel__tabs" ref={tabsRef} onScroll={measureTabs}>
                {sections.map((section) => (
                  <button
                    key={section.key}
                    type="button"
                    data-tab-key={section.key}
                    className={`sort-filter-panel__tab${activeTab === section.key ? ' active' : ''}`}
                    onClick={() => scrollToSection(section.key)}
                  >
                    <span>{section.title}</span>
                  </button>
                ))}
              </div>
              {tabArrow.right ? (
                <div
                  className="filter-category__arrow filter-category__arrow--right"
                  role="button"
                  tabIndex={0}
                  onClick={() => scrollTabs(1)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') scrollTabs(1);
                  }}
                >
                  <span className="filter-category__arrow-btn">
                    <span className="tig-icon filter-category__arrow-icon" />
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="sort-filter-panel__body" ref={bodyRef}>
            {sections.map((section) => {
              const isExpanded = expanded[section.key];
              const visibleOptions = isExpanded ? section.options : section.options.slice(0, collapsedCount);
              return (
                <section className="sort-filter-panel__section" key={section.key} data-section-key={section.key}>
                  <div className="sort-filter-panel__section-title">{section.title}</div>
                  <div className="sort-filter-panel__options">
                    {visibleOptions.map((option) => (
                      <Link
                        key={option.key}
                        href={buildToggleHref(section, option.key)}
                        className={`sort-filter-panel__option${option.active ? ' active' : ''}`}
                      >
                        {option.label}
                      </Link>
                    ))}
                  </div>
                  {section.options.length > collapsedCount ? (
                    <button
                      type="button"
                      className="sort-filter-panel__toggle"
                      onClick={() => setExpanded((current) => ({ ...current, [section.key]: !current[section.key] }))}
                    >
                      {isExpanded ? t('收起') : t('展开全部')}
                      <span
                        className={`tig-icon sort-filter-panel__toggle-arrow${isExpanded ? ' sort-filter-panel__toggle-arrow--open' : ''}`}
                      />
                    </button>
                  ) : null}
                </section>
              );
            })}
            {!sections.length ? <div className="sort-filter-panel__empty">{t('暂无筛选项')}</div> : null}
          </div>

          <div className="sort-filter-panel__footer">
            <Link
              href={resetHref}
              className={`sort-filter-panel__reset${selectedCount === 0 ? ' is-disabled' : ''}`}
              aria-disabled={selectedCount === 0}
            >
              {t('重置筛选')}
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
