const { chromium } = require('playwright-core');

const BASE = 'http://127.0.0.1:3002';

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const failures = [];

  await page.goto(`${BASE}/?page=brandManage`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('请输入用户名').fill('admin');
  await page.getByPlaceholder('请输入密码').fill('admin123');
  await page.getByRole('button', { name: /登\s*录/ }).click();
  await page.waitForTimeout(2000);
  const orgEntry = page.getByText('管理后台', { exact: true }).first();
  if ((await orgEntry.count()) > 0) {
    await orgEntry.click();
    await page.waitForTimeout(2500);
  }
  await page.waitForTimeout(2200);
  await page.getByText('添加品牌', { exact: true }).click();
  await page.waitForTimeout(600);

  const labels = await page
    .locator('.semi-sidesheet-inner .semi-form-field-label, .semi-sidesheet-inner .framework-custom-label')
    .evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { text: el.innerText, left: r.left, right: r.right, height: r.height };
      }),
    );
  const rightEdges = labels.map((item) => item.right);
  if (Math.max(...rightEdges) - Math.min(...rightEdges) > 1) {
    failures.push(`标签右边缘不齐: ${JSON.stringify(labels)}`);
  }

  const controls = await page
    .locator(
      '.semi-sidesheet-inner .semi-form-field-content, .semi-sidesheet-inner .framework-custom-content, .semi-sidesheet-inner .framework-switch-control',
    )
    .evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, width: r.width };
      }),
    );
  const leftEdges = controls.filter((item) => item.width > 0).map((item) => item.left);
  if (Math.max(...leftEdges) - Math.min(...leftEdges) > 1) {
    failures.push(`控件左边缘不齐: ${JSON.stringify(controls)}`);
  }

  const rows = await page
    .locator('.semi-sidesheet-inner .semi-form-field, .semi-sidesheet-inner .framework-switch-field')
    .evaluateAll((els) =>
      els.map((el) => ({ cls: el.className, height: el.getBoundingClientRect().height })),
    );
  for (const row of rows.filter((item) => item.height <= 60)) {
    if (Math.abs(row.height - 56) > 1) {
      failures.push(`单行字段高度不是 56px: ${JSON.stringify(row)}`);
    }
  }

  const switchRows = page.locator('.framework-switch-field');
  for (let i = 0; i < (await switchRows.count()); i += 1) {
    const row = switchRows.nth(i);
    const text = row.locator('.framework-switch-on, .framework-switch-off');
    const before = await text.innerText();
    await row.locator('.semi-switch').click();
    await page.waitForTimeout(150);
    const after = await text.innerText();
    if (before === after) failures.push(`开关点击后状态没有变化: 第 ${i + 1} 个`);
  }

  await browser.close();

  if (failures.length) {
    console.error('FAIL');
    failures.forEach((item) => console.error(`  - ${item}`));
    process.exit(1);
  }
  console.log('PASS: 表单标签对齐、控件对齐、单行高度、开关状态检查通过');
})();

