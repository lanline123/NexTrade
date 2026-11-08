import fs from 'node:fs';
import path from 'node:path';

const LEGACY = 'D:/tigshop/NexTrade/java-b2b2c-overseas-v5.8.61/view/pc';

// 每个旧版 .vue 的 <style> 块原样搬运，包一层页面选择器代替旧版的 scoped（data-v）隔离。
const PAGES = [
  ['mp-address-list', 'pages/member/address/List.vue'],
  ['mp-address-edit', 'pages/member/address/EditRegion.vue'],
  ['mp-coupon-list', 'pages/member/coupon/List.vue'],
  ['mp-coupon-card', 'components/member/coupon/CouponCard.vue'],
  ['mp-collect-product', 'pages/member/collectProduct/List.vue'],
  ['mp-collect-shop', 'pages/member/collectShop/List.vue'],
  ['mp-point-list', 'pages/member/point/List.vue'],
  ['mp-account-deposit', 'pages/member/account/Deposit.vue'],
  ['mp-account-detail', 'pages/member/account/Detail.vue'],
  ['mp-account-log', 'pages/member/account/Log.vue'],
  ['mp-account-raplyto', 'pages/member/account/Raplytocard.vue'],
  ['mp-account-card', 'pages/member/account/CardManagement.vue'],
  ['mp-account-infocard', 'pages/member/account/src/InfoCard.vue'],
  ['mp-return-list', 'pages/member/return/List.vue'],
  ['mp-return-info', 'pages/member/return/Info.vue'],
  ['mp-return-log', 'pages/member/return/Log.vue'],
  ['mp-return-loginfo', 'pages/member/return/LogInfo.vue'],
  ['mp-pin-list', 'pages/member/pin/List.vue'],
  ['mp-pin-group', 'pages/member/pin/Group.vue'],
  ['mp-group-list', 'pages/member/group/List.vue'],
  ['mp-group-info', 'pages/member/group/Info.vue'],
  ['mp-comment-list', 'pages/member/comment/List.vue'],
  ['mp-comment-info', 'pages/member/comment/Info.vue'],
  ['mp-comment-card', 'components/member/comment/CommentList.vue'],
  ['mp-orderinvoice-list', 'pages/member/orderInvoice/List.vue'],
  ['mp-orderinvoice-info', 'pages/member/orderInvoice/Info.vue'],
  // 列表页的弹窗不是 Info.vue，而是共享组件 components/invoice/InvoiceDialog.vue
  // （List.vue:141 `import Info from "~/components/invoice/InvoiceDialog.vue"`），
  // 它的 scoped 样式只在这个组件里，必须单独收一份。
  ['mp-invoice-dialog', 'components/invoice/InvoiceDialog.vue'],
  ['mp-userinvoice-info', 'pages/member/userInvoice/Info.vue'],
  ['mp-userinvoice-confirm', 'pages/member/userInvoice/confirmInfo.vue'],
  ['mp-usermessage-list', 'pages/member/userMessage/List.vue'],
  ['mp-security-info', 'pages/member/security/Info.vue'],
  ['mp-security-dialog', 'pages/member/security/dialogInfo.vue'],
  ['mp-browsing-list', 'pages/member/browsingHistory/List.vue'],
  ['mp-claim-info', 'pages/member/order/claimInfo.vue']
];

function styleBlock(src) {
  const m = src.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  return m ? m[1] : null;
}

function convert(block) {
  let s = block;
  // 旧版 @import 的 member.less 已由 app/member-order.scss 全局提供，不要重复
  s = s.replace(/@import\s+["'][^"']*member[^"']*["']\s*;?/g, '');
  // :deep(X) 是 Vue scoped 的穿透写法，编译后就是后代选择器
  let prev;
  do {
    prev = s;
    s = s.replace(/:deep\(([^()]*)\)/g, '$1');
  } while (s !== prev);
  // 去掉首尾空白行
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
out.push(' * 会员中心子页样式 —— 由 scripts/gen-member-pages-scss.mjs 从旧版 .vue 的 <style> 块生成。');
out.push(' *');
out.push(' * 规则：逐字符搬运，不新增、不改写任何声明；只做三件事：');
out.push(' *   1. 去掉 <style scoped> 的 @import "/assets/css/member/member"（已由 member-order.scss 全局提供）；');
out.push(' *   2. 把 :deep(X) 展开成 X（Vue scoped 编译后就是后代选择器）；');
out.push(' *   3. 每个文件整体包一层页面选择器 mp-xxx，代替旧版 scoped 的 data-v 属性隔离。');
out.push(' */');
out.push('');

let total = 0;
const report = [];

for (const [slug, rel] of PAGES) {
  const file = path.join(LEGACY, rel.replace(/\//g, path.sep));
  if (!fs.existsSync(file)) {
    report.push(`MISSING ${rel}`);
    continue;
  }
  const raw = fs.readFileSync(file, 'utf8');
  const block = styleBlock(raw);
  if (block == null) {
    report.push(`NO-STYLE ${rel}`);
    continue;
  }
  const body = convert(block);
  total += body.length;
  out.push(`/* ---------- ${rel} ---------- */`);
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

const target = path.join(process.cwd(), 'app', 'member-pages.scss');
fs.writeFileSync(target, out.join('\n'), 'utf8');

console.log(report.join('\n'));
console.log(`\nwrote ${target} (${total} bytes of legacy CSS)`);

// 报告可疑 token，方便人工确认没有被误改
const text = fs.readFileSync(target, 'utf8');
for (const token of [':deep(', '@import', 'scoped']) {
  console.log(`${text.includes(token) ? 'FOUND  ' : 'clean  '} ${token}`);
}
