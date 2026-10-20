/**
 * examples/leaflet-elevation_bathymetry.html
 */

import assert from 'node:assert/strict';
import { it } from 'node:test';
import { chromium } from 'playwright';
import { startServer } from '../build/server.js';

it('bathymetry example keeps every underwater marker finite, bounded and ordered', { timeout: 10000 }, async t => {
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
    await page.goto(`http://127.0.0.1:${server.address().port}/examples/leaflet-elevation_bathymetry.html`);
    await page.waitForFunction(() =>
        typeof controlElevation !== 'undefined' && controlElevation._data.length > 0
    );
    const markers = await page.evaluate(() => {
        const data = controlElevation._data.map(item => {
            controlElevation._updateMarker(item);
            const line = document.querySelector('.height-focus.line');
            const label = document.querySelector('.height-focus-label');

            return {
                // Normalize the rendered marker height to compare it with the chart bounds.
                height: (+line.getAttribute('y1') - +line.getAttribute('y2')) / controlElevation._height(),
                elevation: item.z,
                label: label.textContent,
                labelY: +label.getAttribute('y'),
                lineY: +line.getAttribute('y2')
            };
        });

        return data;
    });

    assert.strictEqual(markers.length, 178);

    markers.forEach(marker => {
        assert.ok(Number.isFinite(marker.height));
        assert.ok(marker.height >= 0 && marker.height <= 1);
        assert.ok(marker.label.includes(String(marker.elevation)));
        assert.strictEqual(marker.labelY, marker.lineY);
    });

    // Underwater elevations must still map monotonically across the full chart height.
    const sorted = markers.slice().sort((a, b) => a.elevation - b.elevation);
    assert.strictEqual(sorted[0].height, 0);
    assert.ok(Math.abs(sorted[sorted.length - 1].height - 1) < 1e-8);
    sorted.slice(1).forEach((marker, i) => assert.ok(marker.height >= sorted[i].height - 1e-8));
});
