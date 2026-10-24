/**
 * examples/leaflet-elevation_custom-summary.html
 * @see https://github.com/Raruto/leaflet-elevation/issues/283
 */

import assert from 'node:assert/strict';
import { it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from '../build/server.js';

it('custom-summary: eledata_loaded', { timeout: 10000 }, async t => {
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
    page.on('console', msg => console.log(msg.text()));
    page.on('requestfailed', request => console.log(request.failure().errorText, request.url()));
    page.on('pageerror', error => console.log(error));
    // Exercise the local build instead of the version published on the CDN.
    await page.route(/\.html$/, async route => {
        const response = await route.fetch();
        const body = (await response.text()).replace(/https:\/\/unpkg.com\/@raruto\/leaflet-elevation@[^/]+\//g, '../');
        await route.fulfill({ response, body });
    });

    // Hold the initial response until the event listener is registered, even with fast local data.
    let releaseData;
    const dataGate = new Promise(resolve => { releaseData = resolve; });
    await page.route('**/demo.geojson', async route => {
        await dataGate;
        await route.fulfill({ path: fileURLToPath(new URL('./demo.geojson', import.meta.url)) });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/examples/leaflet-elevation_custom-summary.html`);
    await page.evaluate(() => {
        window.loadedData = new Promise(resolve => controlElevation.once('eledata_loaded', resolve));
        window.dataEventOrder = [];
        controlElevation.on('eledata_added', () => window.dataEventOrder.push('added'));
        controlElevation.on('eledata_loaded', () => window.dataEventOrder.push('loaded'));
    });
    releaseData();
    const json = await page.evaluate(() => window.loadedData);
    assert.strictEqual(json.name, 'demo.geojson');
    assert.notStrictEqual(typeof json.layer, 'undefined');
    assert.strictEqual(typeof json.track_info.distance, 'number');
    assert.deepStrictEqual(await page.evaluate(() => window.dataEventOrder), ['added', 'loaded']);
    assert.deepStrictEqual(
        await page.evaluate(() => [
            controlElevation._start.getLatLng().equals(controlElevation._data[0].latlng),
            controlElevation._end.getLatLng().equals(controlElevation._data.at(-1).latlng)
        ]),
        [true, true]
    );
    assert.strictEqual(await page.locator('.totlen .summaryvalue').textContent(), `${json.track_info.distance.toFixed(2)} km`);
});