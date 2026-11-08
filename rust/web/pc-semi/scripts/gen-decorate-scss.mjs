#!/usr/bin/env node
/**
 * 装修样式生成器：把旧版 view/pc/decorate/components/pc/Pc*.vue（含 shop/TotalContainer、
 * shop/Title）的 <style> 块原样搬进 app/decorate-source.scss。
 *
 * 只做四件事，其余字节不动：
 *   1. 删掉 @import（旧版靠全局 less 变量，我们已在别处提供）
 *   2. :deep(X) / ::v-deep(X) / /deep/ → 展开成 X
 *   3. url("~/…") → url(/…)
 *   4. 每个组件块前写一行注释标明来源文件
 *
 * 用法：node scripts/gen-decorate-scss.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const LEGACY = 'D:/tigshop/NexTrade/java-b2b2c-overseas-v5.8.61/view/pc/decorate/components';
const LEGACY_HOME = 'D:/tigshop/NexTrade/java-b2b2c-overseas-v5.8.61/view/pc/components/home';
const OUT = 'app/decorate-source.scss';

/** 顺序按旧版装饰器注册顺序排，方便对照 */
const FILES = [
  'pc/PcHomeHero.vue',
  'pc/PcImageAd.vue',
  'pc/PcImageNav.vue',
  'pc/PcImageSquareAd.vue',
  'pc/PcImageHotarea.vue',
  'pc/PcTitleAd.vue',
  'pc/PcNotice.vue',
  'pc/PcDivider.vue',
  'pc/PcSpacer.vue',
  'pc/PcBanner2.vue',
  'pc/PcCategoryNav3.vue',
  'pc/PcCategoryNavWrapper.vue',
  'pc/PcGroupBanner.vue',
  'pc/PcCoupon.vue',
  'pc/PcSeckill.vue',
  'pc/PcSeckillLegacy.vue',
  'pc/PcGroupon.vue',
  'pc/PcGrouponLegacy.vue',
  'pc/PcProduct.vue',
  'pc/PcProductGroup.vue',
  'pc/PcProductGroup.less',
  'pc/pcImageSquareAd/components/imageBox.vue',
  'pc/PcQuickNav.vue',
  'pc/PcRecommendProduct.vue',
  'shop/Title.vue',
  'shop/ShopTitle.vue',
  'shop/TotalContainer.vue',
  'shop/Carousel.vue',
];

/**
 * 旧版 C 端首页老链模块（pages/index.vue 里 camelCase 那批）用到的 components/home/*.vue。
 * 这些 <style> 都是 scoped 的，直接原样搬会变成全站选择器，所以整块嵌进 .pc-home { } 里，
 * 等价于旧版的 data-v 作用域（首页 <main class="pc-home">）。
 */
const HOME_FILES = [
  'Banner.vue',
  'CustomAd1.vue',
  'CustomAd2.vue',
  'CatProductWide.vue',
  'CatProductNormal.vue',
  'CatProductSimple.vue',
  'RecommendProduct.vue',
  'ImageAd.vue',
];

/**
 * 有些老链模块的 <style> 是「.根类名 { … }」一整棵树，摊成 `.pc-home { }` 会把 `.item`、`.pic`、
 * `.info`、`.name`、`.desc`、`.left`、`.right` 这些通用名放到 `.pc-home` 下，污染首页其它卡片；
 * 旧版是 scoped，等价于 `.根类名 .item[data-v]`。
 *
 * 所以这里按文件登记根类名：生成时把最外层那条选择器**剥掉**当作用域父级用 ——
 *   `.pc-home .simple-goodsbox { <原来的第一层声明> }`
 *   子规则变 `.pc-home .simple-goodsbox .head-title`、`.pc-home .simple-goodsbox .goods-wrap .item`
 * 与 scoped 的隔离效果一致，声明值仍然一字不改。
 */
const HOME_FILE_SCOPES = {
  'CatProductSimple.vue': 'simple-goodsbox',
};

/**
 * 另一些文件（RecommendProduct.vue）的 <style> 是**多条并列的顶层规则**（`.com-pc-title{}`、
 * `.you_like_list{}`、`.operate_area{}` …），既没有统一的外层根，也不能整块摊进 `.pc-home`
 * （`.com-pc-title`、`.loading-con`、`.cycleBuyTag` 这些名字首页其它模块也在用）。
 *
 * 这里登记「模块根类名」，生成时**逐条顶层规则加前缀**：
 *   已以 `.根类名` 开头的选择器 → `.pc-home <原选择器>`（不再叠一层，避免变成
 *     `.mod_you_like .mod_you_like .you_like_list` 这种永不命中的选择器）；
 *   其余 → `.pc-home .根类名 <原选择器>`。
 * 选择器里的 `&`（如 `&::after`、`& > a`）仍指本条规则自己的选择器，声明值一字不改。
 */
