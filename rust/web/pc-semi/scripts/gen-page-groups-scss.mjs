#!/usr/bin/env node
/**
 * 第 30 轮：全站对齐冲刺——按页群把旧版 .vue 的 <style> 块原样搬进独立 SCSS。
 *
 * 规则（与 gen-member-pages-scss.mjs 同一套，不另起炉灶）：
 *  - 只做三步改写：删掉 @import（全局样式已在别处挂载）、:deep(X) → X、整块包一层 `.pg-<slug>` 代替 Vue scoped；
 *  - 声明值、选择器、缩进一律不改；
 *  - 生成的 SCSS 不许手改，要改就改这里的 FILES 表再重跑。
 *
 * 用法： node scripts/gen-page-groups-scss.mjs [group ...]
 */
import fs from 'node:fs';

const LEGACY = 'D:/tigshop/NexTrade/java-b2b2c-overseas-v5.8.61/view/pc/';

/** group → 输出文件 */
const OUT = {
  'shop-page': 'app/shop-page.scss',
  'join-page': 'app/join-page.scss',
  'exchange-page': 'app/exchange-page.scss',
  'chat-page': 'app/chat-page.scss',
  'auth-page': 'app/auth-page.scss',
  'catalog-page': 'app/catalog-page.scss',
};

/** [slug, 旧版相对 view/pc 的路径] —— 顺序即输出顺序 */
const FILES = {
  'shop-page': [
    ['shop-list-page', 'pages/shop/List.vue'],
    ['shop-license', 'pages/shop/license.vue'],
    ['shop-info', 'pages/shop/src/ShopInfo.vue'],
    ['shop-product-list', 'pages/shop/src/ShopList.vue'],
    ['shop-header', 'pages/shop/src/ShopHeader.vue'],
    ['shop-default-page', 'pages/shop/src/ShopDefaultPage.vue'],
    ['shop-category-menu', 'pages/shop/src/ShopCategoryMenu.vue'],
    ['shop-goods-list', 'pages/shop/src/CatGoodsList.vue'],
    ['shop-search-input', 'pages/shop/src/ShopSearchInput.vue'],
    ['shop-ref-header', 'pages/shop/src/ShopRefHeader.vue'],
    ['shop-search-classic', 'pages/shop/search/src/ShopSearchLayoutClassic.vue'],
    ['shop-category', 'pages/shopCategory/src/ShopCategory.vue'],
    ['shop-filter', 'pages/shopCategory/src/ShopFilter.vue'],
    ['shop-left-menu', 'components/shopCategory/LeftMenu.vue'],
    ['shop-cat-goods-list', 'components/common/CatGoodsList.vue'],
  ],
  'join-page': [
    ['join-index', 'pages/join/index.vue'],
    ['join-intro', 'pages/join/intro.vue'],
    ['join-header', 'pages/join/joinHeader.vue'],
    ['join-plan', 'pages/join/plan.vue'],
    ['join-process', 'pages/join/process.vue'],
    ['join-standard', 'pages/join/standard.vue'],
    ['join-agreement', 'pages/join/src/agreementWin.vue'],
    ['join-intro-table', 'pages/join/src/introTable.vue'],
    ['join-step', 'pages/join/src/step.vue'],
    ['joining-list', 'pages/joining/List.vue'],
    ['joining-group-by-invited', 'pages/joining/groupByInvited.vue'],
    ['joining-product', 'pages/joining/src/ProductJoining.vue'],
    ['joining-to-list', 'pages/joining/src/ToJoiningList.vue'],
    ['joining-goods-list', 'components/common/JoiningGoodsList.vue'],
  ],
  'exchange-page': [
    ['exchange-list', 'pages/exchange/List.vue'],
    ['giftcard-card', 'pages/giftcard/src/giftCard.vue'],
    ['giftcard-actions', 'pages/giftcard/src/giftCardActions.vue'],
    ['giftcard-product-item', 'pages/giftcard/src/productItem.vue'],
    ['giftcard-transfer', 'pages/giftcard/transfer/[id].vue'],
  ],
  'chat-page': [
    ['chat-index', 'pages/chat/index.vue'],
    ['chat-input', 'pages/chat/src/ChatInput.vue'],
    ['chat-list', 'pages/chat/src/ChatList.vue'],
    ['chat-message-list', 'pages/chat/src/ChatMessageList.vue'],
    ['chat-right', 'pages/chat/src/ChatRight.vue'],
    ['chat-emoji', 'pages/chat/src/Emoji.vue'],
  ],
  'auth-page': [
    // 登录卡片 DOM 由 components/member/login/BaseLogin.vue 渲染（loginMode=1 经典版），
    // 卡片内部样式全部来自 BaseLogin 的 <style>；pages/member/Login.vue 只贡献页面壳
    // .login-warp 一层（其嵌套规则在 Vue scoped 下够不到 BaseLogin 内部，属死代码，不搬）。
    ['auth-login', 'components/member/login/BaseLogin.vue'],
    ['auth-register', 'pages/member/register.vue'],
    ['auth-reset', 'pages/member/reset/index.vue'],
    ['auth-reset-step-one', 'pages/member/reset/src/StepOne.vue'],
    ['auth-reset-step-two', 'pages/member/reset/src/StepTow.vue'],
  ],
  'catalog-page': [
    ['catalog-search-shop-list', 'pages/search/components/SearchShopList.vue'],
    ['catalog-search-skeleton', 'pages/search/components/SearchSkeleton.vue'],
    ['catalog-search-tag', 'pages/search/components/Tag.vue'],
    ['catalog-search-side', 'pages/search/components/SearchLayoutSide.vue'],
  ],
};

