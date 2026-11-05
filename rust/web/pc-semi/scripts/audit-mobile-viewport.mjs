#!/usr/bin/env node
/**
 * 移动端 viewport / 响应式元信息回归检查（联网）。
 *
 * 用法：
 *   node scripts/audit-mobile-viewport.mjs
 *   PC_BASE=http://127.0.0.1:3004 node scripts/audit-mobile-viewport.mjs
 *
 * 覆盖：
 *   1. 核心页面在「桌面 UA / iPhone UA」下的 viewport meta 一致且允许缩放；
 *   2. theme-color / format-detection / manifest / html lang 存在；
 *   3. 304/404 渠道：不存在的商品页返回 404 + noindex，且 viewport 不丢失；
 *   4. 输出每条页面检查结果，任一失败退出码 1。
 */
const BASE = (process.env.PC_BASE || 'http://127.0.0.1:3004').replace(/\/$/, '');
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const PAGES = ['/', '/search', '/product/1576', '/shop', '/article', '/help', '/activity', '/seckill', '/exchange'];
const NOT_FOUND_PATH = '/product/99999999';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
}

async function fetchPage(pathname, ua) {
  const response = await fetch(`${BASE}${pathname}`, {
    headers: { 'user-agent': ua, accept: 'text/html' },
    redirect: 'manual',
  });
  const text = await response.text();
  return { status: response.status, text };
}

function viewportContent(html) {
  const match = html.match(/<meta name="viewport" content="([^"]*)"/);
  return match ? match[1] : '';
}

function metaContent(html, name) {
  const match = html.match(new RegExp(`<meta name="${name}" content="([^"]*)"`));
  return match ? match[1] : '';
}

function assertPageMeta(label, html) {
  const viewport = viewportContent(html);
  check(`${label}: 有 viewport meta`, Boolean(viewport), viewport);
  check(`${label}: width=device-width`, /width=device-width/.test(viewport), viewport);
  check(`${label}: initial-scale=1`, /initial-scale=1/.test(viewport), viewport);
  check(`${label}: 未禁用缩放（无 maximum-scale/user-scalable=no）`, !/maximum-scale|user-scalable=no/.test(viewport), viewport);
  check(`${label}: theme-color=#165dff`, metaContent(html, 'theme-color') === '#165dff', metaContent(html, 'theme-color'));
  check(`${label}: format-detection telephone=no`, /telephone=no/.test(metaContent(html, 'format-detection')));
  check(`${label}: html lang 存在`, /<html[^>]*\slang="/.test(html));
  check(`${label}: manifest link 存在`, /<link rel="manifest"/.test(html));
}

for (const pathname of PAGES) {
  try {
    const desktop = await fetchPage(pathname, DESKTOP_UA);
    const mobile = await fetchPage(pathname, MOBILE_UA);
    check(`${pathname}: 桌面 UA 状态 200`, desktop.status === 200, String(desktop.status));
    check(`${pathname}: 移动 UA 状态 200`, mobile.status === 200, String(mobile.status));
    assertPageMeta(`${pathname} (桌面)`, desktop.text);
    assertPageMeta(`${pathname} (移动)`, mobile.text);
    const desktopViewport = viewportContent(desktop.text);
    const mobileViewport = viewportContent(mobile.text);
    check(`${pathname}: 桌面/移动 viewport 一致`, desktopViewport === mobileViewport, `${desktopViewport} vs ${mobileViewport}`);
  } catch (error) {
    check(`${pathname}: 请求成功`, false, error instanceof Error ? error.message : String(error));
  }
}

try {
  const missing = await fetchPage(NOT_FOUND_PATH, MOBILE_UA);
  check('404: 状态码为 404', missing.status === 404, String(missing.status));
  check('404: 保留 viewport meta', /name="viewport"/.test(missing.text));
  check('404: 含 robots noindex', /<meta name="robots" content="noindex"/.test(missing.text));
  check('404: 无冲突 index,follow', !/<meta name="robots" content="index, follow"/.test(missing.text));
} catch (error) {
  check('404: 请求成功', false, error instanceof Error ? error.message : String(error));
}

const failed = results.filter((item) => !item.ok);
for (const item of results) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.detail ? `  [${item.detail}]` : ''}`);
}
console.log('');
console.log(`pages: ${PAGES.length}, checks: ${results.length}, failed: ${failed.length}`);
process.exit(failed.length ? 1 : 0);
