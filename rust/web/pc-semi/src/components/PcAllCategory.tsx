'use client';

/**
 * 全部分类入口（源码：view/pc/components/common/components/AllCategoryNew.vue）
 *
 * 与源码对齐的行为/结构：
 * - .category-wrap(.white) > .category-trigger > .bar-wrap/.content + .category-dropdown
 * - hover 300ms 展示、150ms 关闭；滚动/缩放同步下拉 top（fixed 定位）
 * - 楼层图标：图片 / 图标字体（getCatFloor 返回 icoDefinedCss 注入）/ 分类图片
 * - 右侧按当前楼层展示二级分类，随右侧滚动同步左侧高亮
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Down from '@icon-park/react/es/icons/Down';
import HamburgerButton from '@icon-park/react/es/icons/HamburgerButton';

type CatNode = Record<string, any> & {
  categoryId?: string | number;
  id?: string | number;
  categoryName?: string;
  name?: string;
  categoryLink?: string;
  categoryPic?: string;
  pic?: string;
  seoLink?: string;
  children?: CatNode[] | null;
};

type CatFloorItem = Record<string, any> & {
  catList?: CatNode[];
  catFloorId?: string | number;
  catFloorNames?: Array<Record<string, unknown>>;
  floorIcoFont?: string;
  imageUrl?: string;
  useImage?: number;
};

interface DisplayFloor {
  displayId: string;
  catFloorId: string | number | '';
  catFloorNames: Array<{ categoryTitleName: string; link: string }>;
  imageUrl: string;
  useImage: number;
  floorIcoFont: string;
  catList: CatNode[];
}

const SHOW_DELAY_MS = 300;
const LEAVE_DELAY_MS = 150;
const RIGHT_SCROLL_EDGE_PADDING = 20;
const DIRECT_CATEGORY_LINK = /^(?:(?:https?:)?\/\/|\/|#|mailto:|tel:)/i;

function categoryIdOf(cat?: CatNode | null): string {
  return String(cat?.categoryId ?? cat?.id ?? '');
}

function categoryNameOf(cat?: CatNode | null): string {
  return String(cat?.categoryName ?? cat?.name ?? '').trim();
}

function buildCategoryUrl(seoLink?: string, categoryId?: string | number, pId?: string | number): string {
  const params = new URLSearchParams();
  if (categoryId !== undefined && categoryId !== '') params.set('categoryId', String(categoryId));
  if (pId !== undefined && pId !== '') params.set('pId', String(pId));
  const query = params.toString();
  const path = seoLink ? `/list/${seoLink}` : '/list';
  return query ? `${path}?${query}` : path;
}

function formatCustomCategoryLink(link: string): string {
  return DIRECT_CATEGORY_LINK.test(link) ? link : `/${link}`;
}

function resolveCatUrl(cat: CatNode, pId?: string | number): string {
  const categoryLink = String(cat.categoryLink || '').trim();
  if (categoryLink) {
    if (categoryLink === 'list') return buildCategoryUrl(cat.seoLink, cat.categoryId ?? cat.id, pId);
    return formatCustomCategoryLink(categoryLink);
  }
  return buildCategoryUrl(cat.seoLink, cat.categoryId ?? cat.id, pId);
}

function resolveFloorTitleLink(
  categoryLink: string,
  payload: { seoLink?: string; categoryId?: string | number; catFloorId?: string | number },
): string {
  const link = String(categoryLink || '').trim();
  if (!link || link === 'list') return buildCategoryUrl(payload.seoLink, payload.categoryId, payload.catFloorId);
  return formatCustomCategoryLink(link);
}

export default function PcAllCategory({ isWhite = false }: { isWhite?: boolean }) {
  const [floors, setFloors] = useState<DisplayFloor[]>([]);
  const [visible, setVisible] = useState(false);
  const [activeId, setActiveId] = useState('');
  const [dropdownTop, setDropdownTop] = useState(0);

  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const rightBoxRef = useRef<HTMLDivElement>(null);
  const secondItemRef = useRef<Map<string, HTMLElement>>(new Map());
  const showTimer = useRef<number | null>(null);
  const leaveTimer = useRef<number | null>(null);

  const clearShowTimer = useCallback(() => {
    if (showTimer.current) {
      window.clearTimeout(showTimer.current);
      showTimer.current = null;
    }
  }, []);
  const clearLeaveTimer = useCallback(() => {
    if (leaveTimer.current) {
      window.clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }, []);

  useEffect(() => {
    fetch('/api/common/pc/getCatFloor')
      .then((response) => response.json())
      .then((json) => {
        const raw = json?.data?.catFloor ?? json?.catFloor ?? [];
        const icoCss = json?.data?.icoDefinedCss ?? json?.icoDefinedCss ?? '';
        if (typeof icoCss === 'string' && icoCss && typeof document !== 'undefined') {
          const styleId = 'pc-cat-floor-ico-css';
          let style = document.getElementById(styleId) as HTMLStyleElement | null;
          if (!style) {
            style = document.createElement('style');
            style.id = styleId;
            document.head.appendChild(style);
          }
          style.textContent = icoCss;
        }
        const list: CatFloorItem[] = Array.isArray(raw) ? raw : [];
        const mapped = list
          .map((floor, floorIdx): DisplayFloor => {
            const catList: CatNode[] = Array.isArray(floor.catList) ? floor.catList : [];
            const catFloorId = (floor.catFloorId ?? '') as string | number | '';
            const displayId = `${String(catFloorId || 'floor')}-${floorIdx}`;
            const firstCat = catList.find(
              (cat) => Boolean(cat.categoryId ?? cat.id) && (cat.categoryName ?? cat.name) !== '-',
            );
            const categoryId = firstCat?.categoryId ?? firstCat?.id ?? catFloorId;
            const seoLink = firstCat?.seoLink ?? '';
            const imageUrl = typeof floor.imageUrl === 'string' ? floor.imageUrl : '';
            const useImage = Number(floor.useImage ?? (imageUrl ? 1 : 0));
            const floorIcoFont = typeof floor.floorIcoFont === 'string' ? floor.floorIcoFont : '';
            const rawFloorNameList = Array.isArray(floor.catFloorNames)
              ? (floor.catFloorNames as Array<Record<string, unknown>>)
              : [];
            const catFloorNames =
              rawFloorNameList.length > 0
                ? rawFloorNameList
                    .map((item) => ({
                      categoryTitleName: String(item.categoryTitleName ?? '').trim(),
                      link: resolveFloorTitleLink(String(item.categoryLink ?? '').trim(), {
                        seoLink,
                        categoryId,
                        catFloorId,
                      }),
                    }))
                    .filter((item) => item.categoryTitleName && item.categoryTitleName !== '-')
                : catList
                    .map((cat) => ({
                      categoryTitleName: categoryNameOf(cat),
                      link: resolveCatUrl(cat, catFloorId),
                    }))
                    .filter((item) => item.categoryTitleName && item.categoryTitleName !== '-');
            return { displayId, catFloorId, catFloorNames, imageUrl, useImage, floorIcoFont, catList };
          })
          .filter((floor) => floor.catList.length > 0);
        setFloors(mapped);
        setActiveId((current) => (current && mapped.some((item) => item.displayId === current) ? current : mapped[0]?.displayId ?? ''));
      })
      .catch(() => undefined);
  }, []);

  const syncDropdownTop = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setDropdownTop(Math.max(0, Math.round(rect.bottom)));
  }, []);

  useEffect(() => {
    if (!visible) return;
    syncDropdownTop();
    const onScroll = () => syncDropdownTop();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [visible, syncDropdownTop]);

  useEffect(() => {
    return () => {
      clearShowTimer();
      clearLeaveTimer();
    };
  }, [clearShowTimer, clearLeaveTimer]);

  const handleMouseEnter = () => {
    clearLeaveTimer();
    if (visible || showTimer.current) return;
    showTimer.current = window.setTimeout(() => {
      setVisible(true);
      setActiveId((current) => current || floors[0]?.displayId || '');
      showTimer.current = null;
    }, SHOW_DELAY_MS);
  };

  const handleMouseLeave = () => {
    clearShowTimer();
    leaveTimer.current = window.setTimeout(() => setVisible(false), LEAVE_DELAY_MS);
  };

  const handleDropdownEnter = () => {
    clearLeaveTimer();
    syncDropdownTop();
  };

  const handleDropdownLeave = () => {
    clearShowTimer();
    leaveTimer.current = window.setTimeout(() => setVisible(false), LEAVE_DELAY_MS);
  };

  const floorNames = (floor: DisplayFloor): string[] => floor.catFloorNames.map((item) => item.categoryTitleName);

  const handleLeftMove = (displayId: string) => {
    setActiveId(displayId);
    if (rightBoxRef.current) rightBoxRef.current.scrollTop = 0;
  };

  const handleRightScroll = () => {
    const box = rightBoxRef.current;
    if (!box) return;
    const boxRect = box.getBoundingClientRect();
    let matchedId: string | null = null;
    let minRelativeTop = Number.POSITIVE_INFINITY;
    secondItemRef.current.forEach((element, displayId) => {
      const itemRect = element.getBoundingClientRect();
      const relativeTop = itemRect.top - boxRect.top - RIGHT_SCROLL_EDGE_PADDING;
      if (relativeTop >= 0 && relativeTop < 50 && relativeTop < minRelativeTop) {
        minRelativeTop = relativeTop;
        matchedId = displayId;
      }
    });
    if (matchedId) setActiveId(matchedId);
  };

  const rightDisplayCategories = useMemo(() => {
    if (!activeId) return floors;
    const current = floors.find((item) => item.displayId === activeId);
    return current ? [current] : floors;
  }, [floors, activeId]);

  return (
    <div className={`category-wrap${isWhite ? ' white' : ''}`}>
      <div className="category-trigger" ref={triggerRef} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        <div className="bar-wrap">
          <div className="content">
            <div className="icon" aria-hidden="true">
              <span className="pc-icon pc-icon--menu">
                <HamburgerButton size={14} />
              </span>
            </div>
            <div className="txt">分类</div>
            <div className="icon ml">
              <span className={`pc-icon pc-icon--arrow arrow${visible ? ' rotate' : ''}`}>
                <Down size={14} />
              </span>
            </div>
          </div>
        </div>

        {visible ? (
          <div
            className="category-dropdown"
            ref={dropdownRef}
            style={{ top: `${dropdownTop}px` }}
            onMouseEnter={handleDropdownEnter}
            onMouseLeave={handleDropdownLeave}
          >
            <div className="popover-cate-content">
              {floors.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center' }}>暂无分类数据</div>
              ) : (
                <div className="category-content-wrapper">
                  <div className="left-wrap">
                    {floors.map((floor) => (
                      <div
                        key={floor.displayId}
                        className={`cate_menu_item${String(activeId) === String(floor.displayId) ? ' active' : ''}`}
                        onMouseEnter={() => handleLeftMove(floor.displayId)}
                      >
                        <span className="cate_menu_icon" aria-hidden="true">
                          {floor.useImage === 1 && floor.imageUrl ? (
                            <img className="cate_menu_icon_img" src={floor.imageUrl} alt={floorNames(floor).join('/')} />
                          ) : floor.floorIcoFont ? (
                            <span className={`floor-ico ${floor.floorIcoFont}`} />
                          ) : null}
                        </span>
                        <div className="cate_menu_text">
                          <span className="cate_menu_text_inner">
                            {floor.catFloorNames.map((cat, catIndex) => (
                              <span key={String(cat.categoryTitleName || catIndex)}>
                                <Link target="_blank" className="cate_menu_lk" href={cat.link} onClick={(event) => event.stopPropagation()}>
                                  {cat.categoryTitleName}
                                </Link>
                                {catIndex < floor.catFloorNames.length - 1 ? <span className="cate_menu_line">/</span> : null}
                              </span>
                            ))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="right-wrap" ref={rightBoxRef} onScroll={handleRightScroll}>
                    {rightDisplayCategories.map((floor) => (
                      <div
                        key={floor.displayId}
                        className="cate-item-wrap"
                        data-id={floor.displayId}
                        ref={(element) => {
                          if (element) secondItemRef.current.set(floor.displayId, element);
                          else secondItemRef.current.delete(floor.displayId);
                        }}
                      >
                        <div className="cate-title-row">
                          {floor.catFloorNames.map((cat, catIndex) => (
                            <span key={String(cat.categoryTitleName || catIndex)}>
                              <span className="cate-title">{cat.categoryTitleName}</span>
                              {catIndex < floor.catFloorNames.length - 1 ? <span className="cate-menu-line">、</span> : null}
                            </span>
                          ))}
                        </div>
                        <div className="second-class-container">
                          {(floor.catList || []).map((cat) => {
                            const children = Array.isArray(cat.children) ? cat.children : [];
                            if (children.length) {
                              return children.map((child, childIndex) => (
                                <Link
                                  key={`${categoryIdOf(child)}-${childIndex}`}
                                  target="_blank"
                                  className={`second-class-item${child.categoryPic || child.pic ? '' : ' no-img'}`}
                                  href={resolveCatUrl(child, floor.catFloorId)}
                                >
                                  {child.categoryPic || child.pic ? (
                                    <div className="item-pic">
                                      <img src={String(child.categoryPic || child.pic)} alt={categoryNameOf(child)} />
                                    </div>
                                  ) : null}
                                  <div className="item-name">{categoryNameOf(child)}</div>
                                </Link>
                              ));
                            }
                            if (!categoryNameOf(cat) && !cat.categoryPic && !cat.pic) return null;
                            return (
                              <Link
                                key={categoryIdOf(cat)}
                                target="_blank"
                                className={`second-class-item${cat.categoryPic || cat.pic ? '' : ' no-img'}`}
                                href={resolveCatUrl(cat, floor.catFloorId)}
                              >
                                {cat.categoryPic || cat.pic ? (
                                  <div className="item-pic">
                                    <img src={String(cat.categoryPic || cat.pic)} alt={categoryNameOf(cat)} />
                                  </div>
                                ) : null}
                                <div className="item-name">{categoryNameOf(cat)}</div>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
