/**
 * examples/leaflet-elevation_geojson-group.html
 */

import assert from 'node:assert/strict';
import { it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from '../build/server.js';

it('attached chart mouse movement does not propagate to the map', { timeout: 10000 }, async t => {
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
    // Keep the example's two tracks local without changing its loading behavior.
    for (const name of ['demo.geojson', 'waypoints.geojson']) {
        await page.route(`**/${name}`, route =>
            route.fulfill({ path: fileURLToPath(new URL(`./${name}`, import.meta.url)) })
        );
    }
    await page.goto(`http://127.0.0.1:${server.address().port}/examples/leaflet-elevation_geojson-group.html`);

    const overlay = page.locator('.elevation-control .brush .overlay');
    await overlay.waitFor();
    // Start outside the chart before counting the movement into its overlay.
    await page.mouse.move(0, 0);
    await page.evaluate(() => {
        window.mapMouseMoves = 0;
        window.chartMouseMoves = 0;
        document.querySelector('.leaflet-map').addEventListener('mousemove', () => window.mapMouseMoves++);
        document.querySelector('.elevation-control .brush .overlay').addEventListener('mousemove', () => window.chartMouseMoves++);
    });

    const bounds = await overlay.boundingBox();
    assert.ok(bounds && bounds.width > 0 && bounds.height > 0);
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);

    // Confirm the chart received the event, not just that the map received nothing.
    assert.ok(await page.evaluate(() => window.chartMouseMoves > 0));
    assert.strictEqual(await page.evaluate(() => window.mapMouseMoves), 0);
});
