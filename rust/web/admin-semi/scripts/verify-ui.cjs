const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('CONSOLE', msg.text());
  });
  page.on('pageerror', (err) => console.log('PAGEERROR', err.message));

  await page.goto('http://127.0.0.1:3002/', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('请输入用户名').fill('admin');
  await page.getByPlaceholder('请输入密码').fill('admin123');
  await page.getByRole('button', { name: /登\s*录/ }).click();
  await page.waitForTimeout(2000);
  const orgEntry = page.getByText('管理后台', { exact: true }).first();
  if ((await orgEntry.count()) > 0) {
    await orgEntry.click();
    await page.waitForTimeout(2500);
  }
  await page.waitForTimeout(3000);
  console.log('after login:', page.url());
  await page.screenshot({ path: 'preview-live-dashboard.png' });

  await page.goto('http://127.0.0.1:3002/?page=orders', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  console.log('orders rows:', await page.locator('.semi-table-tbody .semi-table-row').count());
  await page.screenshot({ path: 'preview-live-orders.png' });

  await page.getByText('查看详情').first().click();
  await page.waitForTimeout(2500);
  console.log('drawer visible:', await page.locator('.semi-sidesheet-inner').count());
  await page.screenshot({ path: 'preview-live-order-detail.png' });

  await browser.close();
})();

