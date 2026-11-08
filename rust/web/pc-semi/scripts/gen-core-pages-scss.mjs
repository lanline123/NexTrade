import fs from 'node:fs';
import path from 'node:path';

const LEGACY = 'D:/tigshop/NexTrade/java-b2b2c-overseas-v5.8.61/view/pc';

/**
 * 三个核心大页（商品详情 / 结算 / 支付）的旧版 scoped 样式搬运。
 * 规则与 gen-member-pages-scss.mjs 完全一致：逐字符搬运，只做
 *   1. 去掉 @import 旧版公共 less（新版已由 member-base/globals 提供）；
 *   2. :deep(X) → X；
 *   3. 整个文件包一层 .mp-xxx 代替旧版 scoped 的 data-v 隔离。
 */
const PAGES = [
  // ---- 商品详情（旧版 pages/item/[id].vue → pages/item/src/Product.vue 的经典版）----
  ['mp-item', 'pages/item/src/Product.vue'],
  ['mp-product-head', 'pages/item/src/ProductHead.vue'],
  ['mp-product-tabs', 'pages/item/src/ProductDetailTabs.vue'],
  ['mp-product-info', 'components/product/ProductInfo.vue'],
  ['mp-product-thumb', 'components/product/Thumb.vue'],
  ['mp-buy', 'components/product/Buy.vue'],
  ['mp-product-sku', 'components/product/ProductSku.vue'],
  ['mp-product-attr', 'components/product/ProductAttr.vue'],
  ['mp-product-amount', 'components/product/ProductAmount.vue'],
  ['mp-b2b-sku', 'components/product/B2bSku.vue'],
  ['mp-b2b-tab', 'components/product/B2bTab.vue'],
  ['mp-float-buy-bar', 'components/product/FloatBuyBar.vue'],
  ['mp-shop-info', 'components/product/ShopInfo.vue'],
  // ---- 商品详情·国内标准版/跨境简约版的配套组件（老版 container-new / container-overseas 专用）----
  ['mp-product-info-overseas', 'components/product/overseas/ProductInfo.vue'],
  ['mp-product-thumb-overseas', 'components/product/overseas/Thumb.vue'],
  ['mp-shop-info-overseas', 'components/product/overseas/ShopInfo.vue'],
  ['mp-product-thumb-new', 'components/product/ThumbNew.vue'],
  ['mp-product-detail-new', 'components/product/DetailNew.vue'],
  // ---- 支付 ----
  ['mp-pay', 'pages/order/pay.vue'],
  // 认款弹窗会被 Semi Modal 传到 body，脱离 .mp-pay，故同一份样式再挂一个 slug
  ['mp-pay-dialog', 'pages/order/pay.vue'],
  // ---- 结算 ----
  ['mp-check', 'pages/order/check.vue', ['pages/order/css/check.less']],
  ['mp-check-address', 'pages/order/src/Address.vue'],
  ['mp-check-paytype', 'pages/order/src/PayType.vue'],
  ['mp-check-integral', 'pages/order/src/IntegralAndBalance.vue'],
  ['mp-check-invoice', 'pages/order/src/InvoiceInfo.vue'],
  ['mp-check-coupon', 'pages/order/src/CouponInfo.vue']
];

function styleBlock(src) {
  // check.vue 有两个 <style>（一个全局、一个 scoped），都要
  const out = [];
  for (const m of src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) out.push(m[1]);
  return out.length ? out.join('\n') : null;
}

function convert(block) {
  let s = block;
  // 旧版公共 less 已由新版全局样式提供，不要重复
  s = s.replace(/@import\s+["'][^"']*["']\s*;?/g, '');
  // 旧版 Nuxt 的 `~/assets/xxx` 是 alias 写法；Next 会把 `~/` 当 npm 包去解析，直接编译失败。
  // 旧站资源根就是 /assets/，所以去掉了 `~/`（或 `~@/`）后地址不变。
  s = s.replace(/url\((["']?)~\//g, 'url($1/');
  s = s.replace(/url\((["']?)~@\//g, 'url($1/');
  // Vue scoped 的穿透写法，编译后就是后代选择器
  let prev;
  do {
    prev = s;
    s = s.replace(/:deep\(([^()]*)\)/g, '$1');
  } while (s !== prev);
  // LESS 无参 mixin → SCSS mixin（语义一致：调用处内联声明体，含嵌套规则）。
  // 定义 `.xxx() {` → `@mixin xxx {`；调用 `.xxx();` → `@include xxx;`。
  // 正常 CSS 选择器不会出现 `.xxx()` 形态，此改写对无 mixin 的文件无副作用。
  s = s.replace(/^(\s*)\.([a-zA-Z][\w-]*)\(\)\s*\{/gm, '$1@mixin $2 {');
  s = s.replace(/^(\s*)\.([a-zA-Z][\w-]*)\(\);\s*$/gm, '$1@include $2;');
  s = s
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/^\s*\n/, '')
    .replace(/\s+$/, '');
  return s;
}

const out = [];
out.push('/**');
out.push(' * 三个核心大页（商品详情 / 结算 / 支付）样式 —— 由 scripts/gen-core-pages-scss.mjs 生成。');
out.push(' *');
out.push(' * 逐字符搬运旧版 .vue 的 <style> 块，不新增、不改写任何声明；只做三件事：');
out.push(' *   1. 去掉旧版 @import 的公共 less（新版全局已有）；');
out.push(' *   2. 把 :deep(X) 展开成 X；');
out.push(' *   3. 每个组件整体包一层 .mp-xxx，代替旧版 scoped 的 data-v 属性隔离。');
out.push(' */');
out.push('');

let total = 0;
const report = [];

for (const [slug, rel, extras = []] of PAGES) {
  const file = path.join(LEGACY, rel.replace(/\//g, path.sep));
  if (!fs.existsSync(file)) {
    report.push(`MISSING ${rel}`);
    continue;
  }
  let block = styleBlock(fs.readFileSync(file, 'utf8'));
  // 旧版把页面级 less 用 @import 引进 .vue 的 <style>，成对搬运时不能丢（例：pages/order/css/check.less）
  const extraBlocks = [];
  for (const ex of extras) {
    const exFile = path.join(LEGACY, ex.replace(/\//g, path.sep));
    if (!fs.existsSync(exFile)) {
      report.push(`MISSING-EXTRA ${ex}`);
      continue;
    }
    extraBlocks.push(fs.readFileSync(exFile, 'utf8'));
  }
  if (block == null && !extraBlocks.length) {
    report.push(`NO-STYLE ${rel}`);
    continue;
  }
  block = [block || '', ...extraBlocks].join('\n');
  const body = convert(block);
  total += body.length;
  out.push(`/* ---------- ${slug}  <-  ${rel} ---------- */`);
  out.push(`.${slug} {`);
  out.push(
    body
      .split('\n')
      .map((l) => (l.length ? '  ' + l : ''))
      .join('\n')
  );
  out.push('}');
  out.push('');
  report.push(`OK ${slug}  ${body.length} bytes  <- ${rel}`);
}

const target = path.join(process.cwd(), 'app', 'core-pages.scss');
fs.writeFileSync(target, out.join('\n'), 'utf8');

console.log(report.join('\n'));
console.log(`\nwrote ${target} (${total} bytes of legacy CSS)`);

const text = fs.readFileSync(target, 'utf8');
const lines = text.split('\n');
console.log(`总行数 ${lines.length}，花括号深度 ${lines.reduce((d, l) => d + (l.match(/\{/g) || []).length - (l.match(/\}/g) || []).length, 0)}`);
