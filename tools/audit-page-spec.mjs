#!/usr/bin/env node
/**
 * 按 PageSpec 审计一个迁移页面。
 *
 * 用法：
 *   node tools/audit-page-spec.mjs rust/web/admin-semi/src/pages/specs/members.json
 */
import fs from 'node:fs';
import path from 'node:path';

const specPath = process.argv[2];
if (!specPath) {
  console.error('用法: node tools/audit-page-spec.mjs <spec.json>');
  process.exit(1);
}

const spec = JSON.parse(fs.readFileSync(path.resolve(specPath), 'utf8'));
const componentPath = path.resolve(spec.component);
const source = fs.readFileSync(componentPath, 'utf8');
const inventory = JSON.parse(
  fs.readFileSync(path.resolve('docs/admin-migration-inventory.json'), 'utf8'),
);

const failures = [];
const warnings = [];

const oldPage =
  inventory.pages.find((item) => item.rel === spec.page) ||
  inventory.pages.find((item) => item.rel.endsWith(spec.page));
if (!oldPage && !spec.skipOldPage) failures.push(`找不到旧页面清单: ${spec.page}`);

if (spec.drawer?.width) {
  const width = Number(spec.drawer.width);
  const widthPattern = new RegExp(`width\\s*[:=]\\s*\\{?\\s*${width}\\b`);
  if (!widthPattern.test(source)) {
    failures.push(`Drawer 宽度未配置为 ${width}px`);
  }
}
if (spec.drawer?.labelWidth) {
  if (!source.includes(`labelWidth: '${spec.drawer.labelWidth}'`) && !source.includes(`labelWidth: "${spec.drawer.labelWidth}"`)) {
    failures.push(`labelWidth 未配置为 ${spec.drawer.labelWidth}`);
  }
}

for (const field of spec.filters || []) {
  const fieldName = typeof field === 'string' ? field : field?.name;
  if (!fieldName) continue;
  if (!source.includes(fieldName)) {
    failures.push(`缺少筛选项: ${fieldName}`);
  }
}

const actionLabels = {
  detail: '查看',
  tags: '标签',
  orders: '查看订单',
  account: '账目明细',
  edit: '编辑',
  delete: '删除',
  audit: '去处理',
  logs: '日志',
};
const actionAliases = { '编辑': 'edit', '删除': 'delete' };
for (const rawAction of spec.actions || []) {
  const action = actionAliases[rawAction] || rawAction;
  if (action === 'edit') {
    const hasDrawer = source.includes('drawer=') || source.includes('drawer:') || source.includes('FormDrawer');
    if (!hasDrawer && !source.includes('编辑') && !/\bedit/i.test(source)) failures.push('缺少编辑入口');
    continue;
  }
  if (action === 'delete') {
    if (!source.includes('deleteApi') && !source.includes('/del') && !source.includes('删除')) failures.push('缺少删除入口');
    continue;
  }
  const label = actionLabels[action] || action;
  if (!source.includes(label)) failures.push(`缺少行操作: ${action} (${label})`);
}

const batchLabels = {
  tags: '批量打标签',
  rank: '批量改等级',
  points: '批量加积分',
  balance: '批量加余额',
  delete: '批量删除',
  show: '批量显示',
  hide: '批量隐藏',
  moveCat: '批量转移分类',
};
for (const action of spec.batch || []) {
  const label = batchLabels[action] || action;
  if (!source.includes(label)) failures.push(`缺少批量操作: ${action} (${label})`);
}

for (const column of spec.columns || []) {
  if (!source.includes(column)) warnings.push(`列标题未逐字出现: ${column}`);
}

const filterParams = oldPage?.models
  ? [...new Set(oldPage.models.filter((model) => model.startsWith('filterParams.')))]
  : [];
for (const model of filterParams) {
  const field = model.replace('filterParams.', '').split('.')[0];
  if (!source.includes(field)) warnings.push(`旧筛选字段未在新页面出现: ${field}`);
}

