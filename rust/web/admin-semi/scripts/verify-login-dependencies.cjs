const { chromium } = require('playwright-core');

const BASE = process.env.VERIFY_BASE || 'http://127.0.0.1:3002';

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const failures = [];

  await page.goto(`${BASE}/?page=loginSetting`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('请输入用户名').fill('admin');
  await page.getByPlaceholder('请输入密码').fill('admin123');
  await page.getByRole('button', { name: /登\s*录/ }).click();
  await page.waitForTimeout(2400);

  // 登录后可能进入组织选择页（多组织账号），需先进入管理后台
  const orgEntry = page.getByText('管理后台', { exact: true }).first();
  if (await orgEntry.count()) {
    await orgEntry.click();
    await page.waitForTimeout(2400);
  }

  const oauth = page.locator('.auto-config-field').filter({ hasText: '开启公众号授权登录' }).first();

  const wechatGroup = page
    .locator('.auto-config-subgroup')
    .filter({ hasText: '公众号授权配置' });

  await oauth.getByText('否', { exact: true }).click();
  await page.waitForTimeout(350);
  if ((await wechatGroup.count()) !== 0) {
    failures.push('关闭公众号授权登录后，公众号授权配置模块仍然显示');
  }

  await oauth.getByText('是', { exact: true }).click();
  await page.waitForTimeout(350);

  if ((await wechatGroup.count()) !== 1) failures.push('开启公众号授权登录为是时，公众号授权配置模块未显示');
  const labels = await wechatGroup.locator('.auto-config-field label').allInnerTexts();
  for (const label of ['微信APPID', '微信AppSecret', '微信服务器Token', '微信服务器Secret']) {
    if (!labels.includes(label)) failures.push(`公众号授权配置缺少字段: ${label}`);
  }

  await oauth.getByText('否', { exact: true }).click();
  await page.waitForTimeout(350);
  if ((await wechatGroup.count()) !== 0) failures.push('关闭公众号授权登录后，公众号授权配置模块仍然显示');

  for (const label of ['PC微信扫码登录', '是否需要绑定手机号', '微信小程序快捷登录']) {
    const field = page.locator('.auto-config-field').filter({ hasText: label }).first();
    if ((await field.locator('.semi-radio-disabled').count()) < 1) {
      failures.push(`${label} 未同步置灰`);
    }
  }

  await page.screenshot({ path: 'preview-login-dependency-check.png' });
  await browser.close();

  if (failures.length) {
    console.error('FAIL');
    failures.forEach((item) => console.error(`  - ${item}`));
    process.exit(1);
  }
  console.log('PASS: 微信登录模块显隐与联动禁用检查通过');
})();

