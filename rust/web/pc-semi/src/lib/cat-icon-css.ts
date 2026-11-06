/**
 * 分类楼层图标字体注入。
 *
 * 源码对照：旧版 PC 前台 `store/common.ts`（catIcoCss）与 `utils/domUtils.ts`（useLoadCss）。
 * `GET /api/common/pc/getCatFloor` 会返回 `icoDefinedCss`，当前后端给的是字体样式地址
 * （如 https://at.alicdn.com/t/c/font_4761676_xxx.css），旧版首页在 PcHomeHero onMounted 时
 * 用 useLoadCss 把它插成 `<link rel="stylesheet">`；只有字体加载后，楼层 `floorIcoFont`
 * （`iconfont-tig icon-xxx` / `lyecs-defined-iconfont lyecs-defined-icon-xxx`）才会显示字形。
 *
 * 这里同时兼容“样式地址”与“内联 CSS 文本”两种返回形态，并做幂等处理。
 */
const ICON_LINK_ID = 'pc-cat-floor-ico-link';
const ICON_STYLE_ID = 'pc-cat-floor-ico-css';

export function ensureCatIcoCss(icoCss: unknown): void {
  if (typeof document === 'undefined') return;
  const value = typeof icoCss === 'string' ? icoCss.trim() : '';
  if (!value) return;

  if (/^(?:https?:)?\/\//i.test(value)) {
    if (document.getElementById(ICON_LINK_ID)) return;
    const link = document.createElement('link');
    link.id = ICON_LINK_ID;
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = value;
    document.head.appendChild(link);
    return;
  }

  let style = document.getElementById(ICON_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = ICON_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = value;
}