const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const root = path.resolve(__dirname, '../dist');
test('public site has complete local script and stylesheet dependencies', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const m of html.matchAll(/(?:src|href)="([^"?]+)(?:\?[^" ]*)?"/g)) {
    if (!/\.(?:js|css)$/.test(m[1]) || /^(?:https?:|data:)/.test(m[1])) continue;
    assert(fs.existsSync(path.join(root, m[1])), m[1]);
  }
  assert(!html.includes('D:\\Work'));
});
test('desktop and mobile load without page errors', { timeout: 300000 }, async () => {
  const { chromium } = require('playwright'),
    { pathToFileURL } = require('node:url');
  const browser = await chromium.launch(
    process.env.WANLONG_CHROME ? { executablePath: process.env.WANLONG_CHROME } : {},
  );
  try {
    for (const viewport of [
      { width: 1200, height: 900 },
      { width: 390, height: 844 },
    ]) {
      const context = await browser.newContext({ viewport, offline: true }),
        page = await context.newPage(),
        errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
      await page.waitForFunction(() => document.getElementById('loading').hidden, null, {
        timeout: 120000,
      });
      assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => typeof window.__WANLONG__), 'undefined');
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      await context.close();
    }
  } finally {
    await browser.close();
  }
});
