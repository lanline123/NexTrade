'use client';

/**
 * 搜索页排序栏 —— 结构照抄旧版 `pages/search/components/SortFilter.vue` 的模板。
 *
 * 为什么是客户端组件：旧版这一栏的「价格 / 区间 / 品牌」三个下拉是靠 JS 的
 * onMouseEnter/onMouseLeave 打开的（SortFilter.vue 里是 ref + watchEffect），
 * 纯服务端渲染做不出悬停，所以保留同样的悬停开关机制，只把类名换成旧版的。
 *
 * 类名来源（逐条对应旧版模板行）：
 *   .sort-filter-wrap > .sort-filter-left / .line / .sort-filter-center / .sort-filter-right
 *   .sort-item > .sort-name
 *   .price-sort > .price-sort__trigger(.price-sort__arrow) + .price-sort__dropdown > .price-sort__option
 *   .interval-sort > .interval-sort__trigger + .interval-sort__dropdown
 *       > .interval-sort__input-row > .interval-sort__input-box(.interval-sort__currency) + .interval-sort__separator
 *       + .interval-sort__preset-list > .interval-sort__preset-item(.interval-sort__preset-title / --subtitle)
 *       + .interval-sort__actions > .interval-sort__btn--reset / --submit
 *   .brand-sort > .brand-sort__trigger + .brand-sort__dropdown > .brand-sort__item > .brand-sort__name
 */

import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

import { currencySymbol } from '@/lib/currency';
export interface SortLink {
  key: string;
  label: string;
  href: string;
  active?: boolean;
}

export interface SortHidden {
  name: string;
  value: string;
}

interface SearchSortBarProps {
  defaultHref: string;
  defaultActive: boolean;
  saleHref: string;
  saleActive: boolean;
  /** 价格下拉里的两项：从低到高 / 从高到低 */
  priceOptions: SortLink[];
  priceActive: boolean;
  timeHref: string;
  timeActive: boolean;
  /** 区间下拉里的预设（旧版按后端返回的价格区间渲染） */
  intervalPresets: SortLink[];
  intervalActive: boolean;
  /** 区间表单提交到的地址（旧版是 JS 提交，这里用 GET 表单，参数与页面一致） */
  intervalAction: string;
  intervalHidden: SortHidden[];
  minValue?: string;
  maxValue?: string;
  resetHref: string;
  brandOptions: SortLink[];
  brandActive: boolean;
  /** 旧版 sort-filter-right 里的「筛选」触发器与面板 */
  filterPanel?: React.ReactNode;
}

