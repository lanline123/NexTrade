/**
 * PC 轮播 Banner2 模块 - 预览组件
 *
 * 迁移自旧版（Vue）：
 * java-b2b2c-overseas-v5.8.61/view/admin/src/views/decorate/decorate/editor/modules/pcHome/pc-banner2/Preview.vue
 * 样式逐行迁移自同目录 preview.less（见 ./pcBanner2.css）。
 *
 * 说明：
 * - props 统一为 `{ data: Record<string, any> }`，内部与旧版 `pcBanner2Defaults` 深合并；
 * - DOM / 类名 / CSS 变量与旧版一致；
 * - 旧版轮播基于 swiper 封装（autoplay 5000ms / loop / navigation / clickable 分页）；
 *   新项目无 swiper 依赖，这里用等价 React 轮播实现：5000ms 自动播放、循环翻页、
 *   鼠标移入暂停、箭头与可点击分页，并保留 `.swiper-button-prev/.swiper-button-next/
 *   .swiper-pagination-bullet` 类名以复用 preview.less 的箭头与指示点样式。
 */
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useI18n } from '../../../i18n';
import './pcBanner2.css';

type AnyRecord = Record<string, any>;

/** 空图片占位（与旧版 `formatImage` 返回值逐字一致）。 */
const IMAGE_PLACEHOLDER =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23f0f0f0" width="100" height="100"/></svg>';

/** 旧版 `pcBanner2Defaults`（逐字段一致）。 */
const pcBanner2Defaults: AnyRecord = {
  frame: {
    boxPadding: 10,
    boxPaddingTop: 0,
    boxPaddingBottom: 0,
    boxRadius: 8,
    backgroundColor: '#eeeeee',
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
  number: 1,
  slideGap: 12,
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

export default function PcBanner2Preview({ data }: { data: Record<string, any> }): ReactNode {
  const { t } = useI18n();

  const moduleConfig = useMemo(() => deepMerge(pcBanner2Defaults, data), [data]);
  const picList = useMemo(() => (moduleConfig.picList || []) as AnyRecord[], [moduleConfig.picList]);

  const displayNum = useMemo(() => {
    const raw = Number(moduleConfig.number ?? 1);
    if (!Number.isFinite(raw)) return 1;
    return Math.min(3, Math.max(1, raw));
  }, [moduleConfig.number]);

  /** 模块类名（布局变体） */
  const moduleClasses = `dec-pc-banner2--num-${displayNum}`;

  /** CSS 变量（传递动态值到样式） */
  const cssVars = useMemo(() => {
    const frame = (moduleConfig.frame || {}) as AnyRecord;
    return {
      '--dec-box-padding': `${frame.boxPadding ?? 10}px`,
      '--dec-box-padding-top': `${frame.boxPaddingTop ?? 0}px`,
      '--dec-box-padding-bottom': `${frame.boxPaddingBottom ?? 0}px`,
      '--dec-box-radius': `${frame.boxRadius ?? 8}px`,
      '--dec-bg-color': frame.backgroundColor ?? '#eeeeee',
      '--dec-slide-gap': `${moduleConfig.slideGap ?? 12}px`,
    } as CSSProperties;
  }, [moduleConfig.frame, moduleConfig.slideGap]);

  const slideGap = Number(moduleConfig.slideGap ?? 12);
  const perView = displayNum;
  const count = picList.length;
  const pages = Math.max(1, Math.ceil(count / perView));

  // loop：图片足够时在尾部追加首组图片，翻到末页再回到首页可保持视觉连续
  const slides = useMemo(() => {
    if (count <= perView) return picList;
    return [...picList, ...picList.slice(0, perView)];
  }, [picList, perView, count]);

  const [pageIndex, setPageIndex] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    setPageIndex(0);
  }, [count, perView]);

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
    width: `${(slides.length / perView) * 100}%`,
    transform: `translateX(-${(pageIndex * perView * 100) / Math.max(slides.length, 1)}%)`,
  };

  return (
    <div className={`dec-pc-banner2 ${moduleClasses}`} style={cssVars}>
      {!picList.length ? (
        <div className="dec-pc-banner2__empty">
          <div className="dec-pc-banner2__empty-text">{t('点击添加轮播Banner2')}</div>
        </div>
      ) : (
        <div className="dec-pc-banner2__inner">
          <div
            className="dec-pc-banner2__carousel"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <div className="dec-pc-banner2__track" style={trackStyle}>
              {slides.map((item, index) => (
                <div
                  className="dec-pc-banner2__slide"
                  key={`${item?.picId ?? 'slide'}-${index}`}
                  style={{
                    width: `${100 / Math.max(slides.length, 1)}%`,
                    paddingRight: perView > 1 && slideGap > 0 ? `${slideGap}px` : undefined,
                  }}
                >
                  <a
                    className="dec-pc-banner2__link"
                    href={item?.picLink?.link || 'javascript:;'}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img className="dec-pc-banner2__img" src={formatImage(item?.picUrl)} alt="" />
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

            {pages > 1 ? (
              <div className="swiper-pagination">
                {Array.from({ length: pages }, (_, index) => (
                  <span
                    key={index}
                    className={`swiper-pagination-bullet${
                      index === pageIndex ? ' swiper-pagination-bullet-active' : ''
                    }`}
                    onClick={() => setPageIndex(index)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
