/**
 * PC 热图绘制模块 - 预览组件
 *
 * 迁移自旧版（Vue）：
 * java-b2b2c-overseas-v5.8.61/view/admin/src/views/decorate/decorate/editor/modules/pcHome/pc-image-hotarea/Preview.vue
 * 样式逐行迁移自同目录 preview.less（见 ./pcImageHotarea.css）。
 *
 * - props 统一 `{ data }`，与旧版 `pcImageHotareaDefaults` 深合并；
 * - 热区坐标以旧版 500px 绘制区域为基准，按图片容器实际宽度等比缩放；
 * - 旧版用 ResizeObserver 监听每张图片容器宽度；React 侧按图片拆分子组件，
 *   每个子组件各持一个 ResizeObserver（渲染语义一致，避免 ref 回调抖动）。
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useI18n } from '../../../i18n';
import './pcImageHotarea.css';

type AnyRecord = Record<string, any>;

/** 热区绘制区域原始宽度（旧版常量）。 */
const HOTAREA_ORIGINAL_WIDTH = 500;

/** 空图片占位（与旧版 `formatImage` 返回值逐字一致）。 */
const IMAGE_PLACEHOLDER =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23f0f0f0" width="100" height="100"/></svg>';

/** 旧版 `pcImageHotareaDefaults`（逐字段一致）。 */
const pcImageHotareaDefaults: AnyRecord = {
  picList: [],
  imgPadding: 0,
  frame: {
    textColor: '',
    itemBackgroundColor: '',
    backgroundColor: '#ffffff',
    innerPadding: 0,
    itemHeight: 35,
    itemRadius: 3,
    boxRadius: 0,
    boxPadding: 10,
    leftAndRightPadding: 0,
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

/** 单张热图（独立 ResizeObserver，按容器宽度缩放 500px 基准热区）。 */
function HotareaPic({ pic }: { pic: AnyRecord }) {
  const [wrapWidth, setWrapWidth] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    setWrapWidth(Number(el.offsetWidth.toFixed(2)));
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setWrapWidth(Number(entry.contentRect.width.toFixed(2)));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [pic?.picUrl]);

  const resizeValue = (size: number): number => {
    if (!wrapWidth) return size;
    return (wrapWidth / HOTAREA_ORIGINAL_WIDTH) * size;
  };

  const getHotareaStyle = (hotarea: AnyRecord): CSSProperties => ({
    width: `${resizeValue(Number(hotarea?.width ?? 0))}px`,
    height: `${resizeValue(Number(hotarea?.height ?? 0))}px`,
    top: `${resizeValue(Number(hotarea?.top ?? 0))}px`,
    left: `${resizeValue(Number(hotarea?.left ?? 0))}px`,
  });

  const hotareas = (pic?.hotarea || []) as AnyRecord[];

  return (
    <div className="dec-image-hotarea__pic-wrap" ref={wrapRef}>
      <img className="dec-image-hotarea__image" src={formatImage(pic?.picUrl)} alt={pic?.picTitle} />
      {hotareas.map((hotarea, index) => (
        <a
          className="dec-image-hotarea__area"
          key={index}
          href={hotarea?.link?.link || 'javascript:;'}
          style={getHotareaStyle(hotarea)}
        >
          <span className="dec-image-hotarea__area-text">{hotarea?.link?.name}</span>
        </a>
      ))}
    </div>
  );
}

export default function PcImageHotareaPreview({ data }: { data: Record<string, any> }) {
  const { t } = useI18n();

  const moduleConfig = useMemo(() => deepMerge(pcImageHotareaDefaults, data), [data]);
  const picList = (moduleConfig.picList || []) as AnyRecord[];

  const cssVars = useMemo(() => {
    const frame = (moduleConfig.frame || {}) as AnyRecord;
    return {
      '--dec-box-padding': `${Number(frame.boxPadding ?? 10)}px`,
      '--dec-box-padding-top': `${Number(frame.boxPaddingTop ?? 5)}px`,
      '--dec-box-padding-bottom': `${Number(frame.boxPaddingBottom ?? 5)}px`,
      '--dec-box-radius': `${Number(frame.boxRadius ?? 0)}px`,
      '--dec-bg-color': frame.backgroundColor ?? '#ffffff',
      '--dec-inner-padding': `${Number(frame.leftAndRightPadding ?? frame.innerPadding ?? 0)}px`,
      '--dec-item-gap': `${Number(moduleConfig.imgPadding ?? 0)}px`,
    } as CSSProperties;
  }, [moduleConfig]);

  return (
    <div className="dec-image-hotarea" style={cssVars}>
      <div className="dec-image-hotarea__content">
        <ModuleTitle title={moduleConfig.title as AnyRecord} />

        {!picList.length ? (
          <div className="dec-image-hotarea__empty">
            <div className="dec-image-hotarea__empty-icon" />
            <div className="dec-image-hotarea__empty-text">{t('点击添加热图绘制')}</div>
          </div>
        ) : (
          <div className="dec-image-hotarea__wrapper">
            <div className="dec-image-hotarea__list">
              {picList.map((pic, index) => (
                <div className="dec-image-hotarea__item" key={index}>
                  <HotareaPic pic={pic} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
