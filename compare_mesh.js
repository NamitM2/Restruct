const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const fileUrl = 'file:///' + path.resolve(__dirname, 'frontend/index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => window.profileBuilderOverlay?.open());
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'mesh_present.png', fullPage: true });
  await page.evaluate(() => {
    const svg = document.querySelector('#profileBuilderOverlay svg');
    if (svg) svg.remove();
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'mesh_removed.png', fullPage: true });
  await browser.close();
})();
