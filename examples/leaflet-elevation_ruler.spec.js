import assert from 'node:assert/strict';
import { it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from '../build/server.js';

/**
 * @see https://github.com/Raruto/leaflet-elevation/issues/290
 */
it('restores the ruler when a detached elevation control is re-added', { timeout: 60000 }, async t => {
  const server = await startServer(0);
  let browser;
  t.after(async () => {
    try {
      await browser?.close();
    } finally {
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route(/\.html$/, async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace(/https:\/\/unpkg.com\/@raruto\/leaflet-elevation@[^/]+\//g, '../');
    await route.fulfill({ response, body });
  });
  await page.route('**/via-emilia.gpx', route => route.fulfill({
    path: fileURLToPath(new URL('./via-emilia.gpx', import.meta.url))
  }));
  await page.goto(`http://127.0.0.1:${server.address().port}/examples/leaflet-elevation.html`);
  await page.waitForFunction(() =>
    typeof controlElevation !== 'undefined' &&
    controlElevation._chart &&
    controlElevation._data.length > 0 &&
    controlElevation._container.querySelector('.horizontal-drag-line')
  );

  const rulerRestored = await page.evaluate(() => {
    const control = controlElevation;
    const oldContainer = control._container;
    control.onRemove(map);
    oldContainer.remove();
    control.addTo(map);
    return new Promise(resolve => {
      const check = () => {
        if (control._container && control._container !== oldContainer && control._chart &&
            control._container.querySelector('.horizontal-drag-line')) {
          resolve(control.eleDiv === control._container);
        } else {
          requestAnimationFrame(check);
        }
      };
      check();
    });
  });

  assert.strictEqual(rulerRestored, true);
});
