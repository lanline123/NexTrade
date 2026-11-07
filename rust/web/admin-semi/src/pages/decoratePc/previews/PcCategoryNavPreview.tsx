/**
 * PC 分类导航模块 - 预览组件（React 迁移自 5.8.61 旧版
 * `view/admin/src/views/decorate/decorate/editor/modules/pcHome/pc-category-nav/Preview.vue`）
 *
 * DOM / class 与旧版逐行对齐：
 *   .dec-pc-category-nav            外层：frame 留白（padding）+ 背景色 + 圆角
 *   .dec-pc-category-nav__inner     内层：内容背景色、圆角、固定高度
 *   .dec-pc-category-nav__top       标题栏（showTitle === 1）
 *   .dec-pc-category-nav__list-wrap 列表区（loading / 空态 / 列表）
 *   .dec-pc-category-nav__list      列表 + 左右滚动箭头
 *   .dec-pc-category-nav__item/link/image/img/name
 *
 * 说明：
 * - 旧版使用 `@/components/swiper`（Swiper 封装）实现分页/自动播放/圆形箭头；
 *   admin-semi 无 swiper 依赖，这里用原生横向滚动 + 圆形箭头复刻同一交互，
 *   自动播放（delay 5000 / 悬停暂停 / 循环）以定时器实现，样式见 pcCategoryNav.css。
 * - 热门分类取数与旧版一致：`GET /product/category/list?page=1&size=100&parentId=-1`
 *   后前端筛选 isHot=1 && isShow=1（接口复用 apiGet）。
 * - 旧版 `imageFormat` 会补 storageUrl 前缀；admin preview 未注入 storage 配置，
 *   这里仅对 `VITE_STORAGE_URL` 存在且 URL 非 http 时拼接（其余原样返回），
 *   与 PcDecorateEditor 内联预览口径一致。
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from 'react';
import { apiGet } from '../../../api';
import { useI18n } from '../../../i18n';
import './pcCategoryNav.css';

type AnyRecord = Record<string, any>;

interface CategoryRow {
  categoryId?: number | string;
  categoryName?: string;
  categoryPic?: string;
  picUrl?: string;
  pic?: string;
  isHot?: number | string;
  isShow?: number | string;
}

const EMPTY_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Crect fill='%23f0f0f0' width='180' height='180'/%3E%3C/svg%3E";

const STORAGE_URL = (import.meta.env.VITE_STORAGE_URL as string | undefined) || '';

interface PcCategoryNavConfig {
  frame: AnyRecord;
  titleName: string;
  showTitle: number;
  displayNum: number;
  backgroundColor: string;
}

/** 旧版 `pcCategoryNavDefaults`（深合并默认值，逐字段对齐 index.ts）。 */
const DEFAULTS: PcCategoryNavConfig = {
  frame: {
    boxPadding: 0,
    boxPaddingTop: 0,
    boxPaddingBottom: 0,
    boxRadius: 8,
    backgroundColor: '#f7f7f7',
    boxHeight: 328,
  },
  titleName: '热门分类',
  showTitle: 1,
  displayNum: 6,
  backgroundColor: '#f7f7f7',
};

/** 深合并旧版 defaults（frame 为唯一嵌套层，逐字段合并）。 */
function mergeConfig(data: AnyRecord | undefined): PcCategoryNavConfig {
  const source = data || {};
  return {
    ...DEFAULTS,
    ...source,
    frame: { ...DEFAULTS.frame, ...(source.frame || {}) },
  } as PcCategoryNavConfig;
}

function formatImage(url?: string): string {
  if (!url || !String(url).trim()) return EMPTY_IMG;
  const raw = String(url).trim();
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:')) return raw;
  return STORAGE_URL ? `${STORAGE_URL}${raw.replace(/^\/+/, '')}` : raw;
}

function handleImgError(event: SyntheticEvent<HTMLImageElement>): void {
  const img = event.currentTarget;
  if (img.src === EMPTY_IMG) return;
  img.onerror = null;
  img.src = EMPTY_IMG;
}

