const { chromium } = require('playwright-core');

const BASE = 'http://127.0.0.1:3002';

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const failures = [];

  await page.goto(`${BASE}/?page=adminRoleManage`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('请输入用户名').fill('admin');
  await page.getByPlaceholder('请输入密码').fill('admin123');
  await page.getByRole('button', { name: /登\s*录/ }).click();
  await page.waitForTimeout(2000);
  const orgEntry = page.getByText('管理后台', { exact: true }).first();
  if ((await orgEntry.count()) > 0) {
    await orgEntry.click();
    await page.waitForTimeout(2500);
  }
  await page.waitForTimeout(2400);
  await page.getByText('添加角色', { exact: true }).click();
  await page.waitForTimeout(1400);

  const checkedBefore = await page.locator('.authority-select .semi-checkbox-checked').count();
  const target = page
    .locator('.authority-select .semi-checkbox')
    .filter({ hasText: '客服工作台' })
    .first();
  if (!(await target.count())) {
    failures.push('未找到“客服工作台”权限节点');
  } else {
    await target.click();
    await page.waitForTimeout(250);
    const checkedAfter = await page.locator('.authority-select .semi-checkbox-checked').count();
    if (checkedAfter <= checkedBefore) failures.push('勾选权限后选中状态没有变化');
  }

  const qualification = page
    .locator('.authority-select .semi-checkbox')
    .filter({ hasText: '资质审核' })
    .first();
  if (!(await qualification.count())) {
    failures.push('未找到“资质审核”权限节点');
  } else {
    const row = qualification.locator(
      'xpath=ancestor::div[contains(@class,"authority-grandchild")][1]',
    );
    const arrow = row.locator('.authority-child-more');
    if (!(await arrow.count())) {
      failures.push('“资质审核”缺少操作权限下拉三角');
    } else {
      await arrow.click();
      await page.waitForTimeout(300);
      const actions = page.locator('.authority-child-actions');
      const text = (await actions.innerText()).replace(/\s+/g, '');
      for (const label of ['编辑', '删除', '批量操作']) {
        if (!text.includes(label)) failures.push(`操作权限下拉缺少: ${label}`);
      }
      const wrapper = page.locator('.semi-dropdown-wrapper:has(.authority-child-actions)');
      if (!(await wrapper.count())) {
        failures.push('操作权限下拉容器不存在');
      } else {
        const style = await wrapper.first().evaluate((el) => {
          const computed = getComputedStyle(el);
          return { radius: computed.borderRadius, padding: computed.padding };
        });
        if (parseFloat(style.radius) > 5) failures.push(`下拉圆角过大: ${style.radius}`);
      }
    }
  }

  await page.screenshot({ path: 'preview-role-authority-check.png' });
  await browser.close();

  if (failures.length) {
    console.error('FAIL');
    failures.forEach((item) => console.error(`  - ${item}`));
    process.exit(1);
  }
  console.log('PASS: 权限复选框、操作权限下拉、下拉样式检查通过');
})();

