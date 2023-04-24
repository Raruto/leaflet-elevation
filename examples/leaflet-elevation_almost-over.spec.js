/**
 * examples/leaflet-elevation_almost-over.html
 */

import * as assert from 'uvu/assert';
import { suite } from '../test/setup/http_server.js';

const test = suite('examples/leaflet-elevation_almost-over.html');

test('almostOver', async ({ page }) => {

    // [1]: Load "via-emilia.gpx"
    const step_1 = await load_trace(page, './via-emilia.gpx');
    assert.is(step_1.gpx.name, 'via-emilia.gpx');
    assert.not.type(step_1.gpx.layer, 'undefined');
    assert.snapshot(
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
    assert.is(step_2.gpx.name, 'via-aurelia.gpx');
    assert.not.type(step_2.gpx.layer, 'undefined');
    assert.snapshot(
      JSON.stringify(step_2.gpx.track_info),
      JSON.stringify({
        name: 'via-aurelia.gpx',
        distance: 695.46454,
        time: 695464540,
        elevation_max: 638.8,
        elevation_min: -3,
        elevation_avg: 61.51005418195878
      })
    );

    // [3]: Load "via-emilia.gpx"
    const step_3 = await load_trace(page, './via-emilia.gpx');
    assert.is(step_3.gpx.name, 'via-emilia.gpx');
    assert.not.type(step_3.gpx.layer, 'undefined');
    assert.snapshot(
      JSON.stringify(step_3.gpx.track_info),
      JSON.stringify(step_1.gpx.track_info)
    );

    // Check for almostOver handler
    assert.is(step_1.enabled, true);
    assert.is(step_2.enabled, true);
    assert.is(step_3.enabled, true);
    assert.is(step_1.option, true);
    assert.is(step_2.option, true);
    assert.is(step_3.option, true);

    // Count number of events
    assert.is(step_1.almost_move_events, 1);
    assert.is(step_2.almost_move_events, 1);
    assert.is(step_3.almost_move_events, 1);
    assert.is(step_1.almost_out_events, 1);
    assert.is(step_2.almost_out_events, 1);
    assert.is(step_3.almost_out_events, 1);

    // Count number of layers
    assert.equal(step_1.over_layers, 9);
    assert.equal(step_2.over_layers, 1);
    assert.equal(step_3.over_layers, 9);

}, 15000);

test.run();

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
          }));
      });
      ctrl.load(trace_url);
    });
    ctrl.clear();
  }), trace_url);
}