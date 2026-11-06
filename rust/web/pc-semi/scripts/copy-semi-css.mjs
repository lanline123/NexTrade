import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

/**
 * 复制 Semi Design 基础 CSS 到 app/semi.css。
 *
 * 兼容三种依赖布局：
 * 1. pc-semi/node_modules（普通 npm 安装）
 * 2. rust/web/node_modules（pnpm workspace hoisted，CI 用）
 * 3. 通过 require.resolve 解析到的实际包路径（pnpm 隔离布局）
 */
const root = process.cwd();
const target = path.join(root, 'app/semi.css');

const candidates = [
  path.join(root, 'node_modules/@douyinfe/semi-ui/dist/css/semi.min.css'),
  path.join(root, '../../node_modules/@douyinfe/semi-ui/dist/css/semi.min.css'),
];

try {
  const require = createRequire(path.join(root, 'package.json'));
  const pkgJson = require.resolve('@douyinfe/semi-ui/package.json');
  candidates.push(path.join(path.dirname(pkgJson), 'dist/css/semi.min.css'));
} catch {
  // 解析失败时忽略，继续用候选路径
}

const source = candidates.find((file) => fs.existsSync(file));
if (!source) {
  throw new Error(`Semi CSS not found, tried:\n${candidates.join('\n')}`);
}

fs.copyFileSync(source, target);
console.log(`[pc-semi] copied Semi CSS to app/semi.css  (from ${path.relative(root, source)})`);