export default function PcCategoryNavPreview({ data }: { data: Record<string, any> }) {
  const { t } = useI18n();
  const config = mergeConfig(data);
  const frame = config.frame || {};
  const displayNum = Math.min(10, Math.max(1, Number(config.displayNum) || 6));

  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const hoverRef = useRef(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiGet<{ records?: CategoryRow[]; list?: CategoryRow[] }>('/product/category/list', {
      page: 1,
      size: 100,
      parentId: -1,
    })
      .then((res) => {
        if (!alive) return;
        const all = res?.records || res?.list || [];
        // 后端 getAllCategory 树节点不含 isHot，旧版同样改走 list 接口后前端筛选
        setRows(all.filter((c) => Number(c.isHot) === 1 && Number(c.isShow) === 1));
      })
      .catch(() => {
        if (alive) setRows([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const scrollByPage = useCallback((direction: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const step = el.clientWidth || 1;
    if (direction > 0) {
      if (el.scrollLeft >= max - 2) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: step, behavior: 'smooth' });
      }
    } else if (el.scrollLeft <= 2) {
      el.scrollTo({ left: max, behavior: 'smooth' });
    } else {
      el.scrollBy({ left: -step, behavior: 'smooth' });
    }
  }, []);

  // 旧版 Swiper 自动播放：delay 5000、悬停暂停、可循环
  const canLoop = rows.length > displayNum;
  useEffect(() => {
    if (!canLoop) return undefined;
    const timer = window.setInterval(() => {
      if (hoverRef.current) return;
      scrollByPage(1);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [canLoop, rows.length, displayNum, scrollByPage]);

  const frameStyle: CSSProperties = {
    backgroundColor: frame.backgroundColor || 'transparent',
    borderRadius: `${frame.boxRadius ?? 8}px`,
    overflow: Number(frame.boxRadius ?? 8) ? 'hidden' : undefined,
    paddingLeft: `${frame.boxPadding ?? 0}px`,
    paddingRight: `${frame.boxPadding ?? 0}px`,
    paddingTop: `${frame.boxPaddingTop ?? 0}px`,
    paddingBottom: `${frame.boxPaddingBottom ?? 0}px`,
  };

  const innerStyle: CSSProperties = {
    backgroundColor: config.backgroundColor || '#f7f7f7',
    borderRadius: '8px',
    height: `${frame.boxHeight ?? 328}px`,
  };

  return (
    <div className="dec-pc-category-nav" style={frameStyle}>
      <div className="dec-pc-category-nav__inner" style={innerStyle}>
        {Number(config.showTitle) === 1 && (
          <div className="dec-pc-category-nav__top">
            <div className="dec-pc-category-nav__title">
              {config.titleName || t('热门分类')}
            </div>
          </div>
        )}

        <div className="dec-pc-category-nav__list-wrap">
          {loading ? (
            <div className="dec-pc-category-nav__empty">
              <div className="dec-pc-category-nav__empty-text">{t('加载中...')}</div>
            </div>
          ) : rows.length === 0 ? (
            <div className="dec-pc-category-nav__empty">
              <div className="dec-pc-category-nav__empty-text">
                {t('暂无热门分类（请在分类管理中勾选"热门"）')}
              </div>
            </div>
          ) : (
            <div
              className="dec-pc-category-nav__list"
              onMouseEnter={() => {
                hoverRef.current = true;
              }}
              onMouseLeave={() => {
                hoverRef.current = false;
              }}
            >
              <div className="dec-pc-category-nav__scroll" ref={scrollRef}>
                {rows.map((item, index) => (
                  <div
                    className="dec-pc-category-nav__item"
                    key={String(item.categoryId ?? index)}
                    style={{ flex: `0 0 calc(100% / ${displayNum})` }}
                  >
                    <a className="dec-pc-category-nav__link" href="javascript:;">
                      <div className="dec-pc-category-nav__image">
                        <img
                          className="dec-pc-category-nav__img"
                          src={formatImage(item.categoryPic || item.picUrl || item.pic)}
                          alt={item.categoryName || ''}
                          onError={handleImgError}
                        />
                      </div>
                      <div className="dec-pc-category-nav__name">{item.categoryName}</div>
                    </a>
                  </div>
                ))}
              </div>
              {canLoop && (
                <>
                  <button
                    type="button"
                    className="dec-pc-category-nav__arrow dec-pc-category-nav__arrow--prev"
                    aria-label={t('上一组')}
                    onClick={() => scrollByPage(-1)}
                  />
                  <button
                    type="button"
                    className="dec-pc-category-nav__arrow dec-pc-category-nav__arrow--next"
                    aria-label={t('下一组')}
                    onClick={() => scrollByPage(1)}
                  />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