const HOME_FILE_PREFIX = {
  'RecommendProduct.vue': 'mod_you_like',
};

/** 把一段 SCSS 的顶层规则逐条加前缀；@ 规则（@media 等）原样保留。 */
function prefixTopLevelRules(css, homeScope, rootClass) {
  const parent = `${homeScope} .${rootClass}`;
  const out = [];
  let i = 0;
  const n = css.length;
  while (i < n) {
    while (i < n && /\s/.test(css[i])) i += 1;
    if (i >= n) break;
    if (css.startsWith('/*', i)) {
      const end = css.indexOf('*/', i + 2);
      out.push(css.slice(i, end + 2));
      i = end + 2;
      continue;
    }
    // 读选择器，直到顶层的 '{'（括号内的逗号/花括号不算）
    let j = i;
    let paren = 0;
    while (j < n && !(css[j] === '{' && paren === 0)) {
      if (css[j] === '(') paren += 1;
      else if (css[j] === ')') paren -= 1;
      j += 1;
    }
    if (j >= n) throw new Error('顶层规则没找到左花括号，SCSS 结构异常');
    const selector = css.slice(i, j).trim();
    // 找配对的右花括号（跳过引号内容）
    let k = j + 1;
    let depth = 1;
    let quote = null;
    while (k < n && depth > 0) {
      const ch = css[k];
      if (quote) {
        if (ch === quote && css[k - 1] !== '\\') quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '{') {
        depth += 1;
      } else if (ch === '}') {
        depth -= 1;
      }
      k += 1;
    }
    const body = css.slice(j + 1, k - 1);
    if (selector.startsWith('@')) {
      out.push(`${selector} {${body}}`);
    } else {
      const prefixed = selector
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => (part.startsWith(`.${rootClass}`) ? `${homeScope} ${part}` : `${parent} ${part}`));
      out.push(`${prefixed.join(',\n')} {${body}}`);
    }
    i = k;
  }
  return out.join('\n');
}

/**
 * 老链首页模块的子孙组件。旧版靠 Nuxt 的目录前缀自动注册，模板里写的是
 * <SwiperSpecialSwiper>，按组件名 grep 旧仓库搜不到，所以要按目录找：
 *   components/swiper/SpecialSwiper.vue —— CatProductWide.vue:17
 * 它的 <style> 是 scoped、无 @media，整块嵌进 `.pc-home .floor-wide__box { }` 等价于旧版
 * data-v 作用域；用 .floor-wide__box 而不是 .pc-home 当作用域，避免 .price 泄漏到首页商品卡。
 *
 * components/format/Price.vue **不再搬**：`.price` 的 scoped 样式已经人工复核后落在
 * app/pc-global-utils.scss:127-155，见 docs/pc-parity-notes.md 的「裁决记录（2026-11，人工复核）」
 * ——那份 .price 必须保持全局作用域，不许包进 .pc-home。第 26 轮曾在这里重复搬了一份
 * `.pc-home .floor-wide__box .price`，与裁决冲突且与全局那份逐字相同，第 27 轮移除。
 */
const LEGACY_COMPONENTS = 'D:/tigshop/NexTrade/java-b2b2c-overseas-v5.8.61/view/pc/components';
const HOME_CHILD_FILES = [
  'swiper/SpecialSwiper.vue',
];

function styleBlocksOf(source) {
  const out = [];
  const re = /<style([^>]*)>([\s\S]*?)<\/style>/g;
  let m;
  while ((m = re.exec(source))) out.push({ attrs: m[1] || '', body: m[2] });
  return out;
}

