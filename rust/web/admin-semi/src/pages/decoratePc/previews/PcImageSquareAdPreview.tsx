/**
 * PC 图片魔方模块 - 预览组件
 *
 * 迁移自旧版（Vue）：
 * java-b2b2c-overseas-v5.8.61/view/admin/src/views/decorate/decorate/editor/modules/pcHome/pc-image-square-ad/Preview.vue
 * 样式逐行迁移自同目录 preview.less（见 ./pcImageSquareAd.css）。
 *
 * - props 统一 `{ data }`，与旧版 `pcImageSquareAdDefaults` 深合并；
 * - 布局 1/2/3 为等分栅格，4 为左二右二（列优先），5 左一右二，6 左一右三，7 上一下二。
 */
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { useI18n } from '../../../i18n';
import './pcImageSquareAd.css';

type AnyRecord = Record<string, any>;

/** 空图片占位（与旧版 `formatImage` 返回值逐字一致）。 */
const IMAGE_PLACEHOLDER =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23f0f0f0" width="100" height="100"/></svg>';

/** 旧版 `pcImageSquareAdDefaults`（逐字段一致）。 */
const pcImageSquareAdDefaults: AnyRecord = {
  picType: 1,
  picList: [
    {
      picId: '1',
      picUrl: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1731301937REbUnsSmPehWiBMaFd.webp',
      picThumb: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1731301937REbUnsSmPehWiBMaFd.webp',
      picName: '演示图片1',
      picTitle: '魔方图1',
      picLink: { link: '', name: '' },
    },
    {
      picId: '2',
      picUrl: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1731301941uaSjIShOBNL2VBSr0y.webp',
      picThumb: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1731301941uaSjIShOBNL2VBSr0y.webp',
      picName: '演示图片2',
      picTitle: '魔方图2',
      picLink: { link: '', name: '' },
    },
  ],
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

export default function PcImageSquareAdPreview({ data }: { data: Record<string, any> }) {
  const { t } = useI18n();

  const moduleConfig = useMemo(() => deepMerge(pcImageSquareAdDefaults, data), [data]);
  const picList = ((moduleConfig.picList || []) as AnyRecord[]).map((pic) => pic || {});
  const picType = Number(moduleConfig.picType ?? 1);

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

  const renderPic = (pic: AnyRecord | undefined, key: number, fill?: boolean): ReactNode => (
    <div className={`dec-image-cube__item${fill ? ' dec-image-cube__item--full-height' : ''}`} key={key}>
      <a className="dec-image-cube__link" href={pic?.picLink?.link || 'javascript:;'}>
        <img className="dec-image-cube__image" src={formatImage(pic?.picUrl)} alt="" />
      </a>
    </div>
  );

  let body: ReactNode;
  if (!picList.length) {
    body = (
      <div className="dec-image-cube__empty">
        <div className="dec-image-cube__empty-icon" />
        <div className="dec-image-cube__empty-text">{t('点击添加图片魔方')}</div>
      </div>
    );
  } else if (picType === 5) {
    // 布局类型5：左一右二
    body = (
      <div className="dec-image-cube__wrapper">
        <div className="dec-image-cube__layout-lr">
          {renderPic(picList[0], 0, true)}
          <div className="dec-image-cube__grid-rows">
            {renderPic(picList[1], 1)}
            {renderPic(picList[2], 2)}
          </div>
        </div>
      </div>
    );
  } else if (picType === 7) {
    // 布局类型7：上一下二
    body = (
      <div className="dec-image-cube__wrapper">
        <div className="dec-image-cube__layout-tb">
          {renderPic(picList[0], 0)}
          <div className="dec-image-cube__grid-cols">
            {renderPic(picList[1], 1)}
            {renderPic(picList[2], 2)}
          </div>
        </div>
      </div>
    );
  } else if (picType === 6) {
    // 布局类型6：左一右三
    body = (
      <div className="dec-image-cube__wrapper">
        <div className="dec-image-cube__layout-lr-3">
          {renderPic(picList[0], 0, true)}
          <div className="dec-image-cube__grid-nested">
            {renderPic(picList[1], 1)}
            <div className="dec-image-cube__grid-cols">
              {renderPic(picList[2], 2)}
              {renderPic(picList[3], 3)}
            </div>
          </div>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="dec-image-cube__wrapper">
        <div className="dec-image-cube__list">{picList.map((pic, index) => renderPic(pic, index))}</div>
      </div>
    );
  }

  return (
    <div className={`dec-image-cube dec-image-cube--layout-${picType}`} style={cssVars}>
      <div className="dec-image-cube__content">
        <ModuleTitle title={moduleConfig.title as AnyRecord} />
        {body}
      </div>
    </div>
  );
}
