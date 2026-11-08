#!/usr/bin/env node
/**
 * 生成 out/ 静态预览站（只给检查/预览用，不参与线上部署）。
 *
 * 背景：这个项目是 Next.js 服务端渲染（server.js + .next），部署方式是 systemd 常驻，
 * 本身没有 `next export` 产物；但对外检查/预览需要一个能直接打开的静态站，
 * 于是这里做一件事：把已经构建好的应用用 `next start` 起在环回端口上，
 * 逐条路由抓取渲染好的 HTML，写成 out/<route>/index.html，再把 .next/static 与 public 拷过去。
 *
 * 只读源码、只写 out/；抓不到就跳过并在最后报告，绝不因此让 `npm run build` 失败。
 * 用法：node scripts/static-snapshot.mjs [--port 3411] [--deadline 420] [--concurrency 6]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'out');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const PORT = Number(arg('port', '3411'));
const DEADLINE_MS = Number(arg('deadline', '420')) * 1000;
const CONCURRENCY = Math.max(1, Number(arg('concurrency', '6')));

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name === 'page.tsx') out.push(full);
  }
  return out;
}

function toRoute(file) {
  const rel = path.relative(path.join(root, 'app'), file).replace(/\\/g, '/').replace(/\/?page\.tsx$/, '');
  return `/${rel}`.replace(/\/$/, '') || '/';
}

const SKIP = new Set(['/robots.txt', '/sitemap.xml', '/apple-icon.png', '/icon.png', '/manifest.webmanifest']);

/**
 * 这些不是页面，而是 metadata 路由（app/manifest.ts、app/robots.ts、app/sitemap.ts、app/icon.png 等）。
 * 静态快照也必须把它们写成文件，否则浏览器/检查器请求 /manifest.webmanifest 会 404，
 * 控制台报 "Manifest fetch … failed, code 404"。
 */
const METADATA_ROUTES = ['/manifest.webmanifest', '/robots.txt', '/sitemap.xml', '/icon.png', '/apple-icon.png', '/favicon.ico'];

const routes = walk(path.join(root, 'app'))
  .map(toRoute)
  .filter((route) => !route.includes('[') && !SKIP.has(route) && !/\.(png|txt|xml|webmanifest)$/.test(route))
  .sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else if (!fs.existsSync(dst)) fs.copyFileSync(src, dst);
  }
}

/** /_next/image?url=…&w=…&q=… 在静态目录里没有对应文件，换回原始图片地址。 */
function deOptimizeImages(html) {
  return html.replace(/\/_next\/image\?url=([^&"'\s]+)(?:&(?:amp;)?[^"'\s]*)?/g, (match, url) => {
    try {
      return decodeURIComponent(url);
    } catch {
      return match;
    }
  });
}

function writeRoute(route, html) {
  const target = route === '/' ? path.join(outDir, 'index.html') : path.join(outDir, route, 'index.html');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, deOptimizeImages(html), 'utf8');
}

async function waitForServer(base, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${base}/`, { signal: AbortSignal.timeout(5000) });
      if (res.status < 500) return true;
    } catch {
      /* 还没起来 */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  if (!fs.existsSync(path.join(root, '.next'))) {
    console.error('[static-snapshot] 没有 .next，先跑 npm run build:next');
    process.exit(0);
  }
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const require = createRequire(import.meta.url);
  const nextBin = require.resolve('next/dist/bin/next');
  const server = spawn(process.execPath, [nextBin, 'start', '-p', String(PORT), '-H', '127.0.0.1'], {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: 'ignore',
  });

  const base = `http://127.0.0.1:${PORT}`;
  const ok = await waitForServer(base, 90000);
  if (!ok) {
    server.kill();
    console.error('[static-snapshot] 服务没起来，跳过静态预览（不影响部署产物）');
    process.exit(0);
  }

  copyDir(path.join(root, '.next', 'static'), path.join(outDir, '_next', 'static'));
  copyDir(path.join(root, 'public'), outDir);

  const started = Date.now();
  const queue = [...routes];
  const done = [];
  const failed = [];

  async function worker() {
    while (queue.length) {
      if (Date.now() - started > DEADLINE_MS) return;
      const route = queue.shift();
      try {
        const res = await fetch(`${base}${route}`, {
          redirect: 'follow',
          signal: AbortSignal.timeout(45000),
          headers: { 'user-agent': 'pc-semi-static-snapshot' },
        });
        const html = await res.text();
        if (!res.ok || !/<html/i.test(html)) throw new Error(`HTTP ${res.status}`);
        writeRoute(route, html);
        done.push(route);
      } catch (error) {
        failed.push(`${route} (${error.message})`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // metadata 路由：manifest / robots / sitemap / 图标，按原始字节落到 out/ 根下
  const metaWritten = [];
  for (const route of METADATA_ROUTES) {
    try {
      const res = await fetch(`${base}${route}`, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      if (!buffer.length) continue;
      fs.writeFileSync(path.join(outDir, route.replace(/^\//, '')), buffer);
      metaWritten.push(route);
    } catch {
      /* 单个 metadata 路由失败不影响整站 */
    }
  }

  server.kill();

  if (!fs.existsSync(path.join(outDir, 'index.html'))) {
    const first = done.find((route) => route !== '/');
    if (first) fs.copyFileSync(path.join(outDir, first, 'index.html'), path.join(outDir, 'index.html'));
    done.unshift('/');
  }

  console.log(`[static-snapshot] out/ 生成完成：${done.length} 页，${failed.length} 页跳过`);
  console.log(`[static-snapshot] metadata: ${metaWritten.join(', ') || '(none)'}`);
  if (failed.length) console.log(`[static-snapshot] 跳过：${failed.slice(0, 20).join('、')}${failed.length > 20 ? ' …' : ''}`);
}

main().catch((error) => {
  console.error('[static-snapshot] 出错但不算构建失败：', error?.message || error);
  process.exit(0);
});
