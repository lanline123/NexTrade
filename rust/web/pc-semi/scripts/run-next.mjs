#!/usr/bin/env node
/**
 * 启动 Next.js 命令的包装脚本（跨平台）。
 *
 * 目的：把开发构建目录与生产构建目录分开，避免 `next dev` 覆盖 `next build` 产物。
 *   - dev  → .next-dev（PC_NEXT_DIST_DIR）
 *   - build/start → .next（默认）
 *
 * 用法：node scripts/run-next.mjs dev -p 3004
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');

const args = process.argv.slice(2);
const isDev = args[0] === 'dev';

const env = { ...process.env };
if (isDev && !env.PC_NEXT_DIST_DIR) {
  env.PC_NEXT_DIST_DIR = '.next-dev';
}

const child = spawn(process.execPath, [nextBin, ...args], {
  stdio: 'inherit',
  env,
  cwd: path.resolve(process.cwd()),
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