function transform(body) {
  let css = body;
  // 1. @import 整行删除
  css = css.replace(/^\s*@import[^\n]*\n/gm, '');
  // 2. deep 展开（可嵌套多层，循环到没有为止）
  let guard = 0;
  while (/:(?:deep|v-deep)\s*\(/.test(css) && guard < 50) {
    css = css.replace(/::?v?-?deep\s*\(([^()]*)\)/g, '$1');
    guard += 1;
  }
  css = css.replace(/::?v-deep\s+([\w-]+)/g, '$1');
  css = css.replace(/\/deep\/\s*/g, '');
  // 3. 资源路径
  css = css.replace(/url\(\s*(["'])?~?\//g, 'url($1/');
  css = css.replace(/url\(\s*(["'])?~\//g, 'url($1/');
  // 4. 空行收一收
  css = css.replace(/\n{3,}/g, '\n\n').replace(/^\s+|\s+$/g, '');
  return css;
}

const parts = [];
parts.push('/*');
parts.push(' * 装修模块样式 —— 旧版源码逐字搬运（自动生成，请勿手改；改 scripts/gen-decorate-scss.mjs 再跑）');
parts.push(' * 来源：java-b2b2c-overseas-v5.8.61/view/pc/decorate/components/{pc,shop}/*.vue 的 <style> 块');
parts.push(' * 只替换 @import、:deep()、url("~/")，声明值与选择器一字不动。');
parts.push(' */');
parts.push('');

let ok = 0;
const skipped = [];
for (const rel of FILES) {
  const full = path.join(LEGACY, rel);
  if (!fs.existsSync(full)) {
    skipped.push(`${rel}（文件不存在）`);
    continue;
  }
  const source = fs.readFileSync(full, 'utf8');
  // 整份 less/scss 文件（不是 .vue）直接当一个 style 块用
  const blocks = rel.endsWith('.less') || rel.endsWith('.scss')
    ? [{ attrs: '', body: source }]
    : styleBlocksOf(source);
  if (!blocks.length) {
    skipped.push(`${rel}（无 <style>）`);
    continue;
  }
  blocks.forEach((block, i) => {
    const css = transform(block.body);
    if (!css.trim()) return;
    const scoped = /scoped/.test(block.attrs) ? ' scoped' : '';
    parts.push(`/* ==== ${rel}${blocks.length > 1 ? ` [style ${i + 1}/${blocks.length}]` : ''}${scoped} ==== */`);
    parts.push(css);
    parts.push('');
    ok += 1;
  });
}

// ---- 老链 C 端首页模块：整块嵌进 .pc-home {} ----
let okHome = 0;
for (const rel of HOME_FILES) {
  const full = path.join(LEGACY_HOME, rel);
  if (!fs.existsSync(full)) {
    skipped.push(`home/${rel}（文件不存在）`);
    continue;
  }
  const blocks = styleBlocksOf(fs.readFileSync(full, 'utf8'));
  if (!blocks.length) {
    skipped.push(`home/${rel}（无 <style>）`);
    continue;
  }
  blocks.forEach((block, i) => {
    const css = transform(block.body);
    if (!css.trim()) return;
    const scoped = /scoped/.test(block.attrs) ? ' scoped' : '';
    parts.push(`/* ==== home/${rel}${blocks.length > 1 ? ` [style ${i + 1}/${blocks.length}]` : ''}${scoped} ==== */`);
    const scope = HOME_FILE_SCOPES[rel];
    const prefix = HOME_FILE_PREFIX[rel];
    if (prefix) {
      parts.push(prefixTopLevelRules(css, '.pc-home', prefix));
    } else if (scope) {
      // 剥掉最外层 `.根类名 { … }`，把它当作用域父级（见 HOME_FILE_SCOPES 注释）
      const text = css.trim();
      if (!text.startsWith(`.${scope}`)) {
        throw new Error(`home/${rel} 的 style 不以 .${scope} 开头，HOME_FILE_SCOPES 需要复核`);
      }
      const openIndex = text.indexOf('{');
      const body = text.slice(openIndex + 1).replace(/\}\s*$/, '');
      parts.push(`.pc-home .${scope} {`);
      parts.push(body.trim());
      parts.push('}');
    } else {
      parts.push('.pc-home {');
      parts.push(css);
      parts.push('}');
    }
    parts.push('');
    okHome += 1;
  });
}

// ---- 首页老链模块的子孙组件：同样整块嵌进 .pc-home .floor-wide__box {} ----
let okChild = 0;
for (const rel of HOME_CHILD_FILES) {
  const full = path.join(LEGACY_COMPONENTS, rel);
  if (!fs.existsSync(full)) {
    skipped.push(`components/${rel}（文件不存在）`);
    continue;
  }
  const blocks = styleBlocksOf(fs.readFileSync(full, 'utf8'));
  if (!blocks.length) {
    skipped.push(`components/${rel}（无 <style>）`);
    continue;
  }
  blocks.forEach((block, i) => {
    const css = transform(block.body);
    if (!css.trim()) return;
    const scoped = /scoped/.test(block.attrs) ? ' scoped' : '';
    parts.push(`/* ==== components/${rel}${blocks.length > 1 ? ` [style ${i + 1}/${blocks.length}]` : ''}${scoped} ==== */`);
    parts.push('.pc-home .floor-wide__box {');
    parts.push(css);
    parts.push('}');
    parts.push('');
    okChild += 1;
  });
}

fs.writeFileSync(OUT, parts.join('\n'), 'utf8');
const bytes = fs.statSync(OUT).size;
console.log(`${OUT}: ${ok} + ${okHome}（首页老链）+ ${okChild}（首页子孙组件）个 style 块，${parts.length} 行，${bytes} 字节`);if (skipped.length) console.log('跳过：' + skipped.join('；'));
