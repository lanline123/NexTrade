/**
 * 后台「主题风格」配置 → :root CSS 变量
 *
 * 数据来源：`GET /api/common/config/themeSettings`
 *   → `{ themeStyle: "{\"--general\":\"#65c4aa\",\"--primary-light-9\":\"#f0f9f7\",...}" }`
 *   `themeStyle` 是后台「装修/设置 → 主题风格」保存的一整串 CSS 变量（字符串化 JSON），
 *   与旧版 `view/pc/store/common.ts#loadThemeSettings` 消费的是同一份数据。
 *
 * 旧版把变量塞进 `themeStore.themeColor` 再由全局样式消费；新版直接在 RootLayout
 * 服务端渲染 `<style>:root{...}</style>`，首屏即生效，无闪烁、无额外请求。
 *
 * 除原样下发后台变量外，额外派生两组：
 *   1. `--general-rgb`：供 `rgba(var(--general-rgb), .1)` 这类半透明叠加使用
 *      （CSS 变量不能直接拆 RGB 分量）；
 *   2. `--semi-color-primary*`：Semi Design 组件（Checkbox / Switch / Pagination…）
 *      自己的主色变量，不派生的话后台换色后这些组件仍是 Semi 默认蓝。
 */

export interface ThemeVars {
  [key: string]: string;
}

/** `#abc` / `#aabbcc` */
const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
/** 后台值里出现这些字符说明不是普通色值/长度，直接丢弃，避免 CSS 注入 */
const UNSAFE_RE = /[;{}<>\\]/;

/**
 * 解析 `themeStyle` 字符串为 CSS 变量表。
 * - 只保留 `--` 开头的键（后台会混入 `themeId` 这类非 CSS 字段）
 * - 丢弃空值（例如 `--main-btn-hover-bg` 线上就是空串）
 * - 丢弃含 `; { } < > \` 的值（防注入）
 */
export function parseThemeStyle(raw: unknown): ThemeVars {
  if (typeof raw !== 'string' || !raw.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object') return {};
  const vars: ThemeVars = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!key.startsWith('--')) continue;
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    const text = String(value).trim();
    if (!text || UNSAFE_RE.test(text)) continue;
    vars[key] = text;
  }
  return vars;
}

/** `#65c4aa` → `[101, 196, 170]`；非法值返回 null */
export function hexToRgb(hex: string): [number, number, number] | null {
  const matched = HEX_RE.exec((hex || '').trim());
  if (!matched) return null;
  let body = matched[1];
  if (body.length === 3) {
    body = body
      .split('')
      .map((char) => char + char)
      .join('');
  }
  const num = Number.parseInt(body, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

type RGB = [number, number, number];

/** 与纯黑混合（ratio 越大越暗），用于派生 hover / active */
function darken([r, g, b]: RGB, ratio: number): RGB {
  const k = 1 - ratio;
  return [Math.round(r * k), Math.round(g * k), Math.round(b * k)];
}

/**
 * Semi Design 组件主色别名。
 *
 * semi.css 把 `--semi-color-primary` 声明在 `body, body .semi-always-light` 上，
 * 而自定义属性一旦在元素自身声明就会压过「从 html 继承来的值」，所以只在 `:root`
 * 覆写对 Semi 组件（勾选框 / 开关 / 分页等）无效。这里用 `:root body` 提升权重，
 * 并覆盖 `.semi-always-light` 变体（`:root body.semi-always-light` 权重更高）。
 */
function semiAliasBlock([r, g, b]: RGB): string {
  const alpha = (ratio: number) => `rgba(${r}, ${g}, ${b}, ${ratio})`;
  const rgb = (triple: RGB) => `rgb(${triple.join(', ')})`;
  const declarations = [
    `--semi-color-primary:${rgb([r, g, b])};`,
    `--semi-color-primary-hover:${rgb(darken([r, g, b], 0.1))};`,
    `--semi-color-primary-active:${rgb(darken([r, g, b], 0.2))};`,
    `--semi-color-primary-disabled:${alpha(0.35)};`,
    `--semi-color-primary-light-default:${alpha(0.12)};`,
    `--semi-color-primary-light-hover:${alpha(0.18)};`,
    `--semi-color-primary-light-active:${alpha(0.24)};`,
  ].join('');
  return `:root,:root body,:root body.semi-always-light{${declarations}}`;
}

/**
 * 生成注入用的 CSS 文本；无有效变量时返回空串（调用方据此跳过注入，
 * 页面回落到 globals.scss 里的 `--pc-primary` 兜底值）。
 */
export function themeVarsToCss(vars: ThemeVars): string {
  const entries = Object.entries(vars);
  if (!entries.length) return '';
  const declarations = entries.map(([key, value]) => `${key}:${value};`);
  const rgb = vars['--general'] ? hexToRgb(vars['--general']) : null;
  if (rgb) declarations.push(`--general-rgb:${rgb.join(',')};`);
  const blocks = [`:root{${declarations.join('')}}`];
  if (rgb) blocks.push(semiAliasBlock(rgb));
  return blocks.join('');
}
