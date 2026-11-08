#!/usr/bin/env node
/**
 * 把旧版会员中心公共样式 view/pc/assets/css/member/member.less 整份搬进 app/member-base.scss。
 *
 * 为什么需要这一步：旧版每个会员页面自己的 <style scoped> 第一行都是
 *   @import "/assets/css/member/member";
 * 所以 .info-row / .title-or-tabs / .tig-tabs / .no-result / .el-page / .tig-steps
 * 这些"会员中心公共件"在旧站是每页都带的。新版是一页一页手写搬运，会漏
 *（跑 scripts/_member-base-report.mjs 能看到漏了哪几条），结果就是页面挂了 class 却没有样式。
 *
 * 注意：要读 **member.less**，不是同目录的 member.css —— 后者是更旧的编译产物，
 * .info-row 还写着 width:1008px / padding:0 16px 16px，而 .less 已经改成
 * flex:1 / min-width:0 / width:auto / padding:0 32px 16px。以 .less 源码为准。
 *
 * 转换规则（逐字符搬运，不改任何声明值）：
 *   1. 展开 less 嵌套（文件里没有 @ 变量、没有 @media、没有 mixin，只有嵌套）；
 *   2. :deep(X) → X（Vue scoped 的穿透写法，编译后就是后代选择器）；
 *   3. 每条顶层选择器前面加 `.pc-member-shell__main `——等价于旧版的 data-v 作用域属性，
 *      作用域只到会员中心内容区，不会污染站内其它页面；
 *   4. 其余一个字符都不动。
 *
 * 输出文件在 member-order.scss / member-pages.scss 之前引入，所以手写补件和页面块
 * 在同优先级时仍然是后者赢，不会回归。
 */
import fs from 'node:fs';
import path from 'node:path';

const LEGACY = 'D:/tigshop/NexTrade/java-b2b2c-overseas-v5.8.61/view/pc/assets/css/member/member.less';
const SCOPE = '.pc-member-shell__main';

