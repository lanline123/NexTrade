import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

/**
 * 复制 Semi Design 基础 CSS 到 app/semi.css。
 *
 * 依赖布局在不同环境不一样：
 *   - 普通 npm：pc-semi/node_modules/...
 *   - pnpm workspace（hoisted）：rust/web/node_modules/...
 *   - pnpm 默认隔离：rust/web/node_modules/.pnpm/@douyinfe+semi-ui@x/node_modules/...
 * 这里逐层向上找，并兜底扫描 .pnpm 目录，避免 CI / 本地 / 服务器任何一处失败。
 */
const root = process.cwd();
const target = path.join(root, 'app/semi.css');
const rel = 'dist/css/semi.min.css';
const candidates = [];

// 1) 逐层向上找 node_modules
let dir = root;
for (let i = 0; i < 5; i += 1) {
  candidates.push(path.join(dir, 'node_modules/@douyinfe/semi-ui', rel));
  const parent = path.dirname(dir);
  if (parent === dir) break;
  dir = parent;
}

// 2) require.resolve
try {
  const require = createRequire(path.join(root, 'package.json'));
  const pkgJson = require.resolve('@douyinfe/semi-ui/package.json');
  candidates.push(path.join(path.dirname(pkgJson), rel));
} catch {
  // ignore
}

// 3) 兜底：扫 pnpm 隔离目录
for (const nm of [path.join(root, 'node_modules'), path.join(root, '../node_modules')]) {
  const pnpmDir = path.join(nm, '.pnpm');
  if (!fs.existsSync(pnpmDir)) continue;
  for (const entry of fs.readdirSync(pnpmDir)) {
    if (!entry.startsWith('@douyinfe+semi-ui@')) continue;
    candidates.push(path.join(pnpmDir, entry, 'node_modules/@douyinfe/semi-ui', rel));
  }
}

const source = candidates.find((file) => fs.existsSync(file));
if (!source) {
  throw new Error(`Semi CSS not found, tried:\n${candidates.join('\n')}`);
}

fs.copyFileSync(source, target);
console.log(`[pc-semi] copied Semi CSS to app/semi.css  (from ${path.relative(root, source)})`);
