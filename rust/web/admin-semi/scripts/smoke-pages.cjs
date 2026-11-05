const { chromium } = require('playwright-core');
const fs = require('fs');

const BASE = process.env.ADMIN_BASE || 'http://127.0.0.1:3002';
const EDGE = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

(async () => {
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  const match = app.match(/const knownPages = new Set\(\[([\s\S]*?)\]\);/);
  const keys = match ? [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]) : [];
  if (!keys.length) throw new Error('knownPages not found');
  console.log(`pages: ${keys.length}`);

  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  let current = '';
  const errors = [];
  page.on('pageerror', (error) => {
    if (current) errors.push(`${current}: ${error.message}`);
  });

  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('请输入用户名').fill('admin');
  await page.getByPlaceholder('请输入密码').fill('admin123');
  await page.getByRole('button', { name: /登\s*录/ }).click();
  await page.waitForTimeout(2200);
  const org = page.getByText('管理后台', { exact: true }).first();
  if (await org.count()) {
    await org.click();
    await page.waitForTimeout(2200);
  }

  const blank = [];
  for (const key of keys) {
    current = key;
    try {
      await page.goto(`${BASE}/?page=${encodeURIComponent(key)}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(700);
      const text = (await page.locator('body').innerText()).trim();
      // 移动装修编辑器需要 ?id=，无 id 时停在加载态属于预期。
      if (text.length < 30 && key !== 'mobileDecorateEditor') blank.push(`${key}: ${text.length}`);
    } catch (error) {
      errors.push(`${key}: ${String(error.message).split('\n')[0]}`);
    }
  }

  await browser.close();
  console.log(`pageErrors: ${errors.length}`);
  errors.slice(0, 30).forEach((item) => console.log('ERR', item));
  console.log(`blankPages: ${blank.length}`);
  blank.slice(0, 30).forEach((item) => console.log('BLANK', item));
  if (errors.length || blank.length) process.exit(1);
})();
