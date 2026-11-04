/**
 * PC 图文导航模块 - 预览组件
 *
 * 迁移自旧版（Vue）：
 * java-b2b2c-overseas-v5.8.61/view/admin/src/views/decorate/decorate/editor/modules/pcHome/pc-image-nav/Preview.vue
 * 样式逐行迁移自同目录 preview.less（见 ./pcImageNav.css）。
 *
 * - props 统一 `{ data }`，与旧版 `pcImageNavDefaults` 深合并；
 * - navType=1 固定显示（rowNum×colNum 栅格），navType=2 滑动分页；
 * - 分页轮播：3000ms 自动播放、无限循环、鼠标移入暂停、可点击指示器（等价旧 Swiper 配置）。
 */
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useI18n } from '../../../i18n';
import './pcImageNav.css';

type AnyRecord = Record<string, any>;

/** 空图片占位（与旧版 `formatImage` 返回值逐字一致）。 */
const IMAGE_PLACEHOLDER =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23f0f0f0" width="100" height="100"/></svg>';

/** 旧版 `pcImageNavDefaults`（逐字段一致）。 */
const pcImageNavDefaults: AnyRecord = {
  navType: 1,
  navStyle: 1,
  rowNum: 4,
  colNum: 2,
  picList: [],
  backgroundColor: '#ffffff',
  imgPadding: 8,
  radioStyle: 1,
  picPageType: 1,
  swiperPageColor: '#333333',
  frame: {
    textColor: '',
    itemBackgroundColor: '',
    backgroundColor: '#ffffff',
    innerPadding: 0,
    itemHeight: 35,
    itemRadius: 3,
    boxRadius: 0,
    boxPadding: 10,
    boxPaddingTop: 5,
    boxPaddingBottom: 5,
  },
};

/** 旧版 `deepMerge`：嵌套普通对象递归合并，数组整体覆盖，`undefined` 保留默认值。 */
function deepMerge<T extends AnyRecord>(defaults: T, source?: AnyRecord): T {
  const result: AnyRecord = { ...defaults };
  if (!source || typeof source !== 'object') return result as T;
  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const defaultValue = (defaults as AnyRecord)[key];
    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      defaultValue !== null &&
      typeof defaultValue === 'object' &&
      !Array.isArray(defaultValue)
    ) {
      result[key] = deepMerge(defaultValue as AnyRecord, sourceValue as AnyRecord);
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue;
    }
  }
  return result as T;
}

/** 与旧版 `formatImage` 一致：无图时返回内联 SVG 占位。 */
function formatImage(url?: string): string {
  if (!url) return IMAGE_PLACEHOLDER;
  return url;
}

/**
 * 模块标题预览（对齐旧版 `_shared/ModuleTitle.vue`：样式一/二/三、对齐、背景色、圆角、更多）。
 */
function ModuleTitle({ title }: { title?: AnyRecord }): ReactNode {
  const { t } = useI18n();
  if (!title || !title.showTitle) return null;

  const titleStyle = Number(title.titleStyle) || 1;
  const align = Number(title.titleAlign) || 1;
  const titleIcon = title.titleBackgroundPic?.picUrl || title.titleBackgroundPic?.picThumb || '';

  const containerStyle: CSSProperties = {};
  if (title.titleBackground2 && title.titleBackground) {
    containerStyle.background = `linear-gradient(to right, ${title.titleBackground}, ${title.titleBackground2})`;
  } else if (title.titleBackground) {
    containerStyle.backgroundColor = title.titleBackground;
  }
  if (title.titleRadius) {
    containerStyle.borderRadius = `${title.titleRadius}px ${title.titleRadius}px 0 0`;
  }

  return (
    <div
      className={`dec-module-title dec-module-title--style-${titleStyle} dec-module-title--align-${align}`}
      style={containerStyle}
    >
      <div className="dec-module-title__left">
        {titleIcon ? <img className="dec-module-title__icon" src={titleIcon} alt="" /> : null}
        <div className="dec-module-title__text" style={{ color: title.titleColor || '#2a3145' }}>
          {title.titleText}
        </div>
        {title.descText ? (
          <div className="dec-module-title__desc" style={{ color: title.descColor || '#aaaaaa' }}>
            {title.descText}
          </div>
        ) : null}
      </div>

      {title.showMore ? (
        <div className="dec-module-title__right">
          <a
            className="dec-module-title__more"
            href={title.moreLink?.link || 'javascript:;'}
            style={{ color: title.moreColor || '#969799' }}
          >
            <span>{title.moreLink?.title || t('更多')}</span>
            <i className="dec-module-title__arrow">›</i>
          </a>
        </div>
      ) : null}
    </div>
  );
}