function styleBlocks(src) {
  return [...src.matchAll(/<style([^>]*)>([\s\S]*?)<\/style>/g)].map((m) => [m[1].trim(), m[2]]);
}

/** 删掉 @import（全局样式已在 layout 里挂），并把 :deep(X) 展开成 X。 */
function clean(body) {
  const imports = [];
  let out = body.replace(/@import\s+[^;]+;/g, (m) => {
    imports.push(m.trim());
    return '';
  });
  out = out.replace(/:deep\(\s*([^)]*)\)/g, '$1');
  out = out.replace(/::v-deep\s+([.#\w-]+)/g, '$1');
  out = out.replace(/^\s*\/\/.*$/gm, '');
  return { body: out, imports };
}

function indent(text, pad = '    ') {
  return text
    .split('\n')
    .map((l) => (l.trim() ? pad + l : l))
    .join('\n');
}

const wanted = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const groups = wanted.length ? wanted : Object.keys(FILES);

let problems = 0;
for (const group of groups) {
  const files = FILES[group];
  if (!files) {
    console.log(`! unknown group: ${group}`);
    problems += 1;
    continue;
  }
  const chunks = [`/* 第 30 轮：${group} —— 旧版 .vue <style> 原样搬运（生成文件，勿手改；改 scripts/gen-page-groups-scss.mjs） */`];
  const allImports = new Map();

  for (const [slug, rel] of files) {
    let src;
    try {
      src = fs.readFileSync(LEGACY + rel, 'utf8');
    } catch (err) {
      console.log(`  ! ${rel}  ${err.code}`);
      problems += 1;
      continue;
    }
    const blocks = styleBlocks(src);
    const bodies = [];
    for (const [, body] of blocks) {
      const { body: cleaned, imports } = clean(body);
      for (const imp of imports) allImports.set(imp, rel);
      if (cleaned.trim()) bodies.push(cleaned.trimEnd());
    }
    if (!bodies.length) {
      console.log(`  - ${slug.padEnd(26)} (无 <style>，跳过)`);
      continue;
    }
    const joined = bodies.join('\n\n');
    chunks.push(
      `/* ${slug} — 源码对照 ${rel} */\n.pg-${slug} {\n${indent(joined)}\n}\n`,
    );
    console.log(`  + ${slug.padEnd(26)} ${String(joined.length).padStart(6)} B  ← ${rel}`);
  }

  const text = `${chunks.join('\n')}\n`;
  fs.writeFileSync(OUT[group], text);
  console.log(`${group} → ${OUT[group]}  ${text.length} B / ${text.split('\n').length} L`);
  if (allImports.size) {
    console.log('  被删掉的 @import：');
    for (const [imp, rel] of allImports) console.log(`    ${imp}   (${rel})`);
  }
  console.log('');
}

process.exit(problems ? 1 : 0);