if (spec.table) {
  const pageDir = path.dirname(componentPath);
  const listPageSource = fs.readFileSync(path.join(pageDir, '../framework/ListPage.tsx'), 'utf8');
  const stylesSource = fs.readFileSync(path.join(pageDir, '../styles.css'), 'utf8');

  if (spec.table.fillWidth) {
    if (!listPageSource.includes('ResizeObserver')) failures.push('表格未启用容器宽度自适应');
    if (!stylesSource.includes('max-width: none')) failures.push('页面容器仍有最大宽度限制');
  }
  if (spec.table.headerNowrap && !stylesSource.includes('white-space: nowrap')) {
    failures.push('表头未设置 nowrap');
  }
  if (spec.table.action?.fixed === 'right' && !listPageSource.includes("fixed: 'right'")) {
    failures.push('操作列未固定到右侧');
  }
  const actionWidth = spec.table.action?.width;
  if (
    actionWidth &&
    !source.includes(`actionWidth={${actionWidth}}`) &&
    !source.includes(`width: ${actionWidth}`)
  ) {
    failures.push(`操作列宽度未配置为 ${actionWidth}px`);
  }
  for (const header of spec.table.longHeaders || []) {
    const index = source.indexOf(header.label);
    if (index < 0) {
      failures.push(`长列标题未找到: ${header.label}`);
      continue;
    }
    const segment = source.slice(index, index + 320);
    const match = segment.match(/width:\s*(\d+)/);
    if (!match || Number(match[1]) < header.minWidth) {
      failures.push(`长列表头宽度不足: ${header.label} < ${header.minWidth}px`);
    }
  }
}

if (spec.widgets) {
  for (const [name, widget] of Object.entries(spec.widgets)) {
    if (!widget.mcpChecks || !widget.mcpChecks.length) {
      failures.push(`复杂控件 ${name} 缺少 MCP 文档检查记录`);
    }
    if (!widget.component) {
      failures.push(`复杂控件 ${name} 未声明组件文件`);
      continue;
    }
    const widgetPath = path.resolve(widget.component);
    if (!fs.existsSync(widgetPath)) {
      failures.push(`复杂控件 ${name} 组件不存在: ${widget.component}`);
      continue;
    }
    const widgetSource = fs.readFileSync(widgetPath, 'utf8');
    for (const required of widget.requires || []) {
      if (!widgetSource.includes(required)) {
        failures.push(`复杂控件 ${name} 缺少实现标记: ${required}`);
      }
    }
  }
}

if (spec.mcpChecks && !spec.mcpChecks.length) {
  failures.push('页面 MCP 文档检查记录为空');
}

for (const script of spec.interactionChecks || []) {
  if (!fs.existsSync(path.resolve(script))) {
    failures.push(`交互测试脚本不存在: ${script}`);
  }
}

if (spec.backendReady?.importUser === false) {
  warnings.push('导入客户：后端未迁移，前端未实现（已在 spec 中标记）');
}
if (spec.backendReady?.batch === false) {
  warnings.push('批量操作：后端未迁移（已在 spec 中标记）');
}
if (spec.backendReady?.sort === false) {
  warnings.push('列排序：后端未提供排序能力（已在 spec 中标记）');
}

console.log(`PageSpec: ${specPath}`);
console.log(`组件: ${spec.component}`);
console.log(`筛选项: ${(spec.filters || []).length}`);
console.log(`行操作: ${(spec.actions || []).length}`);
console.log(`批量操作: ${(spec.batch || []).length}`);
console.log('');

if (warnings.length) {
  console.log('WARN:');
  warnings.forEach((item) => console.log(`  - ${item}`));
}
if (failures.length) {
  console.log('FAIL:');
  failures.forEach((item) => console.log(`  - ${item}`));
  process.exit(1);
}
console.log('PASS: PageSpec 校验通过');
