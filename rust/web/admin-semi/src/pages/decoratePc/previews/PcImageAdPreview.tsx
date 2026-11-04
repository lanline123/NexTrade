/**
 * PC 图片广告模块 - 预览组件
 *
 * 迁移自旧版（Vue）：
 * java-b2b2c-overseas-v5.8.61/view/admin/src/views/decorate/decorate/editor/modules/pcHome/pc-image-ad/Preview.vue
 * 样式逐行迁移自同目录 preview.less（见 ./pcImageAd.css）。
 *
 * 说明：
 * - props 统一为 `{ data: Record<string, any> }`，内部与旧版 `pcImageAdDefaults` 深合并；
 * - DOM / 类名 / CSS 变量与旧版一致；
 * - 轮播使用等价 React 实现：3000ms 自动播放、无限循环、鼠标移入暂停、可点击指示器，
 *   并保留旧版 `.swiper-pagination` 类名以复用 preview.less 的指示器样式。
 */
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useI18n } from '../../../i18n';
import './pcImageAd.css';

type AnyRecord = Record<string, any>;

/** 空图片占位（与旧版 `formatImage` 返回值逐字一致）。 */
const IMAGE_PLACEHOLDER =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23f0f0f0" width="100" height="100"/></svg>';

/** 旧版 `pcImageAdDefaults`（逐字段一致）。 */
const pcImageAdDefaults: AnyRecord = {
  picType: 1,
  picList: [
    {
      picId: '1',
      picUrl: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1731301937REbUnsSmPehWiBMaFd.webp',
      picThumb: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1731301937REbUnsSmPehWiBMaFd.webp',
      picName: '演示图片1',
      picTitle: '广告位1',
      picLink: { link: '', name: '' },
    },
    {
      picId: '2',
      picUrl: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1731301941uaSjIShOBNL2VBSr0y.webp',
      picThumb: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1731301941uaSjIShOBNL2VBSr0y.webp',
      picName: '演示图片2',
      picTitle: '广告位2',
      picLink: { link: '', name: '' },
    },
  ],
  swiperPreView: 1,
  swiperPageColor: '#333333',
  imgPadding: 0,
  picPageType: 1,
  picRadioStyle: 1,
  isFluxWidth: 0,
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
  title: {
    showTitle: 0,
    titleStyle: 1,
    titleAlign: 1,
    titleBackground: '',
    titleBackground2: '',
    titleBackgroundPic: { picUrl: '', picThumb: '' },
    titleRadius: 0,
    titleText: '标题内容',
    titleColor: '',
    descText: '',
    descColor: '#aaaaaa',
    showMore: 0,
    moreLink: { link: '', title: '' },
    moreColor: '#aaaaaa',
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

export default function PcImageAdPreview({ data }: { data: Record<string, any> }) {
  const { t } = useI18n();

  const moduleConfig = useMemo(() => deepMerge(pcImageAdDefaults, data), [data]);
  const picList = (moduleConfig.picList || []) as AnyRecord[];
  const picType = Number(moduleConfig.picType ?? 1);
  const perView = Math.max(1, Number(moduleConfig.swiperPreView) || 1);

  const moduleClasses = useMemo(() => {
    const classes = [`dec-image-ad--layout-${picType}`];
    if (picType === 2) {
      classes.push(`dec-image-ad--indicator-${Number(moduleConfig.picPageType ?? 1)}`);
    }
    if (Number(moduleConfig.picRadioStyle) === 2) {
      classes.push('dec-image-ad--rounded');
    }
    if (Number(moduleConfig.isFluxWidth) === 1) {
      classes.push('dec-image-ad--flux');
    }
    return classes.join(' ');
  }, [picType, moduleConfig.picPageType, moduleConfig.picRadioStyle, moduleConfig.isFluxWidth]);

  const cssVars = useMemo(() => {
    const frame = (moduleConfig.frame || {}) as AnyRecord;
    const isFluxWidth = Number(moduleConfig.isFluxWidth) === 1;
    return {
      '--dec-box-padding': `${isFluxWidth ? 0 : Number(frame.boxPadding ?? 10)}px`,
      '--dec-box-padding-top': `${Number(frame.boxPaddingTop ?? 5)}px`,
      '--dec-box-padding-bottom': `${Number(frame.boxPaddingBottom ?? 5)}px`,
      '--dec-box-radius': `${Number(frame.boxRadius ?? 0)}px`,
      '--dec-bg-color': frame.backgroundColor ?? '#ffffff',
      '--dec-inner-padding': `${Number(moduleConfig.imgPadding ?? 0)}px`,
      '--dec-item-gap': `${Number(moduleConfig.imgPadding ?? 0)}px`,
      '--dec-item-radius': Number(moduleConfig.picRadioStyle) === 2 ? '8px' : '0',
      '--dec-indicator-color': moduleConfig.swiperPageColor ?? '#333333',
    } as CSSProperties;
  }, [moduleConfig]);

  // —— 轮播状态（旧版 Swiper：3000ms 自动播放、loop、pauseOnMouseEnter、clickable 分页）——
  const [activeIndex, setActiveIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const maxIndex = Math.max(0, picList.length - perView);

  useEffect(() => {
    setActiveIndex(0);
  }, [picList.length, perView]);

  useEffect(() => {
    if (picType !== 2 || hovered || picList.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index >= maxIndex ? 0 : index + 1));
    }, 3000);
    return () => window.clearInterval(timer);
  }, [picType, hovered, picList.length, maxIndex]);

  const trackStyle: CSSProperties = {
    width: `${(picList.length / perView) * 100}%`,
    transform: `translateX(-${(Math.min(activeIndex, maxIndex) * 100) / Math.max(picList.length, 1)}%)`,
  };

  const renderItem = (pic: AnyRecord, key: number): ReactNode => (
    <div className="dec-image-ad__item" key={key}>
      <a className="dec-image-ad__link" href={pic?.picLink?.link || 'javascript:;'}>
        <img className="dec-image-ad__image" src={formatImage(pic?.picUrl)} alt="" />
      </a>
    </div>
  );

  let body: ReactNode;
  if (!picList.length) {
    body = (
      <div className="dec-image-ad__empty">
        <div className="dec-image-ad__empty-icon" />
        <div className="dec-image-ad__empty-text">{t('点击添加图片广告')}</div>
      </div>
    );
  } else if (picType === 2) {
    body = (
      <div
        className="dec-image-ad__swiper"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="dec-image-ad__swiper-track" style={trackStyle}>
          {picList.map((pic, index) => (
            <div
              className="dec-image-ad__swiper-slide"
              key={index}
              style={{ width: `${100 / Math.max(picList.length, 1)}%` }}
            >
              {renderItem(pic, index)}
            </div>
          ))}
        </div>
        {picList.length > 1 ? (
          <div className="swiper-pagination">
            {picList.map((_, index) => (
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
  } else {
    body = <div className="dec-image-ad__list">{picList.map((pic, index) => renderItem(pic, index))}</div>;
  }

  return (
    <div className={`dec-image-ad ${moduleClasses}`} style={cssVars}>
      <div className="dec-image-ad__content">
        <ModuleTitle title={moduleConfig.title as AnyRecord} />
        {body}
      </div>
    </div>
  );
}