let source = fs.readFileSync(LEGACY, 'utf8').replace(/^\uFEFF/, '');
// 注释：/* */ 与 //
source = source.replace(/\/\*[\s\S]*?\*\//g, '');
source = source
  .split('\n')
  .map((line) => line.replace(/(^|\s)\/\/.*$/, '$1'))
  .join('\n');

/* ---------- 1. 解析成 token ---------- */
const tokens = [];
let buffer = '';
for (const ch of source) {
  if (ch === '{') {
    tokens.push({ type: 'open', text: buffer.trim() });
    buffer = '';
  } else if (ch === '}') {
    if (buffer.trim()) tokens.push({ type: 'decl', text: buffer.trim() });
    tokens.push({ type: 'close' });
    buffer = '';
  } else if (ch === ';') {
    if (buffer.trim()) tokens.push({ type: 'decl', text: buffer.trim() });
    buffer = '';
  } else {
    buffer += ch;
  }
}

/* ---------- 2. 展开嵌套 ---------- */
const blocks = []; // { selectors: string[], decls: string[] }
const stack = [];

function combine(parents, own) {
  const ownList = own.split(',').map((part) => part.trim()).filter(Boolean);
  if (!parents.length) return ownList;
  const result = [];
  for (const parent of parents) {
    for (const child of ownList) {
      result.push(child.includes('&') ? child.replace(/&/g, parent) : `${parent} ${child}`);
    }
  }
  return result;
}

for (const token of tokens) {
  if (token.type === 'open') {
    const parents = stack.length ? stack[stack.length - 1].selectors : [];
    const block = { selectors: combine(parents, token.text), decls: [] };
    blocks.push(block);
    stack.push(block);
  } else if (token.type === 'close') {
    stack.pop();
  } else if (token.type === 'decl') {
    if (!stack.length) {
      throw new Error(`声明出现在任何规则之外: ${token.text}`);
    }
    stack[stack.length - 1].decls.push(token.text);
  }
}

/* ---------- 3. 输出 scss ---------- */
const out = [];
let ruleCount = 0;
for (const block of blocks) {
  if (!block.decls.length) continue; // 纯容器规则，展开后没有声明
  const selectors = block.selectors
    .map((selector) => {
      const clean = selector.replace(/:deep\(([^()]*)\)/g, '$1').replace(/\s+/g, ' ').trim();
      return clean.startsWith(SCOPE) ? clean : `${SCOPE} ${clean}`;
    })
    .filter(Boolean);
  if (!selectors.length) continue;
  out.push(`${selectors.join(',\n')} {`);
  for (const decl of block.decls) out.push(`  ${decl.replace(/\s+/g, ' ').trim()};`);
  out.push('}');
  out.push('');
  ruleCount += 1;
}

const header = [
  '/**',
  ' * 会员中心公共样式 —— 由 scripts/gen-member-base-scss.mjs 从旧版',
  ' * view/pc/assets/css/member/member.less 生成，请勿手改（改生成器再跑）。',
  ' *',
  ' * 旧版每个会员页面 <style scoped> 都 @import 这份文件，所以它是每页都有的公共件。',
  ` * 每条选择器加 ${SCOPE} 前缀，代替旧版 scoped 的 data-v 属性；声明值一个都没改。`,
  ' */',
  '',
];

/* ---------- 4. 再补上旧版 global.css 里会员页会用到的工具类 ----------
 * .tig-input / .tig-button / .theme-button 在 global.css（全局样式，不在 member.less 里），
 * 但只有会员页在用：pages/member/pin/List.vue（搜索框 + 搜索按钮）、pages/member/pin/Group.vue
 * （.tig-button.theme-button.big-button 邀请好友参团）。按选择器白名单原样搬运，值不改。
 * 其它页面没有被这几个 class 影响（站内其它地方不用它们，实测 0 处）。
 */
const GLOBAL_CSS = 'D:/tigshop/NexTrade/java-b2b2c-overseas-v5.8.61/view/pc/assets/css/global.css';
const GLOBAL_WHITELIST = ['.tig-input', '.tig-button', '.theme-button'];

function parseFlatCss(text) {
  const rules = [];
  let buffer = '';
  let selectors = null;
  for (const ch of text) {
    if (ch === '{') {
      selectors = buffer.trim();
      buffer = '';
    } else if (ch === '}') {
      if (selectors) rules.push({ selectors, decls: buffer.trim() });
      selectors = null;
      buffer = '';
    } else if (selectors) {
      buffer += ch;
    } else {
      buffer += ch;
    }
  }
  return rules;
}

const globalSource = fs
  .readFileSync(GLOBAL_CSS, 'utf8')
  .replace(/^\uFEFF/, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const extra = [];
for (const rule of parseFlatCss(globalSource)) {
  const parts = rule.selectors.split(',').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) continue;
  if (!parts.every((part) => GLOBAL_WHITELIST.some((prefix) => part.startsWith(prefix)))) continue;
  if (!rule.decls) continue;
  extra.push(`${parts.map((part) => `${SCOPE} ${part}`).join(',\n')} {`);
  extra.push(
    rule.decls
      .split(';')
      .map((decl) => decl.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .map((decl) => `  ${decl};`)
      .join('\n'),
  );
  extra.push('}');
  extra.push('');
}

const target = path.join(process.cwd(), 'app', 'member-base.scss');
const text = header.join('\n') + out.join('\n') + extra.join('\n');
fs.writeFileSync(target, text, 'utf8');

console.log(`read  ${LEGACY}  (${source.split('\n').length} 行源码)`);
console.log(`wrote ${target}  (${text.length} bytes, ${ruleCount} 个规则块 + ${extra.filter((line) => line.endsWith('{')).length} 个 global.css 工具类块)`);
console.log(`${text.includes(':deep(') ? 'FOUND  ' : 'clean  '} :deep(`);
console.log(`${text.includes('@media') || /(^|\n)\s*@/.test(text) ? 'FOUND  ' : 'clean  '} 顶层 at-rule`);
