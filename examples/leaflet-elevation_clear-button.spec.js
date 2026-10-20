/**
 * examples/leaflet-elevation_clear-button.html
 */

import assert from 'node:assert/strict';
import { it } from 'node:test';
import { chromium } from 'playwright';
import { startServer } from '../build/server.js';

it('eledata_clear', { timeout: 10000 }, async t => {
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
    await page.goto(`http://127.0.0.1:${server.address().port}/examples/leaflet-elevation_clear-button.html`);
    // Exclude the example's initial load from the event sequence under test.
    await page.waitForFunction(() =>
        typeof controlElevation !== 'undefined' &&
        controlElevation._data.length > 0 &&
        controlElevation._layers.getLayers().length > 0
    );
    await page.evaluate(() => {
        window.elevationEvents = [];
        controlElevation.on('eledata_clear', () => window.elevationEvents.push('clear'));
        controlElevation.on('eledata_loaded', ({ name }) => window.elevationEvents.push(`loaded:${name}`));
    });

    // [1]: Load "demo.geojson"
    const step_1 = await load_trace(page, 0);
    assert.strictEqual(step_1.gpx.name, 'demo.geojson');
    assert.notStrictEqual(typeof step_1.gpx.layer, 'undefined');
    assert.strictEqual(typeof step_1.gpx.track_info.distance, 'number');
    assert.strictEqual(step_1.points, 0);

    // [2]: Load "waypoints.geojson"
    const step_2 = await load_trace(page, 1);
    assert.strictEqual(step_2.gpx.name, 'waypoints.geojson');
    assert.notStrictEqual(typeof step_2.gpx.layer, 'undefined');
    assert.strictEqual(typeof step_2.gpx.track_info.distance, 'number');
    assert.strictEqual(step_2.points, 4);

    // [3]: Load "demo.geojson"
    const step_3 = await load_trace(page, 0);
    assert.strictEqual(step_3.gpx.name, 'demo.geojson');
    assert.notStrictEqual(typeof step_3.gpx.layer, 'undefined');
    assert.strictEqual(typeof step_3.gpx.track_info.distance, 'number');
    assert.strictEqual(step_3.points, 0);

    // [4]: Load "waypoints.geojson"
    const step_4 = await load_trace(page, 1);
    assert.strictEqual(step_4.gpx.name, 'waypoints.geojson');
    assert.notStrictEqual(typeof step_4.gpx.layer, 'undefined');
    assert.strictEqual(typeof step_4.gpx.track_info.distance, 'number');
    assert.strictEqual(step_4.points, 4);

    // [5]: Clear all
    const step_end = await load_trace(page, -1);
    assert.strictEqual(step_end.layers.length, 0);
    assert.strictEqual(typeof step_end.ctrl.track_info.name, 'undefined');
    assert.strictEqual(typeof step_end.ctrl.track_info.distance, 'undefined');
    assert.strictEqual(step_end.points, 0);

    // Each replacement must clear once before loading; clearing alone must not load data.
    assert.deepStrictEqual(step_1.events, ['clear', 'loaded:demo.geojson']);
    assert.deepStrictEqual(step_2.events, ['clear', 'loaded:waypoints.geojson']);
    assert.deepStrictEqual(step_3.events, ['clear', 'loaded:demo.geojson']);
    assert.deepStrictEqual(step_4.events, ['clear', 'loaded:waypoints.geojson']);
    assert.deepStrictEqual(step_end.events, ['clear']);

});

async function load_trace(page, trace_id) {
  return await page.evaluate((trace_id) => new Promise(resolve => {
    window.elevationEvents.length = 0;
    // A negative index clears without loading, so it completes on a different event.
    controlElevation.once(trace_id >=0 ? 'eledata_loaded' : 'eledata_clear', (gpx) => resolve({
      gpx,
      ctrl: controlElevation,
      events: window.elevationEvents.slice(),
      layers: controlElevation._layers.getLayers(),
      points: d3.selectAll('.point > .point').nodes().length
    }));
    load_track(trace_id);
  }), trace_id);
}
