/**
 * examples/leaflet-elevation_upload-gpx.html
 */

import assert from 'node:assert/strict';
import { it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from '../build/server.js';

/**
 * @see https://github.com/Raruto/leaflet-elevation/issues/275
 */
it('uploads GPX waypoints with labels and clears them on replacement', { timeout: 60000 }, async t => {
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
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (['warning', 'error'].includes(message.type())) errors.push(message.text());
    });
    await page.route(/\.html$/, async route => {
        const response = await route.fetch();
        const body = (await response.text()).replace(/https:\/\/unpkg.com\/@raruto\/leaflet-elevation@[^/]+\//g, '../');
        await route.fulfill({ response, body });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/examples/leaflet-elevation_upload-gpx.html`);

    for (const filename of ['waypoints.gpx', 'waypoints.gpx', 'time.gpx']) {
        await page.evaluate(() => {
            window.uploadedData = new Promise(resolve => {
                controlElevation.once('eledata_loaded', () => resolve());
            });
        });
        await page.locator('input[type="file"]').setInputFiles(fileURLToPath(new URL(filename, import.meta.url)));
        await page.evaluate(() => window.uploadedData);
        await page.waitForFunction(() => controlElevation._chart && controlElevation._data.length > 0);
        await page.waitForFunction(() => controlElevation._markers.getLayers().every(marker => map.hasLayer(marker)));
        const state = await page.evaluate(() => ({
            markers: controlElevation._markers.getLayers().map(marker => ({
                visible: map.hasLayer(marker),
                label: marker.getTooltip()?.getContent()
            })),
            visibleMarkers: Object.values(map._layers).filter(layer => layer instanceof L.Marker).length,
            points: controlElevation._container.querySelectorAll('.point > .point').length,
            distance: controlElevation.track_info.distance
        }));
        const count = filename === 'waypoints.gpx' ? 4 : 0;
        assert.strictEqual(state.markers.length, count);
        assert.strictEqual(state.visibleMarkers, count);
        assert.strictEqual(state.points, count);
        assert.ok(state.markers.every(marker => marker.visible && marker.label));
        assert.ok(state.distance > 0);
    }
    assert.deepStrictEqual(errors, []);
});
