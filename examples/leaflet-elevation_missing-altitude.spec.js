import assert from 'node:assert/strict';
import { it } from 'node:test';
import { chromium } from 'playwright';
import { startServer } from '../build/server.js';

/**
 * @see https://github.com/Raruto/leaflet-elevation/issues/265
 */
it('hotline renders missing and constant GPX elevations without invalid colors', { timeout: 60000 }, async t => {
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
    await page.route(/\.html$/, async route => {
        const response = await route.fetch();
        const body = (await response.text())
            .replace(/https:\/\/unpkg.com\/@raruto\/leaflet-elevation@[^/]+\//g, '../')
            .replace('hotline: false', 'hotline: true')
            .replace('almostOver: true', 'almostOver: false');
        await route.fulfill({ response, body });
    });
    await page.route('**/via-emilia.gpx', route => route.fulfill({
        contentType: 'application/gpx+xml',
        body: '<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>' +
            [undefined, 0, 10, undefined, undefined, 20, undefined].map((alt, i) =>
                `<trkpt lat="45" lon="${10 + i / 100}">${alt === undefined ? '' : `<ele>${alt}</ele>`}</trkpt>`
            ).join('') + '</trkseg></trk></gpx>'
    }));
    await page.goto(`http://127.0.0.1:${server.address().port}/examples/leaflet-elevation.html`);
    await page.waitForFunction(() =>
        typeof controlElevation !== 'undefined' &&
        controlElevation._hotline.getLayers().length > 0 &&
        controlElevation._hotline.getLayers()[0]._map
    );

    const result = await page.evaluate(() => {
        const line = controlElevation._hotline.getLayers()[0];
        const hotline = line._renderer._hotline;
        const data = line.getLatLngs();
        const original = hotline.getRGBForValue;
        const coloredValues = [];
        hotline.getRGBForValue = function(value) {
            coloredValues.push(value);
            return original.call(this, value);
        };
        hotline.min(0).max(20).data([data.map((point, i) => ({ x: i * 10, y: 10, z: point.alt }))]).draw();
        const mixedValues = coloredValues.splice(0);
        hotline.data([[{ x: 0, y: 0 }, { x: 10, y: 10 }]]).draw();
        const missingValues = coloredValues.splice(0);
        const constantColors = [0, 50].map(value => {
            hotline.min(value).max(value);
            hotline.data([[{ x: 0, y: 0, z: value }, { x: 10, y: 10, z: value }]]).draw();
            return hotline.getRGBForValue(value);
        });
        map.panBy([30, 10], { animate: false });
        return { mixedValues, missingValues, constantColors };
    });
    assert.deepStrictEqual(result.mixedValues, [0, 10]);
    assert.deepStrictEqual(result.missingValues, []);
    assert.ok(result.constantColors.flat().every(Number.isFinite));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.deepStrictEqual(errors, []);
});