export default function PcImageNavPreview({ data }: { data: Record<string, any> }) {
  const { t } = useI18n();

  const moduleConfig = useMemo(() => deepMerge(pcImageNavDefaults, data), [data]);
  const picList = (moduleConfig.picList || []) as AnyRecord[];
  const navType = Number(moduleConfig.navType ?? 1);
  const navStyle = Number(moduleConfig.navStyle ?? 1);

  const itemsPerPage = useMemo(() => {
    const rowNum = Number(moduleConfig.rowNum ?? 4);
    const colNum = Number(moduleConfig.colNum ?? 2);
    const safeRowNum = Number.isFinite(rowNum) ? Math.min(6, Math.max(3, rowNum)) : 4;
    const safeColNum = Number.isFinite(colNum) ? Math.min(3, Math.max(1, colNum)) : 2;
    return safeRowNum * safeColNum;
  }, [moduleConfig.rowNum, moduleConfig.colNum]);

  const fixedList = useMemo(() => picList.slice(0, itemsPerPage), [picList, itemsPerPage]);

  const swiperPages = useMemo(() => {
    if (navType !== 2) return [] as AnyRecord[][];
    const pages: AnyRecord[][] = [];
    for (let i = 0; i < picList.length; i += itemsPerPage) {
      pages.push(picList.slice(i, i + itemsPerPage));
    }
    return pages;
  }, [navType, picList, itemsPerPage]);

  const moduleClasses = useMemo(() => {
    const classes = [
      `dec-pc-image-nav--type-${navType}`,
      `dec-pc-image-nav--style-${navStyle}`,
      `dec-pc-image-nav--indicator-${Number(moduleConfig.picPageType ?? 1)}`,
    ];
    if (Number(moduleConfig.radioStyle) === 2) {
      classes.push('dec-pc-image-nav--rounded');
    }
    return classes.join(' ');
  }, [navType, navStyle, moduleConfig.picPageType, moduleConfig.radioStyle]);

  const cssVars = useMemo(() => {
    const frame = (moduleConfig.frame || {}) as AnyRecord;
    // 内容背景色（内容设置）作用在内容区，容器背景色（扩展设置-容器设置）作用在外层
    const contentBgColor = moduleConfig.backgroundColor || '#ffffff';
    const outerBgColor = frame.backgroundColor || '#ffffff';
    const rowNum = Number(moduleConfig.rowNum ?? 4);
    const colNum = Number(moduleConfig.colNum ?? 2);
    return {
      '--dec-box-padding': `${Number(frame.boxPadding ?? 10)}px`,
      '--dec-box-padding-top': `${Number(frame.boxPaddingTop ?? 5)}px`,
      '--dec-box-padding-bottom': `${Number(frame.boxPaddingBottom ?? 5)}px`,
      '--dec-box-radius': `${Number(frame.boxRadius ?? 0)}px`,
      '--dec-bg-color': contentBgColor,
      '--dec-outer-bg': outerBgColor,
      '--dec-row-num': Number.isFinite(rowNum) ? Math.min(6, Math.max(3, rowNum)) : 4,
      '--dec-col-num': Number.isFinite(colNum) ? Math.min(3, Math.max(1, colNum)) : 2,
      '--dec-item-gap': `${Number(moduleConfig.imgPadding ?? 8)}px`,
      '--dec-item-radius': Number(moduleConfig.radioStyle) === 2 ? '8px' : '0',
      '--dec-indicator-color': moduleConfig.swiperPageColor ?? '#333333',
    } as CSSProperties;
  }, [moduleConfig]);

  // —— 分页轮播状态（旧版 Swiper：3000ms 自动播放、loop、pauseOnMouseEnter、clickable 分页）——
  const [activeIndex, setActiveIndex] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    setActiveIndex(0);
  }, [swiperPages.length]);

  useEffect(() => {
    if (navType !== 2 || hovered || swiperPages.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index >= swiperPages.length - 1 ? 0 : index + 1));
    }, 3000);
    return () => window.clearInterval(timer);
  }, [navType, hovered, swiperPages.length]);

  const trackStyle: CSSProperties = {
    width: `${swiperPages.length * 100}%`,
    transform: `translateX(-${(activeIndex * 100) / Math.max(swiperPages.length, 1)}%)`,
  };

  const renderItem = (item: AnyRecord, key: number): ReactNode => (
    <div className="dec-pc-image-nav__item" key={key}>
      <a className="dec-pc-image-nav__link" href={item?.picLink?.link || 'javascript:;'}>
        {navStyle === 1 || navStyle === 2 ? (
          <div className="dec-pc-image-nav__icon">
            <img className="dec-pc-image-nav__image" src={formatImage(item?.picUrl)} alt={item?.picTitle} />
          </div>
        ) : null}
        {navStyle === 1 || navStyle === 3 ? (
          <div className="dec-pc-image-nav__text">{item?.picTitle}</div>
        ) : null}
      </a>
    </div>
  );

  let body: ReactNode;
  if (!picList.length) {
    body = (
      <div className="dec-pc-image-nav__empty">
        <div className="dec-pc-image-nav__empty-icon" />
        <div className="dec-pc-image-nav__empty-text">{t('点击添加图文导航')}</div>
      </div>
    );
  } else if (navType === 1) {
    body = <div className="dec-pc-image-nav__grid">{fixedList.map((item, index) => renderItem(item, index))}</div>;
  } else {
    body = (
      <div
        className="dec-pc-image-nav__swiper"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="dec-pc-image-nav__swiper-track" style={trackStyle}>
          {swiperPages.map((page, pageIndex) => (
            <div
              className="dec-pc-image-nav__swiper-slide"
              key={pageIndex}
              style={{ width: `${100 / Math.max(swiperPages.length, 1)}%` }}
            >
              <div className="dec-pc-image-nav__swiper-page">
                {page.map((item, index) => renderItem(item, index))}
              </div>
            </div>
          ))}
        </div>
        {swiperPages.length > 1 ? (
          <div className="swiper-pagination">
            {swiperPages.map((_, index) => (
              <span
                key={index}
                className={
                  index === activeIndex
                    ? 'swiper-pagination-bullet swiper-pagination-bullet-active'
                    : 'swiper-pagination-bullet'
                }
                onClick={() => setActiveIndex(index)}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`dec-pc-image-nav ${moduleClasses}`} style={cssVars}>
      <div className="dec-pc-image-nav__content">
        <ModuleTitle title={moduleConfig.title as AnyRecord} />
        {body}
      </div>
    </div>
  );
}
