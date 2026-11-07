/**
 * PC 分类导航3 模块 - 预览组件（React 迁移自 5.8.61 旧版
 * `view/admin/src/views/decorate/decorate/editor/modules/pcHome/pc-category-nav3/Preview.vue`）
 *
 * DOM / class 与旧版逐行对齐：
 *   .dec-pc-category-nav3                   外层（CSS 变量驱动 padding/高度/圆角/背景）
 *   .dec-pc-category-nav3__top/title/more   顶栏：24px 标题 + 右侧「更多 >」
 *   .dec-pc-category-nav3__list-wrap        列表区
 *   .dec-pc-category-nav3__empty            空态（请在设置中添加内容）
 *   .dec-pc-category-nav3__list/scroll      列表（横向滚动，一屏 6 卡）
 *   .dec-pc-category-nav3__item/link/image/img/name/desc/desc-icon/desc-text
 *
 * 说明：旧版图片仅原样返回 URL（不补 storageUrl 前缀），本组件保持一致；
 * 「火苗」描述图标来自 preview.less 内联 data URI，见 pcCategoryNav3.css。
 */
import { type CSSProperties } from 'react';
import { useI18n } from '../../../i18n';
import './pcCategoryNav3.css';

type AnyRecord = Record<string, any>;

interface PcCategoryNav3Item {
  picId?: string | number;
  picUrl?: string;
  picThumb?: string;
  picTitle?: string;
  picDesc?: string;
  picLink?: string | { link?: string };
  productName?: string;
  imageBackgroundColor?: string;
  gradientColorA?: string;
}

interface PcCategoryNav3Config {
  frame: AnyRecord;
  titleText: string;
  showMore: number;
  showMoreText: string;
  moreLink: { link?: string; name?: string };
  imageBackgroundColor: string;
  picList: PcCategoryNav3Item[];
  backgroundColor: string;
}

/** 旧版 `pcCategoryNav3Defaults`（逐字段对齐 index.ts）。 */
const DEFAULTS: PcCategoryNav3Config = {
  frame: {
    boxPadding: 0,
    boxPaddingTop: 0,
    boxPaddingBottom: 0,
    boxRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    boxHeight: 352,
  },
  titleText: '热门推荐',
  showMore: 1,
  showMoreText: '更多',
  moreLink: { link: '', name: '' },
  imageBackgroundColor: '',
  picList: [],
  backgroundColor: 'rgba(0, 0, 0, 0.02)',
};

const EMPTY_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Crect fill='%23f0f0f0' width='180' height='180'/%3E%3C/svg%3E";

function mergeConfig(data: AnyRecord | undefined): PcCategoryNav3Config {
  const source = data || {};
  return {
    ...DEFAULTS,
    ...source,
    frame: { ...DEFAULTS.frame, ...(source.frame || {}) },
    // 深合并：picList 为数组（整体覆盖，与旧版 deepMerge 行为一致）
    picList: Array.isArray(source.picList) ? source.picList : DEFAULTS.picList,
    moreLink: { ...DEFAULTS.moreLink, ...(source.moreLink || {}) },
  } as PcCategoryNav3Config;
}

function toHref(link?: string | { link?: string }): string {
  if (!link) return 'javascript:;';
  if (typeof link === 'string') return link || 'javascript:;';
  return link.link || 'javascript:;';
}

function formatImage(url?: string): string {
  return url && String(url).trim() ? String(url).trim() : EMPTY_IMG;
}

export default function PcCategoryNav3Preview({ data }: { data: Record<string, any> }) {
  const { t } = useI18n();
  const config = mergeConfig(data);
  const frame = config.frame || {};
  const picList = Array.isArray(config.picList) ? config.picList : [];

  // backgroundColor 优先于 frame.backgroundColor（同旧版）
  const bgColor = config.backgroundColor || frame.backgroundColor || 'rgba(0, 0, 0, 0.02)';
  const cssVars = {
    '--dec-box-padding': `${frame.boxPadding ?? 0}px`,
    '--dec-box-padding-top': `${frame.boxPaddingTop ?? 0}px`,
    '--dec-box-padding-bottom': `${frame.boxPaddingBottom ?? 0}px`,
    '--dec-box-radius': `${frame.boxRadius ?? 8}px`,
    '--dec-bg-color': bgColor,
    '--dec-box-height': `${frame.boxHeight ?? 352}px`,
  } as CSSProperties & Record<string, string>;

  const getImageBg = (item: PcCategoryNav3Item): string =>
    item.imageBackgroundColor ||
    config.imageBackgroundColor ||
    item.gradientColorA ||
    'var(--primary-light-9)';

  return (
    <div className="dec-pc-category-nav3" style={cssVars}>
      <div className="dec-pc-category-nav3__top">
        <div className="dec-pc-category-nav3__title">
          {config.titleText || t('热门推荐')}
        </div>
        {Number(config.showMore) === 1 && (
          <a
            className="dec-pc-category-nav3__more"
            href={toHref(config.moreLink)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="dec-pc-category-nav3__more-text">
              {config.showMoreText || t('更多')}
            </span>
            <span className="dec-pc-category-nav3__more-arrow">&gt;</span>
          </a>
        )}
      </div>

      <div className="dec-pc-category-nav3__list-wrap">
        {picList.length === 0 ? (
          <div className="dec-pc-category-nav3__empty">
            <div className="dec-pc-category-nav3__empty-text">{t('请在设置中添加内容')}</div>
          </div>
        ) : (
          <div className="dec-pc-category-nav3__list">
            <div className="dec-pc-category-nav3__scroll" aria-label={t('分类导航列表')}>
              {picList.map((item, index) => (
                <div
                  className="dec-pc-category-nav3__item"
                  key={String(item.picId || index)}
                >
                  <a
                    className="dec-pc-category-nav3__link"
                    href={toHref(item.picLink)}
                    title={String(item.productName || item.picTitle || '')}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div
                      className="dec-pc-category-nav3__image"
                      style={{ backgroundColor: getImageBg(item) }}
                    >
                      <img
                        className="dec-pc-category-nav3__img"
                        src={formatImage(item.picUrl || item.picThumb)}
                        alt={String(item.picTitle || '')}
                      />
                    </div>
                    <div className="dec-pc-category-nav3__name">{item.picTitle}</div>
                    {item.picDesc ? (
                      <div className="dec-pc-category-nav3__desc">
                        <span className="dec-pc-category-nav3__desc-icon" aria-hidden="true" />
                        <span className="dec-pc-category-nav3__desc-text">{item.picDesc}</span>
                      </div>
                    ) : null}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
