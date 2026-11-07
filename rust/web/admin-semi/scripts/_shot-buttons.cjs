const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

  await page.goto('http://127.0.0.1:3002/?page=pcDecorateCustomManage&demo=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.semi-button', { timeout: 20000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'shot-full.png' });

  // 元素位置信息，便于精确裁剪
  const boxes = await page.evaluate(() => {
    const out = {};
    const q = (sel, name) => {
      const el = document.querySelector(sel);
      if (el) { const r = el.getBoundingClientRect(); out[name] = { x: r.x, y: r.y, w: r.width, h: r.height }; }
    };
    q('.topbar-right', 'topbarRight');
    Array.from(document.querySelectorAll('.semi-button')).forEach((b) => {
      const t = (b.textContent || '').trim().slice(0, 6);
      if (t && !out['btn:' + t]) {
        const r = b.getBoundingClientRect();
        out['btn:' + t] = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      }
    });
    return out;
  });
  console.log(JSON.stringify(boxes, null, 1));

  // hover 消息按钮
  const msg = page.locator('.semi-button.icon-btn').first();
  if (await msg.count()) {
    await msg.hover();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'shot-hover-msg.png' });
    const st = await page.evaluate(() => {
      const el = document.querySelector('.semi-button.icon-btn');
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, color: cs.color };
    });
    console.log('消息 hover:', JSON.stringify(st));
  }
  await browser.close();
})();
