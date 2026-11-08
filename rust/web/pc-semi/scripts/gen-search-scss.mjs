import fs from 'node:fs';
import path from 'node:path';

const LEGACY = 'D:/tigshop/NexTrade/java-b2b2c-overseas-v5.8.61/view/pc';

/**
 * 搜索页（/search）的旧版 scoped 样式搬运。
 * 规则与 gen-core-pages-scss.mjs / gen-member-pages-scss.mjs 完全一致：逐字符搬运，只做
 *   1. 去掉 @import 旧版公共 less；
 *   2. :deep(X) → X；
 *   3. 整个组件包一层 .mp-xxx 代替旧版 scoped 的 data-v 隔离。
 */
const COMPONENTS = [
  ['mp-search', 'pages/search/components/search.vue'],
  ['mp-search-filter', 'pages/search/components/Filter.vue'],
  ['mp-search-sort', 'pages/search/components/SortFilter.vue'],
  ['mp-search-goods', 'pages/search/components/CatGoodsList.vue'],
  ['mp-search-card', 'pages/search/components/SearchProductCard.vue'],
  ['mp-search-shop', 'pages/search/components/SearchShopList.vue'],
  ['mp-search-skeleton', 'pages/search/components/SearchSkeleton.vue'],
  ['mp-search-tag', 'pages/search/components/Tag.vue'],
  // 旧版 SearchShopList.vue 里 .shop-row 是 <ShopInfo> + <ShopList> 两个组件，
  // ShopInfo 有源码（components/product/overseas/ShopInfo.vue），一起搬进来；
  // ShopList 在 view/pc/components 里搜不到源码，只能照渲染出的类名做静态替身。
  ['mp-search-shopinfo', 'components/product/overseas/ShopInfo.vue']
];

function styleBlock(src) {
  const out = [];
  for (const m of src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) out.push(m[1]);
  return out.length ? out.join('\n') : null;
}

function convert(block) {
  let s = block;
  s = s.replace(/@import\s+["'][^"']*["']\s*;?/g, '');
  s = s.replace(/url\((["']?)~\//g, 'url($1/');
  s = s.replace(/url\((["']?)~@\//g, 'url($1/');
  let prev;
  do {
    prev = s;
    s = s.replace(/:deep\(([^()]*)\)/g, '$1');
  } while (s !== prev);
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
out.push(' * 搜索页（/search）样式 —— 由 scripts/gen-search-scss.mjs 生成。');
out.push(' *');
out.push(' * 逐字符搬运旧版 pages/search/components/*.vue 的 <style> 块，不新增、不改写任何声明；只做三件事：');
out.push(' *   1. 去掉旧版 @import 的公共 less（新版全局已有）；');
out.push(' *   2. 把 :deep(X) 展开成 X；');
out.push(' *   3. 每个组件整体包一层 .mp-xxx，代替旧版 scoped 的 data-v 属性隔离。');
out.push(' */');
out.push('');

let total = 0;
const report = [];

for (const [slug, rel] of COMPONENTS) {
  const file = path.join(LEGACY, rel.replace(/\//g, path.sep));
  if (!fs.existsSync(file)) {
    report.push(`MISSING ${rel}`);
    continue;
  }
  const block = styleBlock(fs.readFileSync(file, 'utf8'));
  if (block == null) {
    report.push(`NO-STYLE ${rel}`);
    continue;
  }
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

const target = path.join(process.cwd(), 'app', 'search-page.scss');
fs.writeFileSync(target, out.join('\n'), 'utf8');

console.log(report.join('\n'));
console.log(`\nwrote ${target} (${total} bytes of legacy CSS)`);

const text = fs.readFileSync(target, 'utf8');
const lines = text.split('\n');
console.log(
  `总行数 ${lines.length}，花括号深度 ${lines.reduce(
    (d, l) => d + (l.match(/\{/g) || []).length - (l.match(/\}/g) || []).length,
    0
  )}`
);
