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
  await page.evaluate(() => {
    const rect = document.querySelector('#profileBuilderOverlay svg rect[filter]');
    if (rect) rect.setAttribute('fill', 'red');
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'mesh_red.png', fullPage: true });
  await browser.close();
})();
