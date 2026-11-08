'use client';

/**
 * 头部搜索框（源码：view/pc/components/common/components/DefSearchNew.vue）
 *
 * React 版保持源码 DOM 结构/类名：
 * .top-search > .search-form > .acea-row.row-middle > (.search-type-select) input PcImageSearchEntry .search-submit
 * 以及 .search-guess-box 搜索建议。
 *
 * - 搜索类型下拉：后台 `indexSearchShop = 1` 时展示「商品 / 店铺」，
 *   店铺搜索跳 `/shop/list?keyword=`（o2o 门店场景在本站点不启用）。
 * - 搜索建议：`/api/search/searchGuess/index?keyword=`（源码 `search/searchGuess/index`）。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Search from '@icon-park/react/es/icons/Search';
import Down from '@icon-park/react/es/icons/Down';
import PcImageSearchEntry from '@/components/PcImageSearchEntry';

import { useTranslation } from 'react-i18next';
type SearchType = 'product' | 'shop';

interface GuessItem {
  keyword?: string;
}

export default function PcSearchBox({
  isWhite = false,
  accentColor = '',
  enableGuess = true,
  defaultSearchType = 'product',
}: {
  isWhite?: boolean;
  accentColor?: string;
  enableGuess?: boolean;
  defaultSearchType?: SearchType;
}) {
    const { t } = useTranslation();
  const [keyword, setKeyword] = useState('');
  const [focus, setFocus] = useState(false);
  const [guessList, setGuessList] = useState<GuessItem[]>([]);
  const [guessShow, setGuessShow] = useState(false);
  const [searchType, setSearchType] = useState<SearchType>(defaultSearchType);
  const [typeOpen, setTypeOpen] = useState(false);
  const [indexSearchShop, setIndexSearchShop] = useState(0);

  const guessTimer = useRef<number | null>(null);
  const guessBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/common/config/base')
      .then((response) => response.json())
      .then((json) => {
        const value = Number(json?.data?.indexSearchShop ?? 0);
        if (Number.isFinite(value)) setIndexSearchShop(value);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    // 源码从 route.query.keyword 同步（/search 页），这里用 location 以免触发 CSR bailout。
    try {
      const params = new URLSearchParams(window.location.search);
      const current = params.get('keyword');
      if (current) setKeyword(current);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!guessShow) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (guessBoxRef.current && target && !guessBoxRef.current.contains(target)) {
        setGuessShow(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [guessShow]);

  useEffect(() => {
    return () => {
      if (guessTimer.current) window.clearTimeout(guessTimer.current);
    };
  }, []);

  const showSearchTypeDropdown = indexSearchShop === 1;
  const shopLabel = '店铺';

  const getSearchUrl = (value: string): string => {
    const encoded = encodeURIComponent(value);
    if (searchType === 'shop' && showSearchTypeDropdown) return `/shop/list?keyword=${encoded}`;
    return `/search/?keyword=${encoded}`;
  };

  const requestGuess = (value: string) => {
    if (!enableGuess) {
      setGuessShow(false);
      return;
    }
    if (guessTimer.current) window.clearTimeout(guessTimer.current);
    guessTimer.current = window.setTimeout(() => {
      fetch(`/api/search/searchGuess/index?keyword=${encodeURIComponent(value)}`, { credentials: 'include' })
        .then((response) => response.json())
        .then((json) => {
          const list = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
          setGuessList(list);
          setGuessShow(list.length > 0);
        })
        .catch(() => undefined);
    }, 300);
  };

  const submit = useCallback(
    (value?: string) => {
      const next = String(value ?? keyword).trim();
      setKeyword(next);
      setGuessShow(false);
      window.location.href = getSearchUrl(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [keyword, searchType, showSearchTypeDropdown],
  );

  const onSubmitKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') submit();
  };

  const submitStyle = accentColor ? { backgroundColor: accentColor } : undefined;
  const typeOptions: Array<{ label: string; value: SearchType }> = [
    { label: '商品', value: 'product' },
    { label: shopLabel, value: 'shop' },
  ];

  return (
    <div className={`top-search${isWhite ? ' white' : ''}`}>
      <div className={`search-form${focus || keyword !== '' ? ' search-form-focus' : ''}`}>
        <div className="acea-row row-middle">
          {showSearchTypeDropdown ? (
            <div className={`search-type-select${typeOpen ? ' open' : ''}`}>
              <div
                className={`search-type-menu${typeOpen ? ' open' : ''}`}
                data-longest-label={shopLabel.length >= 2 ? shopLabel : '商品'}
              >
                {typeOptions.map((option, index) => (
                  <div
                    key={option.value}
                    className={`search-type-item${option.value === searchType ? ' active' : ''}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (index === 0) {
                        setTypeOpen((value) => !value);
                        return;
                      }
                      setSearchType(option.value);
                      setTypeOpen(false);
                    }}
                  >
                    <span className="search-type-label">{option.label}</span>
                    {index === 0 ? <Down className="arrow" size={14} /> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <input
            className="search-input"
            type="text"
            autoComplete="off"
            placeholder={t('请输入关键词')}
            name="keywords"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
            onKeyUp={() => requestGuess(keyword)}
            onKeyDown={onSubmitKeyDown}
          />

          {searchType !== 'shop' ? <PcImageSearchEntry /> : null}

          <button
            type="button"
            className="search-submit"
            style={submitStyle}
            aria-label={t('搜索')}
            title={t('搜索')}
            onClick={() => submit()}
          >
            <Search size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {enableGuess && guessShow ? (
        <div className="search-guess-box" ref={guessBoxRef}>
          {guessList.map((item, index) => (
            <div key={index} className="search-guess-item">
              <button type="button" className="serlink" onClick={() => submit(item.keyword ?? '')}>
                <span className="name">{item.keyword}</span>
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
