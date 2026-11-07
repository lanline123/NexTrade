'use client';

/**
 * 店铺页搜索框（源码：view/pc/pages/shop/src/ShopSearchInput.vue）
 *
 * 结构/类名保持一致：.top-search > .search-form > input + PcImageSearchEntry + .search-buttons(.shop-search/.site-search)
 * 以及 .search-guess-box > ul.search-guess-ul。
 *
 * - 「搜本店」跳 `/shop/search/{shopId}?keyword=`；「搜全站」跳 `/search/?keyword=`
 * - 相机入口只搜本店（传 shopId）
 */
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import PcImageSearchEntry from '@/components/PcImageSearchEntry';

import { useTranslation } from 'react-i18next';
interface GuessItem {
  keyword?: string;
}

function resolveShopIdFromPath(pathname: string | null): number {
  if (!pathname) return 0;
  const match = pathname.match(/^\/shop\/(\d+)/);
  if (match) return Number(match[1]);
  const last = pathname.split('/').filter(Boolean).pop();
  const value = Number(last);
  return Number.isInteger(value) && value > 0 ? value : 0;
}

export default function PcShopSearchInput({ shopId, page = '' }: { shopId?: number | string; page?: string }) {
    const { t } = useTranslation();
  const pathname = usePathname();
  const initialShopId = Number(shopId && Number(shopId) > 0 ? shopId : resolveShopIdFromPath(pathname));
  const [keyword, setKeyword] = useState('');
  const [focus, setFocus] = useState(false);
  const [guessList, setGuessList] = useState<GuessItem[]>([]);
  const [guessShow, setGuessShow] = useState(false);
  const guessTimer = useRef<number | null>(null);
  const guessBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (page === 'search' && typeof window !== 'undefined') {
      try {
        const current = new URLSearchParams(window.location.search).get('keyword');
        if (current) setKeyword(current);
      } catch {
        /* ignore */
      }
    }
  }, [page]);

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

  const requestGuess = (value: string) => {
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

  const onSearchSubmit = () => {
    setGuessShow(false);
    window.location.href = `/search/?keyword=${encodeURIComponent(keyword)}`;
  };

  const onShopSearch = () => {
    setGuessShow(false);
    window.location.href = `/shop/search/${initialShopId}?keyword=${encodeURIComponent(keyword)}`;
  };

  const onSiteSearch = () => {
    setGuessShow(false);
    window.location.href = `/search/?keyword=${encodeURIComponent(keyword)}`;
  };

  return (
    <div className="top-search">
      <div className={`search-form${focus || keyword !== '' ? ' search-form-focus' : ''}`}>
        <input
          type="text"
          autoComplete="off"
          className="search-input"
          name="keywords"
          placeholder={t('搜索')}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          onKeyUp={() => requestGuess(keyword)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSearchSubmit();
          }}
        />
        <PcImageSearchEntry shopId={initialShopId > 0 ? initialShopId : undefined} />
        <div className="search-buttons">
          <button type="button" className="search-btn shop-search" onClick={onShopSearch}>{t('搜本店')}</button>
          <button type="button" className="search-btn site-search" onClick={onSiteSearch}>{t('搜全站')}</button>
        </div>
      </div>

      {guessShow ? (
        <div ref={guessBoxRef} className="search-guess-box">
          <ul className="search-guess-ul">
            {guessList.map((item, index) => (
              <li key={index}>
                <a className="serlink" href={`/search/?keyword=${encodeURIComponent(item.keyword ?? '')}`}>
                  <span className="name">{item.keyword}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