export default function SearchSortBar({
  defaultHref,
  defaultActive,
  saleHref,
  saleActive,
  priceOptions,
  priceActive,
  timeHref,
  timeActive,
  intervalPresets,
  intervalActive,
  intervalAction,
  intervalHidden,
  minValue = '',
  maxValue = '',
  resetHref,
  brandOptions,
  brandActive,
  filterPanel,
}: SearchSortBarProps) {
  const { t } = useTranslation();
  const [priceOpen, setPriceOpen] = useState(false);
  const [intervalOpen, setIntervalOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);

  return (
    /* 生成样式 .mp-search-sort 是外层包裹（后代选择器 .mp-search-sort .sort-filter-wrap），
       这里补齐包裹结构，避免两个类同节点导致整套排序条样式空转 */
    <div className="mp-search-sort">
      <div className="sort-filter-wrap">
      <div className="sort-filter-left">
        <Link href={defaultHref} className={`sort-item${defaultActive ? ' active' : ''}`}>
          <div className="sort-name">{t('默认排序')}</div>
        </Link>
        <Link href={saleHref} className={`sort-item${saleActive ? ' active' : ''}`}>
          <div className="sort-name">{t('销量')}</div>
        </Link>

        <div
          className="price-sort"
          onMouseEnter={() => setPriceOpen(true)}
          onMouseLeave={() => setPriceOpen(false)}
        >
          <div className={`sort-item price-sort__trigger${priceOpen || priceActive ? ' active' : ''}`}>
            <div className="sort-name">{t('价格')}</div>
            <span className={`price-sort__arrow${priceOpen ? ' price-sort__arrow--open' : ''}`} />
          </div>
          {priceOpen ? (
            <div className="price-sort__dropdown">
              {priceOptions.map((option) => (
                <Link
                  key={option.key}
                  href={option.href}
                  className={`price-sort__option${option.active ? ' active' : ''}`}
                >
                  {option.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        <div
          className="interval-sort"
          onMouseEnter={() => setIntervalOpen(true)}
          onMouseLeave={() => setIntervalOpen(false)}
        >
          <div className={`sort-item interval-sort__trigger${intervalOpen || intervalActive ? ' active' : ''}`}>
            <div className="sort-name">{t('区间')}</div>
            <span className={`price-sort__arrow${intervalOpen ? ' price-sort__arrow--open' : ''}`} />
          </div>
          {intervalOpen ? (
            <div className="interval-sort__dropdown">
              <form action={intervalAction} method="get">
                {intervalHidden.map((item) => (
                  <input key={item.name} type="hidden" name={item.name} value={item.value} />
                ))}
                <div className="interval-sort__input-row">
                  <div className="interval-sort__input-box">
                    <span className="interval-sort__currency">{currencySymbol()}</span>
                    <input type="text" name="min" defaultValue={minValue} placeholder={t('最低价')} />
                  </div>
                  <span className="interval-sort__separator">-</span>
                  <div className="interval-sort__input-box">
                    <span className="interval-sort__currency">{currencySymbol()}</span>
                    <input type="text" name="max" defaultValue={maxValue} placeholder={t('最高价')} />
                  </div>
                </div>
                {intervalPresets.length ? (
                  <div className="interval-sort__preset-list">
                    {intervalPresets.map((preset) => (
                      <Link
                        key={preset.key}
                        href={preset.href}
                        className={`interval-sort__preset-item${preset.active ? ' active' : ''}`}
                      >
                        <div className="interval-sort__preset-title">{preset.label}</div>
                        <div className="interval-sort__preset-subtitle">{preset.key}</div>
                      </Link>
                    ))}
                  </div>
                ) : null}
                <div className="interval-sort__actions">
                  <Link href={resetHref} className="interval-sort__btn interval-sort__btn--reset">
                    {t('重置')}
                  </Link>
                  <button type="submit" className="interval-sort__btn interval-sort__btn--submit">
                    {t('确定')}
                  </button>
                </div>
              </form>
            </div>
          ) : null}
        </div>
      </div>

      <div className="line" />

      <div className="sort-filter-center">
        <div className="sort-filter-center__scroll">
          <div className="sort-filter-center__content">
            <Link href={timeHref} className={`sort-item${timeActive ? ' active' : ''}`}>
              <div className="sort-name">{t('新品')}</div>
            </Link>

            {brandOptions.length ? (
              <div
                className="brand-sort"
                onMouseEnter={() => setBrandOpen(true)}
                onMouseLeave={() => setBrandOpen(false)}
              >
                <div className={`sort-item brand-sort__trigger${brandOpen || brandActive ? ' active' : ''}`}>
                  <div className="sort-name">{t('品牌')}</div>
                  <span className={`price-sort__arrow${brandOpen ? ' price-sort__arrow--open' : ''}`} />
                </div>
                {brandOpen ? (
                  <div className="brand-sort__dropdown">
                    {brandOptions.map((option) => (
                      <Link
                        key={option.key}
                        href={option.href}
                        className={`brand-sort__item${option.active ? ' active' : ''}`}
                      >
                        <div className="brand-sort__name">{option.label}</div>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="sort-filter-right">{filterPanel}</div>
      </div>
    </div>
  );
}
