/**
 * examples/leaflet-elevation_linear-gradient.html
 */

import assert from 'node:assert/strict';
import { it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from '../build/server.js';

/**
 * @see https://github.com/Raruto/leaflet-elevation/issues/306
 */
it('linearGradient follows chart x coordinates and numeric bounds', { timeout: 60000 }, async t => {
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
    let body = (await response.text()).replace(/https:\/\/unpkg.com\/@raruto\/leaflet-elevation@[^/]+\//g, '../');
    assert.match(body, /min: 'elevation_min'/);
    assert.match(body, /max: 'elevation_max'/);
    body = body.replace("min: 'elevation_min'", 'min: 100000').replace("max: 'elevation_max'", 'max: 200000');
    await route.fulfill({ response, body });
  });
  await page.route('**/demo.geojson', route => route.fulfill({
    path: fileURLToPath(new URL('./demo.geojson', import.meta.url))
  }));
  await page.goto(`http://127.0.0.1:${server.address().port}/examples/leaflet-elevation_linear-gradient.html`);
  await page.waitForFunction(() =>
    typeof controlElevation !== 'undefined' &&
    controlElevation._data.length > 0 &&
    document.querySelector('linearGradient[id^="altitude-gradient-"] stop')
  );

  const { values, stops } = await page.evaluate(() => {
    const xAttr = controlElevation._chart._props.areas.altitude.xAttr;
    return {
      values: controlElevation._data.map(point => point[xAttr]),
      stops: [...document.querySelectorAll('linearGradient[id^="altitude-gradient-"] stop')].map(stop => ({
        offset: Number(stop.getAttribute('offset')),
        color: stop.getAttribute('stop-color')
      }))
    };
  });

  assert.strictEqual(stops.length, values.length);
  assert.deepStrictEqual(
    stops.map(stop => stop.offset),
    values.map(value => (value - values[0]) / (values[values.length - 1] - values[0]))
  );
  assert.ok(stops.every(stop => stop.color === 'rgb(1,136,0)'));
});
