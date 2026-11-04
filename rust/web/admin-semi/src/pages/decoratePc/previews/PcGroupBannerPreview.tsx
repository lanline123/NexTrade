/**
 * PC 分组轮播 Banner 模块 - 预览组件
 *
 * 迁移自旧版（Vue）：
 * java-b2b2c-overseas-v5.8.61/view/admin/src/views/decorate/decorate/editor/modules/pcHome/pc-group-banner/Preview.vue
 * 样式逐行迁移自同目录 preview.less（见 ./pcGroupBanner.css）。
 *
 * 说明：
 * - props 统一为 `{ data: Record<string, any> }`，内部与旧版 `pcGroupBannerDefaults` 深合并；
 * - DOM / 类名 / CSS 变量与旧版一致；
 * - 旧版轮播基于 swiper 封装（autoplay 5000ms / spaceBetween 30 / loop 条件开启 / 隐藏分页）；
 *   新项目无 swiper 依赖，这里用等价 React 轮播实现：5000ms 自动播放、鼠标移入暂停、
 *   图片足够时循环，保留 `.swiper-button-prev/.swiper-button-next` 类名复用箭头样式；
 *   分页沿用旧版「不展示指示点」的行为（不渲染 `.swiper-pagination`）。
 */
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useI18n } from '../../../i18n';
import './pcGroupBanner.css';

type AnyRecord = Record<string, any>;

/** 空图片占位（与旧版 `formatImage` 返回值逐字一致）。 */
const IMAGE_PLACEHOLDER =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23f0f0f0" width="100" height="100"/></svg>';

/** 旧版 `pcGroupBannerDefaults`（逐字段一致）。 */
const pcGroupBannerDefaults: AnyRecord = {
  frame: {
    backgroundColor: '#ffffff',
    boxPadding: 10,
    boxPaddingTop: 0,
    boxPaddingBottom: 0,
    boxRadius: 8,
    slideHeight: 195,
  },
  bannerStyle: 1,
  showCat: 1,
  logo: {
    picUrl: '',
    picThumb: '',
  },
  picList: [
    {
      picId: '1',
      picUrl: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1731301937REbUnsSmPehWiBMaFd.webp',
      picThumb: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1731301937REbUnsSmPehWiBMaFd.webp',
      picName: '演示图片1',
      picTitle: 'Banner1',
      picLink: { link: '', name: '' },
    },
    {
      picId: '2',
      picUrl: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1731301941uaSjIShOBNL2VBSr0y.webp',
      picThumb: 'https://oss.vortmall.com/upload/c4ca4238/img/gallery/202411/1731301941uaSjIShOBNL2VBSr0y.webp',
      picName: '演示图片2',
      picTitle: 'Banner2',
      picLink: { link: '', name: '' },
    },
  ],
  picList2: [],
  picList3: [],
  number: 3,
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

export default function PcGroupBannerPreview({ data }: { data: Record<string, any> }): ReactNode {
  const { t } = useI18n();

  const moduleConfig = useMemo(() => deepMerge(pcGroupBannerDefaults, data), [data]);
  const picList = useMemo(() => (moduleConfig.picList || []) as AnyRecord[], [moduleConfig.picList]);

  const displayNum = useMemo(() => {
    const raw = Number(moduleConfig.number ?? 3);
    if (!Number.isFinite(raw)) return 3;
    return Math.min(3, Math.max(1, raw));
  }, [moduleConfig.number]);

  /** 模块类名（布局变体） */
  const moduleClasses = `dec-pc-group-banner--num-${displayNum}`;

  /** CSS 变量（传递动态值到样式） */
  const cssVars = useMemo(() => {
    const frame = (moduleConfig.frame || {}) as AnyRecord;
    const backgroundColor = frame.backgroundColor;
    return {
      '--dec-box-padding': `${frame.boxPadding ?? 10}px`,
      '--dec-box-padding-top': `${frame.boxPaddingTop ?? 0}px`,
      '--dec-box-padding-bottom': `${frame.boxPaddingBottom ?? 0}px`,
      '--dec-box-radius': `${frame.boxRadius ?? 8}px`,
      '--dec-bg-color': backgroundColor || 'transparent',
      '--dec-slide-height': `${frame.slideHeight ?? 195}px`,
    } as CSSProperties;
  }, [moduleConfig.frame]);

  const count = picList.length;

  const realSlidesPerView = Math.min(displayNum, count > 0 ? count : 1);
  const loopEnabled = count >= realSlidesPerView * 2;
  const pages = Math.max(1, Math.ceil(count / realSlidesPerView));

  // loop 条件满足时追加首组图片，保证翻页视觉连续；不满足时仅渲染真实图片
  const slides = useMemo(() => {
    if (!loopEnabled) return picList;
    return [...picList, ...picList.slice(0, realSlidesPerView)];
  }, [picList, loopEnabled, realSlidesPerView]);

  const [pageIndex, setPageIndex] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    setPageIndex(0);
  }, [count, displayNum]);

  // autoplay：5000ms，pauseOnMouseEnter
  useEffect(() => {
    if (hovered || pages <= 1) return undefined;
    const timer = window.setInterval(() => {
      setPageIndex((index) => (index + 1) % pages);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [hovered, pages]);

  const goPrev = () => setPageIndex((index) => (index - 1 + pages) % pages);
  const goNext = () => setPageIndex((index) => (index + 1) % pages);

  const trackStyle: CSSProperties = {
    width: `${(slides.length / realSlidesPerView) * 100}%`,
    transform: `translateX(-${(pageIndex * realSlidesPerView * 100) / Math.max(slides.length, 1)}%)`,
  };

  return (
    <div className={`dec-pc-group-banner ${moduleClasses}`} style={cssVars}>
      {!picList.length ? (
        <div className="dec-pc-group-banner__empty">
          <div className="dec-pc-group-banner__empty-text">{t('点击添加分组轮播Banner')}</div>
        </div>
      ) : (
        <div className="dec-pc-group-banner__inner">
          <div
            className="dec-pc-group-banner__carousel"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <div className="dec-pc-group-banner__track" style={trackStyle}>
              {slides.map((item, index) => (
                <div
                  className="dec-pc-group-banner__slide"
                  key={`${item?.picId ?? 'slide'}-${index}`}
                  style={{
                    width: `${100 / Math.max(slides.length, 1)}%`,
                    paddingRight: realSlidesPerView > 1 ? '30px' : undefined,
                  }}
                >
                  <a
                    className="dec-pc-group-banner__link"
                    href={item?.picLink?.link || 'javascript:;'}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img className="dec-pc-group-banner__img" src={formatImage(item?.picUrl)} alt="" />
                  </a>
                </div>
              ))}
            </div>

            {count > 1 ? (
              <>
                <div className="swiper-button-prev" onClick={goPrev} />
                <div className="swiper-button-next" onClick={goNext} />
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
