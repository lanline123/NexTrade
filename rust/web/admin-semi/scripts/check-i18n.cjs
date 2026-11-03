#!/usr/bin/env node
/**
 * i18n 资源自检：
 * - 每个语言目录必须有 translation.json
 * - JSON 可解析
 * - 输出相对 zh-CN 的 key 覆盖率
 * 新增语言后把对应目录加入 REQUIRED_LOCALES。
 */
const fs = require('fs');
const path = require('path');

const root = path.join(process.cwd(), 'src', 'i18n', 'resources');
const REQUIRED_LOCALES = ['zh-CN', 'en'];

let failed = false;
const resources = {};

for (const code of REQUIRED_LOCALES) {
  const file = path.join(root, code, 'translation.json');
  if (!fs.existsSync(file)) {
    console.error(`[i18n] missing resource: ${code}/translation.json`);
    failed = true;
    continue;
  }
  try {
    resources[code] = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    console.error(`[i18n] invalid JSON: ${code}/translation.json: ${error.message}`);
    failed = true;
  }
}

const baseKeys = Object.keys(resources['zh-CN'] || {});
for (const code of Object.keys(resources)) {
  if (code === 'zh-CN') continue;
  const keys = new Set(Object.keys(resources[code]));
  const covered = baseKeys.filter((key) => keys.has(key)).length;
  const percent = baseKeys.length ? ((covered / baseKeys.length) * 100).toFixed(1) : '0.0';
  console.log(`[i18n] ${code}: ${covered}/${baseKeys.length} keys (${percent}%)`);
}

if (failed) process.exit(1);
console.log('[i18n] resources OK');
