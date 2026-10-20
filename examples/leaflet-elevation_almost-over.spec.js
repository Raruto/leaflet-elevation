/**
 * examples/leaflet-elevation_almost-over.html
 */

import assert from 'node:assert/strict';
import { it } from 'node:test';
import { chromium } from 'playwright';
import { startServer } from '../build/server.js';

it('almostOver', { timeout: 60000 }, async t => {
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
    await page.goto(`http://127.0.0.1:${server.address().port}/examples/leaflet-elevation_almost-over.html`);
    // Finish the example's initial load before starting the clear/reload sequence.
    await page.waitForFunction(() =>
      typeof controlElevation !== 'undefined' &&
      controlElevation._data.length > 0 &&
      map.almostOver &&
      map.almostOver._layers.length > 0
    );

    // [1]: Load "via-emilia.gpx"
    const step_1 = await load_trace(page, './via-emilia.gpx');
    assert.strictEqual(step_1.gpx.name, 'via-emilia.gpx');
    assert.notStrictEqual(typeof step_1.gpx.layer, 'undefined');
    assert.strictEqual(
      JSON.stringify(step_1.gpx.track_info),
      JSON.stringify({
        name: 'via-emilia.gpx',
        distance: 264.69343,
        time: 264693430,
        elevation_max: 84.9,
        elevation_min: 6.6,
        elevation_avg: 49.10552825552806
      })
    );

    // [2]: Load "via-aurelia.gpx"
    const step_2 = await load_trace(page, './via-aurelia.gpx');
    assert.strictEqual(step_2.gpx.name, 'via-aurelia.gpx');
    assert.notStrictEqual(typeof step_2.gpx.layer, 'undefined');
    assert.strictEqual(
      JSON.stringify(step_2.gpx.track_info),
      JSON.stringify({
        name: 'via-aurelia.gpx',
        distance: 695.46454,
        time: 695464540,
        elevation_max: 638.8,
        elevation_min: -3,
        elevation_avg: 61.47714913485336
      })
    );

    // [3]: Load "via-emilia.gpx"
    const step_3 = await load_trace(page, './via-emilia.gpx');
    assert.strictEqual(step_3.gpx.name, 'via-emilia.gpx');
    assert.notStrictEqual(typeof step_3.gpx.layer, 'undefined');
    assert.strictEqual(
      JSON.stringify(step_3.gpx.track_info),
      JSON.stringify(step_1.gpx.track_info)
    );

    // Check for almostOver handler
    assert.strictEqual(step_1.enabled, true);
    assert.strictEqual(step_2.enabled, true);
    assert.strictEqual(step_3.enabled, true);
    assert.strictEqual(step_1.option, true);
    assert.strictEqual(step_2.option, true);
    assert.strictEqual(step_3.option, true);

    // Count number of events
    assert.strictEqual(step_1.almost_move_events, 1);
    assert.strictEqual(step_2.almost_move_events, 1);
    assert.strictEqual(step_3.almost_move_events, 1);
    assert.strictEqual(step_1.almost_out_events, 1);
    assert.strictEqual(step_2.almost_out_events, 1);
    assert.strictEqual(step_3.almost_out_events, 1);

    // Count number of layers
    assert.strictEqual(step_1.over_layers, 9);
    assert.strictEqual(step_2.over_layers, 1);
    assert.strictEqual(step_3.over_layers, 9);

    /**
     * List of points where altitude == 0
     * 
     * <ele>0</ele> values shouldn't be interpreted as an empty ("false" or "undefined") value.
     * 
     * @see https://github.com/Raruto/leaflet-elevation/issues/259
     */
    [1029, 1030, 2048, 3747, 3843, 3845, 3891, 3965, 3966, 4057, 4058, 4072, 4262, 4263, 4264, 4269, 11284].forEach(idx => {
      assert.strictEqual(step_2.data[idx].z, 0);
    });

});

async function load_trace(page, trace_url) {
  return await page.evaluate((trace_url) => new Promise(resolve => {
    const ctrl = controlElevation;
    ctrl.once('eledata_clear', () => {
      ctrl.once('eledata_loaded', (gpx) => {
        ctrl._initAlmostOverHandler(map, gpx.layer)
          .then((e) => resolve({
            ctrl,
            gpx,
            almost_move_events: map._events['almost:move'].length,
            almost_out_events: map._events['almost:out'].length,
            enabled: map.almostOver.enabled(),
            option: ctrl.options.almostOver,
            over_layers: map.almostOver._layers.length,
            map_layers: Object.keys(map._layers).length,
            data: ctrl._data,
          }));
      });
      ctrl.load(trace_url);
    });
    ctrl.clear();
  }), trace_url);
}