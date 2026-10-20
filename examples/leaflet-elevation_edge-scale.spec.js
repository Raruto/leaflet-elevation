/**
 * examples/leaflet-elevation_edge-scale.html
 */

import assert from 'node:assert/strict';
import { it } from 'node:test';
import { chromium } from 'playwright';
import { startServer } from '../build/server.js';

it('edge-scale', { timeout: 10000 }, async t => {
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
    await page.goto(`http://127.0.0.1:${server.address().port}/examples/leaflet-elevation_edge-scale.html`);
    // The optional edge-scale integration is imported asynchronously.
    await page.waitForFunction(() =>
        typeof map !== 'undefined' && typeof map.edgeScaleControl !== 'undefined'
    );
    const { map, controlElevation } = await page.evaluate(() => ({ map, controlElevation }));
    assert.notStrictEqual(typeof map.edgeScaleControl, 'undefined');
    assert.strictEqual(controlElevation.options.edgeScale.bar, true);
    assert.strictEqual(controlElevation.options.edgeScale.icon, true);
    assert.strictEqual(controlElevation.options.edgeScale.coords, true);
});