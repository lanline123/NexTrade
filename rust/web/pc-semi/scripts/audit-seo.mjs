#!/usr/bin/env node
/**
 * PC SEO / sitemap / robots 静态审计（可选联网回归）。
 *
 * 用法：
 *   node scripts/audit-seo.mjs            # 仅静态检查（不依赖服务）
 *   PC_BASE=http://127.0.0.1:3004 node scripts/audit-seo.mjs --live
 *   node scripts/audit-seo.mjs --live     # 默认 base http://127.0.0.1:3004
 *
 * 检查分三组：
 *   1. 单文件完整性：layout / robots / sitemap / manifest / not-found / error；
 *   2. seam（跨文件一致性）：viewport.themeColor ↔ manifest.theme_color、
 *      metadataBase ↔ sitemap BASE、sitemap 静态路径 ↔ robots 放行；
 *   3. --live：对运行中的站点验证 robots.txt / sitemap.xml / manifest /
 *      首页 meta / 404 meta 的实际输出。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.PC_BASE || 'http://127.0.0.1:3004').replace(/\/$/, '');
const LIVE = process.argv.includes('--live') || Boolean(process.env.PC_BASE);

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
}
function warn(name, detail) {
  console.log(`WARN ${name}${detail ? ` :: ${detail}` : ''}`);
}

function read(rel) {
  const file = path.join(ROOT, rel);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function between(text, start, end) {
  const from = text.indexOf(start);
  if (from < 0) return '';
  const to = text.indexOf(end, from + start.length);
  return to < 0 ? '' : text.slice(from + start.length, to);
}

/* ============================ 1. 单文件检查 ============================ */
const layout = read('app/layout.tsx');
const robots = read('app/robots.ts');
const sitemap = read('app/sitemap.ts');
const manifest = read('app/manifest.ts');
const notFound = read('app/not-found.tsx');
const errorPage = read('app/error.tsx');

