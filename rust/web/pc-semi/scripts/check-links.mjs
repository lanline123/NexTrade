const BASE = (process.env.PC_BASE || 'http://127.0.0.1:3004').replace(/\/$/, '');
const PAGES = ['/', '/search', '/product/1576', '/shop', '/shop/1', '/article', '/help', '/activity', '/seckill', '/exchange', '/joining', '/join'];

const links = new Set();
for (const page of PAGES) {
  try {
    const response = await fetch(`${BASE}${page}`, { redirect: 'manual' });
    const text = await response.text();
    for (const match of text.matchAll(/href="([^"]+)"/g)) {
      const href = match[1];
      if (!href.startsWith('/') || href.startsWith('//') || href.startsWith('/_next') || href.startsWith('/api')) continue;
      links.add(href.split('#')[0]);
    }
  } catch {
    // 单个页面失败不阻断其它页面
  }
}

const bad = [];
for (const href of links) {
  try {
    const response = await fetch(`${BASE}${href}`, { redirect: 'manual' });
    if (response.status >= 400) bad.push(`${response.status} ${href}`);
  } catch (error) {
    bad.push(`ERR ${href} ${error instanceof Error ? error.message : ''}`);
  }
}

console.log(`base: ${BASE}`);
console.log(`pages: ${PAGES.length}`);
console.log(`links: ${links.size}`);
console.log(`bad: ${bad.length}`);
for (const item of bad) console.log(item);
if (bad.length) process.exit(1);
