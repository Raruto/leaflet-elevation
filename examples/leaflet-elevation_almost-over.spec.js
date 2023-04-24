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
    assert.type(step_1.gpx.track_info.distance, 'number');

    assert.is(step_1.ctrl.options.almostOver, true);
    assert.is(step_1.enabled, true);
    assert.is(step_1.layers.length, 9);

    // [2]: Load "via-aurelia.gpx"
    const step_2 = await load_trace(page, './via-aurelia.gpx');
    assert.is(step_2.gpx.name, 'via-aurelia.gpx');
    assert.not.type(step_2.gpx.layer, 'undefined');
    assert.type(step_2.gpx.track_info.distance, 'number');

    assert.is(step_2.ctrl.options.almostOver, true);
    assert.is(step_2.enabled, true);
    assert.is(step_2.layers.length, 1);

});

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
            enabled: map.almostOver.enabled(),
            layers: map.almostOver._layers
          }));
      });
      ctrl.load(trace_url);
    });
    ctrl.clear();
  }), trace_url);
}