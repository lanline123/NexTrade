#!/usr/bin/env node
/**
 * 后台接口契约审计
 *
 * 作用：扫描 admin-semi 前端使用的接口路径，与 Rust 后端实际注册的路由比对，
 *       提前发现「请求失败」类问题（前端写了后端不存在的端点）。
 *
 * 用法：
 *   node scripts/audit-admin-api.mjs          # 审计，缺失则退出码 1
 *   node scripts/audit-admin-api.mjs --json   # 输出 JSON
 *
 * 扫描范围：
 *   前端  src/**\/*.{ts,tsx}  中的
 *         api="..."、api: '...'、listApi/createApi/updateApi/deleteApi/detailApi: '...'
 *         apiGet('...')、apiPost('...')、apiGet<...>('...')
 *   后端  ../../crates/api/admin/src/**\/*.rs 中的 .route("...")
 *         （自动去掉 /adminapi 前缀，查询串会被忽略）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ADMIN_ROOT, 'src');
const BACKEND_DIR = path.resolve(ADMIN_ROOT, '../../crates/api/admin/src');
/** 端点除 `.route("...")` 外，也可能写在 core 的规格表里（endpoints() 数组） */
const BACKEND_EXTRA_DIRS = [path.resolve(ADMIN_ROOT, '../../crates/core/src/models')];

const FRONTEND_PATTERNS = [
  /\bapi="\/([^"]+)"/g,
  /\bapi:\s*'\/([^']+)'/g,
  /\blistApi:\s*'\/([^']+)'/g,
  /\bcreateApi:\s*'\/([^']+)'/g,
  /\bupdateApi:\s*'\/([^']+)'/g,
  /\bdeleteApi:\s*'\/([^']+)'/g,
  /\bdetailApi:\s*'\/([^']+)'/g,
  /\bapi(?:Get|Post|Put|Delete)(?:<[^>]*>)?\(\s*'\/([^']+)'/g,
  /\bapi(?:Get|Post|Put|Delete)(?:<[^>]*>)?\(\s*"\/?([^"]+)"/g,
];

const BACKEND_ROUTE_PATTERN = /\.route\(\s*"([^"]+)"/g;
/** 规格表里的端点字符串：形如 "/setting/config/shippingSettings" */
const BACKEND_SPEC_PATTERN = /"((?:\/adminapi)?\/[a-zA-Z][\w-]*(?:\/[\w-]+){1,4})"/g;

function walk(dir, filter, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      walk(full, filter, out);
    } else if (filter(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function normalize(p) {
  let value = String(p || '').trim();
  if (value.startsWith('/adminapi/')) value = value.slice('/adminapi'.length);
  const noQuery = value.split('?')[0];
  return noQuery.startsWith('/') ? noQuery : `/${noQuery}`;
}

function looksLikeRoute(value) {
  // 过滤掉明显不是接口的字符串（以 http、# 开头，或没有分段）
  return value.startsWith('/') && !value.startsWith('//') && value.split('/').filter(Boolean).length >= 2;
}

function collectFrontend() {
  const found = new Map();
  const files = walk(SRC_DIR, (name) => /\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts'));
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const pattern of FRONTEND_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(text))) {
        const raw = match[1];
        if (!raw) continue;
        const normalized = normalize(raw);
        if (!looksLikeRoute(normalized)) continue;
        if (!found.has(normalized)) found.set(normalized, new Set());
        found.get(normalized).add(path.relative(ADMIN_ROOT, file));
      }
    }
  }
  return found;
}

function collectBackend() {
  const routes = new Set();
  const dirs = [BACKEND_DIR, ...BACKEND_EXTRA_DIRS];
  for (const dir of dirs) {
    const files = walk(dir, (name) => name.endsWith('.rs'));
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      BACKEND_ROUTE_PATTERN.lastIndex = 0;
      let match;
      while ((match = BACKEND_ROUTE_PATTERN.exec(text))) {
        routes.add(normalize(match[1]));
      }
      // 规格表端点（只在明显是路由清单的文件里收集，避免误收普通字符串）
      if (/endpoints\(\)|EndpointSpec|endpoint_specs/.test(text)) {
        BACKEND_SPEC_PATTERN.lastIndex = 0;
        while ((match = BACKEND_SPEC_PATTERN.exec(text))) {
          const value = normalize(match[1]);
          if (looksLikeRoute(value)) routes.add(value);
        }
      }
    }
  }
  return routes;
}

const frontend = collectFrontend();
const backend = collectBackend();

const missing = [];
for (const [endpoint, sources] of frontend) {
  if (backend.has(endpoint)) continue;
  // 兼容后端使用 :param / {id} 形式的动态段
  const dynamicHit = [...backend].some((route) => {
    if (!route.includes(':') && !route.includes('{')) return false;
    const regex = new RegExp(`^${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\?/g, '\\?').replace(/:[A-Za-z_]+|\{[A-Za-z_]+\}/g, '[^/]+')}$`);
    return regex.test(endpoint);
  });
  if (dynamicHit) continue;
  missing.push({ endpoint, sources: [...sources].sort() });
}
missing.sort((a, b) => a.endpoint.localeCompare(b.endpoint));

const json = process.argv.includes('--json');
if (json) {
  console.log(JSON.stringify({ frontendEndpoints: frontend.size, backendRoutes: backend.size, missing }, null, 2));
} else {
  console.log('后台接口契约审计');
  console.log(`  前端接口路径 : ${frontend.size}`);
  console.log(`  后端已注册路由: ${backend.size}`);
  if (!missing.length) {
    console.log('\n✓ 全部匹配，未发现缺失端点');
  } else {
    console.log(`\n✗ 缺失 ${missing.length} 个端点：`);
    for (const row of missing) {
      console.log(`  ${row.endpoint}`);
      console.log(`      ← ${row.sources.slice(0, 3).join(', ')}${row.sources.length > 3 ? ` 等 ${row.sources.length} 处` : ''}`);
    }
  }
}

process.exit(missing.length ? 1 : 0);
