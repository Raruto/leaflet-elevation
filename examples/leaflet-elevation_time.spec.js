import assert from 'node:assert/strict';
import { it } from 'node:test';
import { chromium } from 'playwright';
import { startServer } from '../build/server.js';

/**
 * @see https://github.com/Raruto/leaflet-elevation/issues/300
 */
it('estimates missing timestamps in metric distance with imperial units', { timeout: 60000 }, async t => {
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
    const body = (await response.text())
      .replace(/https:\/\/unpkg.com\/@raruto\/leaflet-elevation@[^/]+\//g, '../')
      .replace('imperial: false', 'imperial: true');
    await route.fulfill({ response, body });
  });
  await page.route('**/via-emilia.gpx', route => route.fulfill({
    contentType: 'application/gpx+xml',
    body: `<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg><trkpt lat="0" lon="0"><ele>0</ele></trkpt><trkpt lat="0" lon="0.01"><ele>0</ele></trkpt></trkseg></trk></gpx>`
  }));
  await page.goto(`http://127.0.0.1:${server.address().port}/examples/leaflet-elevation.html`);
  await page.waitForFunction(() =>
    typeof controlElevation !== 'undefined' &&
    controlElevation._data.length === 2 &&
    Number.isFinite(controlElevation.track_info.time)
  );

  const { duration, expectedDuration, distance } = await page.evaluate(() => ({
    duration: controlElevation.track_info.time,
    expectedDuration: L.latLng(0, 0).distanceTo(L.latLng(0, 0.01)) / 1000 / 3.6 * 3600 * 1000,
    distance: controlElevation.track_info.distance
  }));
  assert.ok(Math.abs(duration - expectedDuration) <= 2);
  assert.ok(distance < 1);
});
