'use client';

/**
 * PC 搜索页品牌筛选：按品牌首字母分组（旧版 Filter.vue 首字母 + FilterSide.vue 更多/收起）。
 *
 * 旧版行为：
 * - 品牌列表带 firstWord 时按 A-Z 分组，非字母归入 #；
 * - 默认展示前 8 个 + 「更多」，展开后显示当前字母全部品牌；
 * - 同一时间只显示一个首字母分组，点击字母切换；
 * - 品牌多选（旧版 multipleBrandIds），点击已选品牌取消选择。
 *
 * 组件只负责 URL 拼接（服务端页面读取 searchParams 完成筛选），保持搜索页为 server component。
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';

import { useTranslation } from 'react-i18next';
export interface SearchBrandOption {
  id: string;
  name: string;
  firstWord?: string;
}

interface SearchBrandFilterProps {
  brands: SearchBrandOption[];
  selected: string[];
  /** 当前查询串（已包含 keyword/cat/sort/order/min/max/attr 等，不含 brand/page） */
  baseQuery: string;
  /** 生成链接时使用的列表路径，默认 /search；/list、/search.v1 复用时由调用方传入。 */
  basePath?: string;
  maxVisible?: number;
}

function normalizeLetter(value: string | undefined, name: string): string {
  const raw = String(value || '').trim().toUpperCase();
  if (/^[A-Z]$/.test(raw)) return raw;
  const first = String(name || '').trim().charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : '';
}

export default function SearchBrandFilter({ brands, selected, baseQuery, basePath = '/search', maxVisible = 8 }: SearchBrandFilterProps) {
    const { t } = useTranslation();
  const selectedSet = useMemo(() => new Set(selected.filter(Boolean)), [selected]);
  const [letter, setLetter] = useState<string>(() => {
    const firstSelected = brands.find((brand) => selectedSet.has(brand.id));
    return firstSelected ? normalizeLetter(firstSelected.firstWord, firstSelected.name) : '';
  });
  const [expanded, setExpanded] = useState(false);

  const letterGroups = useMemo(() => {
    const map = new Map<string, SearchBrandOption[]>();
    brands.forEach((brand) => {
      const key = normalizeLetter(brand.firstWord, brand.name);
      if (!key) return;
      const list = map.get(key) || [];
      list.push(brand);
      map.set(key, list);
    });
    return map;
  }, [brands]);

  const letters = useMemo(() => Array.from(letterGroups.keys()).sort((a, b) => a.localeCompare(b)), [letterGroups]);

  const currentLetter = letter && letterGroups.has(letter) ? letter : '';
  const currentBrands = currentLetter ? letterGroups.get(currentLetter) || [] : brands;
  const visibleBrands = expanded ? currentBrands : currentBrands.slice(0, maxVisible);
  const hasMore = currentBrands.length > maxVisible;

  const brandHref = (id: string) => {
    const params = new URLSearchParams(baseQuery);
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    params.delete('brand');
    params.delete('page');
    if (next.size) params.set('brand', Array.from(next).join(','));
    const query = params.toString();
    return `${basePath}${query ? `?${query}` : ''}`;
  };

  if (!brands.length) return null;

  return (
    <div className="pc-search-filter-row pc-search-brand-filter">
      <span className="pc-search-filter-row__label">{t('品牌：')}</span>
      <div className="pc-search-brand-filter__body" style={{ flex: 1 }}>
        <div className="pc-search-brand-letters" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          <button
            type="button"
            onClick={() => { setLetter(''); setExpanded(false); }}
            style={{ border: '1px solid #eee', borderRadius: 4, background: currentLetter === '' ? '#1a1a1a' : '#fff', color: currentLetter === '' ? '#fff' : '#666', padding: '2px 8px', cursor: 'pointer' }}
          >{t('全部')}</button>
          {letters.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => { setLetter(item); setExpanded(false); }}
              style={{ border: '1px solid #eee', borderRadius: 4, background: currentLetter === item ? '#1a1a1a' : '#fff', color: currentLetter === item ? '#fff' : '#666', padding: '2px 8px', cursor: 'pointer' }}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="pc-search-filter-row__values">
          {visibleBrands.map((brand) => (
            <Link key={brand.id} href={brandHref(brand.id)} className={selectedSet.has(brand.id) ? 'is-active' : ''}>
              {brand.name}
            </Link>
          ))}
          {hasMore ? (
            <button
              type="button"
              className="pc-search-brand-more"
              onClick={() => setExpanded((value) => !value)}
              style={{ border: 0, background: 'transparent', color: '#005ea7', cursor: 'pointer', padding: 0, fontSize: 13 }}
            >
              {expanded ? t('收起') : t('更多（{n}）', { n: currentBrands.length - maxVisible })}
            </button>
          ) : null}
        </div>
        {selectedSet.size ? (
          <div style={{ marginTop: 6, fontSize: 12, color: '#999' }}>已选 {selectedSet.size} 个品牌</div>
        ) : null}
      </div>
    </div>
  );
}