// layout.tsx
check('layout: 导出 viewport', /export const viewport\s*:\s*Viewport/.test(layout));
check('layout: viewport width=device-width', /width:\s*'device-width'/.test(layout));
check('layout: viewport initialScale=1', /initialScale:\s*1/.test(layout));
check('layout: viewport viewportFit=cover', /viewportFit:\s*'cover'/.test(layout));
check('layout: viewport colorScheme=light', /colorScheme:\s*'light'/.test(layout));
check('layout: viewport themeColor 与 manifest 一致（#165dff）', /themeColor:\s*'#165dff'/.test(layout));
check('layout: metadataBase 使用 SITE_URL', /metadataBase:\s*new URL\(SITE_URL\)/.test(layout));
check('layout: 顶层 title/description', /title:\s*SITE_TITLE/.test(layout) && /description:\s*SITE_DESCRIPTION/.test(layout));
check('layout: manifest 指向 /manifest.webmanifest', /manifest:\s*'\/manifest\.webmanifest'/.test(layout));
check('layout: openGraph.images 已配置', /images:\s*\[\s*\{\s*url:\s*SITE_OG_IMAGE/.test(layout));
check('layout: twitter.images 已配置', /twitter:[\s\S]*?images:\s*\[SITE_OG_IMAGE\]/.test(layout));
check('layout: formatDetection 关闭电话/邮箱自动链接', /formatDetection:\s*\{[^}]*telephone:\s*false/.test(layout));
check('layout: appleWebApp 已配置', /appleWebApp:\s*\{/.test(layout));
check('layout: JSON-LD (application/ld+json)', /application\/ld\+json/.test(layout));
check('layout: 不再强制 robots index/follow（避免与 404 的自动 noindex 冲突）', !/robots:\s*\{[\s\S]*?index:\s*true/.test(between(layout, 'const metadata', 'export const viewport')));
check('layout: Googlebot 增强指令通过 other 声明', /other:\s*\{[\s\S]*?googlebot:\s*'index, follow, max-image-preview:large/.test(layout));

// robots.ts
const disallowBlock = between(robots, 'const DISALLOW_PATHS = [', '];');
const disallowList = [...disallowBlock.matchAll(/'([^']+)'/g)].map((m) => m[1]);
const requiredDisallow = [
  '/api/',
  '/adminapi/',
  '/member',
  '/order',
  '/cart',
  '/chat',
  '/login',
  '/register',
  '/install',
  '/preview',
  '/oauth',
  '/pcmobile',
  '/search?',
];
for (const item of requiredDisallow) {
  check(`robots: 屏蔽 ${item}`, disallowList.includes(item), disallowList.join(', '));
}
check('robots: sitemap 指向 ${BASE}/sitemap.xml', /sitemap:\s*`\$\{BASE\}\/sitemap\.xml`/.test(robots));
check('robots: Host 使用 hostname（不含协议）', /new URL\(BASE\)\.host/.test(robots) && !/host:\s*BASE\b/.test(robots));

// sitemap.ts
const staticBlock = between(sitemap, 'const STATIC_ROUTES', '];');
const staticPaths = [...staticBlock.matchAll(/path:\s*'([^']*)'/g)].map((m) => m[1]);
const requiredStatic = [
  '',
  '/search',
  '/article',
  '/article/news/list',
  '/article/issue',
  '/help',
  '/coupon/list',
  '/activity',
  '/seckill',
  '/exchange',
  '/shop',
  '/shop/license',
  '/join',
  '/joining',
];
for (const item of requiredStatic) {
  check(`sitemap: 包含静态路径 ${item || '/'}`, staticPaths.includes(item), staticPaths.join(', '));
}
for (const bad of ['/category', '/login', '/register']) {
  check(`sitemap: 不含重定向/禁抓路径 ${bad}`, !staticPaths.includes(bad));
}
check('sitemap: 动态商品列表已接入', /getProducts/.test(sitemap));
check('sitemap: 动态文章列表已接入', /getArticleList/.test(sitemap));
check('sitemap: 动态店铺列表已接入', /getShopList/.test(sitemap));
check('sitemap: 分页上限（MAX_LIST_PAGES）存在', /MAX_LIST_PAGES\s*=\s*\d+/.test(sitemap));
check('sitemap: 去重（seen Set）存在', /new Set\(/.test(sitemap));
check('sitemap: revalidate 已声明', /export const revalidate\s*=/.test(sitemap));

// manifest.ts
check('manifest: id/scope 已声明', /id:\s*'\/'/.test(manifest) && /scope:\s*'\/'/.test(manifest));
check('manifest: name/short_name', /name:\s*`/.test(manifest) && /short_name:\s*SITE_NAME/.test(manifest));
check('manifest: start_url 为 /', /start_url:\s*'\/'/.test(manifest));
check('manifest: display=standalone', /display:\s*'standalone'/.test(manifest));
check('manifest: theme_color=#165dff', /theme_color:\s*'#165dff'/.test(manifest));
check('manifest: icons 非空且带 sizes/purpose', /icons:\s*\[/.test(manifest) && /sizes:\s*'500x500'/.test(manifest) && /purpose:\s*'any'/.test(manifest));
check('manifest: lang=zh-CN', /lang:\s*'zh-CN'/.test(manifest));

// not-found / error
check('not-found.tsx: 导出组件且含 404 文案', /export default function NotFound/.test(notFound) && /404/.test(notFound));
check('error.tsx: 客户端边界 + reset', /'use client'/.test(errorPage) && /reset/.test(errorPage));
check('error.tsx: 可访问性 role=alert', /role="alert"/.test(errorPage));

/* ============================ 2. seam 一致性 ============================ */
const layoutSiteMatch = layout.match(/PC_SITE_URL \|\| '([^']+)'/);
const sitemapSiteMatch = sitemap.match(/PC_SITE_URL \|\| '([^']+)'/);
const layoutSite = layoutSiteMatch ? layoutSiteMatch[1] : '';
const sitemapSite = sitemapSiteMatch ? sitemapSiteMatch[1] : '';
check('seam: layout/sitemap 站点域名一致', Boolean(layoutSite) && layoutSite === sitemapSite, `${layoutSite} vs ${sitemapSite}`);
check('seam: robots sitemap 域名与 sitemap BASE 一致', robots.includes('${BASE}/sitemap.xml') && sitemap.includes('PC_SITE_URL'));
const layoutTheme = (layout.match(/themeColor:\s*'([^']+)'/) || [])[1];
const manifestTheme = (manifest.match(/theme_color:\s*'([^']+)'/) || [])[1];
check('seam: viewport.themeColor == manifest.theme_color', layoutTheme === manifestTheme, `${layoutTheme} vs ${manifestTheme}`);

const publicPrefixes = ['/', '/search', '/product', '/shop', '/article', '/activity', '/seckill', '/exchange', '/help', '/coupon/list', '/join', '/joining'];
for (const route of staticPaths) {
  const publicPath = route || '/';
  const blocked = disallowList.some((rule) => {
    if (rule.includes('?')) return false; // 查询串规则不阻塞静态路径
    return publicPath === rule || publicPath.startsWith(rule.endsWith('/') ? rule : `${rule}/`);
  });
  check(`seam: sitemap 路径 ${publicPath} 未被 robots 屏蔽`, !blocked);
}
for (const rule of disallowList) {
  if (rule.includes('?')) continue;
  const blocksPublic = publicPrefixes.some((prefix) => {
    if (prefix === '/') return false; // allow: / 已显式声明，根路径不受影响
    return prefix === rule || prefix.startsWith(rule.endsWith('/') ? rule : `${rule}/`);
  });
  check(`seam: robots 规则 ${rule} 不误伤公开页`, !blocksPublic);
}

warn('residual', 'manifest 仅 500×500 图标，缺 192/512 与 maskable（图标资源在 app/ 内，本任务写作用域不含 png）');
warn('residual', '未提供 1200×630 社交分享图，OG 暂用 /icon.png 兜底');
warn('out-of-scope', 'app/[...slug]/page.tsx 将未知路径 307 到 /（pages/** 不在本任务作用域），建议后续改为 404');

/* ============================ 3. --live 检查 ============================ */
async function fetchText(url, ua) {
  const response = await fetch(url, { headers: ua ? { 'user-agent': ua } : undefined, redirect: 'manual' });
  const text = await response.text();
  return { status: response.status, contentType: response.headers.get('content-type') || '', text };
}

if (LIVE) {
  console.log(`\n[live] base=${BASE}`);
  try {
    const robotsTxt = await fetchText(`${BASE}/robots.txt`);
    check('[live] robots.txt 200', robotsTxt.status === 200, String(robotsTxt.status));
    check('[live] robots 包含 Sitemap 且域名正确', /Sitemap:\s*https?:\/\/[^\s]*\/sitemap\.xml/.test(robotsTxt.text));
    check('[live] robots 包含 /adminapi 屏蔽', /Disallow:\s*\/adminapi\/?/.test(robotsTxt.text));
    check('[live] robots 无 www/协议错误的 Host', !/^Host:\s*https?:\/\//m.test(robotsTxt.text));

    const sitemapXml = await fetchText(`${BASE}/sitemap.xml`);
    check('[live] sitemap.xml 200', sitemapXml.status === 200, String(sitemapXml.status));
    check('[live] sitemap Content-Type 为 xml', /xml/.test(sitemapXml.contentType), sitemapXml.contentType);
    const locs = [...sitemapXml.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    check('[live] sitemap 至少包含 1 个 URL', locs.length > 0, String(locs.length));
    check('[live] sitemap URL 无重复', new Set(locs).size === locs.length, `${new Set(locs).size}/${locs.length}`);
    const sitemapHost = locs.length ? new URL(locs[0]).host : '';
    check('[live] sitemap URL host 与站点一致', !layoutSite || new URL(layoutSite).host === sitemapHost, `${sitemapHost} vs ${layoutSite}`);
    for (const route of staticPaths) {
      const expected = `${(layoutSite || '').replace(/\/$/, '')}${route || '/'}`;
      check(`[live] sitemap 包含 ${route || '/'}`, locs.includes(expected), expected);
    }

    const manifestJson = await fetchText(`${BASE}/manifest.webmanifest`);
    check('[live] manifest Content-Type', /manifest\+json/.test(manifestJson.contentType), manifestJson.contentType);
    let parsed = null;
    try {
      parsed = JSON.parse(manifestJson.text);
    } catch {
      parsed = null;
    }
    check('[live] manifest JSON 可解析', Boolean(parsed));
    check('[live] manifest theme_color', parsed?.theme_color === '#165dff', String(parsed?.theme_color));
    check('[live] manifest icons 非空', Array.isArray(parsed?.icons) && parsed.icons.length > 0);

    const home = await fetchText(`${BASE}/`);
    check('[live] 首页 viewport meta（device-width）', /<meta name="viewport" content="[^"]*width=device-width/.test(home.text));
    check('[live] 首页 theme-color meta', /<meta name="theme-color" content="#165dff"/.test(home.text));
    check('[live] 首页 format-detection meta', /<meta name="format-detection" content="telephone=no/.test(home.text));
    check('[live] 首页 OG image', /<meta property="og:image"/.test(home.text));
    check('[live] 首页不含 user-scalable=no', !/user-scalable=no/.test(home.text));

    const missing = await fetchText(`${BASE}/product/99999999`);
    check('[live] 不存在的商品返回 404', missing.status === 404, String(missing.status));
    check('[live] 404 页面含 noindex', /<meta name="robots" content="noindex"/.test(missing.text));
    check('[live] 404 页面无冲突 index,follow', !/<meta name="robots" content="index, follow"/.test(missing.text));
    check('[live] 404 页面仍有 viewport meta', /name="viewport"/.test(missing.text));
  } catch (error) {
    check('[live] 联网检查执行', false, error instanceof Error ? error.message : String(error));
  }
}

/* ============================ 输出 ============================ */
const failed = results.filter((item) => !item.ok);
for (const item of results) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.detail ? `  [${item.detail}]` : ''}`);
}
console.log('');
console.log(`checks: ${results.length}, failed: ${failed.length}${LIVE ? ' (live)' : ' (static)'}`);
process.exit(failed.length ? 1 : 0);
