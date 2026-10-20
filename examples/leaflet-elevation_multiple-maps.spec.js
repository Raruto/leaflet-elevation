/**
 * examples/leaflet-elevation_multiple-maps.html
 */

import assert from 'node:assert/strict';
import { it } from 'node:test';
import { chromium } from 'playwright';
import { startServer } from '../build/server.js';

/**
 * Per-chart options must not overwrite the defaults shared by other charts.
 * @see https://github.com/Raruto/leaflet-elevation/issues/238#issuecomment-1493717835
 * @see https://github.com/Raruto/leaflet-elevation/issues/238#issuecomment-1493826767
 */
it('multiple-maps', { timeout: 10000 }, async t => {
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
    await page.goto(`http://127.0.0.1:${server.address().port}/examples/leaflet-elevation_multiple-maps.html`);
    const { charts, default_margins } = await page.evaluate(() => new Promise(resolve => {
        resolve({ charts, default_margins: L.Control.Elevation.prototype.options.margins });
    }));
    charts.forEach(chart => { assert.strictEqual(chart.options.legend, true); });
    assert.strictEqual(
        JSON.stringify(default_margins),
        JSON.stringify({ top: 30, right: 30, bottom: 30, left: 40 })
    );
});