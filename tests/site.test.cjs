const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const root = path.resolve(__dirname, '../dist');
const entries = ['index.html'];
const resortEntry = 'resort/index.html';
if (process.env.WANLONG_TEST_BOTH === '1' || fs.existsSync(path.join(root, resortEntry))) {
  entries.push(resortEntry);
}
test('public site has complete local script and stylesheet dependencies', () => {
  for (const entry of entries) {
    const entryPath = path.join(root, entry);
    const html = fs.readFileSync(entryPath, 'utf8');
    for (const m of html.matchAll(/(?:src|href)="([^"?]+)(?:\?[^" ]*)?"/g)) {
      if (!/\.(?:js|css|html)$/.test(m[1]) || /^(?:https?:|data:)/.test(m[1])) continue;
      assert(fs.existsSync(path.join(path.dirname(entryPath), m[1])), entry + ' → ' + m[1]);
    }
    assert(!html.includes('D:\\Work'));
  }
});
test(
  'desktop and mobile load the built maps without page errors',
  { timeout: 300000 },
  async () => {
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
        for (const entry of entries) {
          await page.goto(pathToFileURL(path.join(root, entry)).href);
          await page.waitForFunction(() => document.getElementById('loading').hidden, null, {
            timeout: 120000,
          });
          assert.deepEqual(errors, []);
          assert.equal(await page.locator('#map-load-error').count(), 0);
          assert.equal(await page.evaluate(() => typeof window.__WANLONG__), 'undefined');
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
            false,
          );
          if (entries.length === 2) {
            const scoped = entry === resortEntry;
            assert.equal((await page.title()).includes('雪场范围版'), scoped);
            const switchLink = page.locator('.map-version-link');
            assert(await switchLink.isVisible());
            assert.equal(
              await switchLink.getAttribute('href'),
              scoped ? '../index.html' : resortEntry,
            );
          }
        }
        await context.close();
      }
    } finally {
      await browser.close();
    }
  },
);
