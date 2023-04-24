/**
 * examples/leaflet-elevation_clear-button.html
 */

import * as assert from 'uvu/assert';
import { suite } from '../test/setup/http_server.js';

const test = suite('examples/leaflet-elevation_clear-button.html');

test('eledata_clear', async ({ page }) => {

    // [1]: Load "demo.geojson"
    const step_1 = await load_trace(page, 0);
    assert.is(step_1.gpx.name, 'demo.geojson');
    assert.not.type(step_1.gpx.layer, 'undefined');
    assert.type(step_1.gpx.track_info.distance, 'number');
    assert.is(step_1.points, 0);

    // [2]: Load "waypoints.geojson"
    const step_2 = await load_trace(page, 1);
    assert.is(step_2.gpx.name, 'waypoints.geojson');
    assert.not.type(step_2.gpx.layer, 'undefined');
    assert.type(step_2.gpx.track_info.distance, 'number');
    assert.is(step_2.points, 4);

    // [3]: Load "demo.geojson"
    const step_3 = await load_trace(page, 0);
    assert.is(step_3.gpx.name, 'demo.geojson');
    assert.not.type(step_3.gpx.layer, 'undefined');
    assert.type(step_3.gpx.track_info.distance, 'number');
    assert.is(step_3.points, 0);

    // [4]: Load "waypoints.geojson"
    const step_4 = await load_trace(page, 1);
    assert.is(step_4.gpx.name, 'waypoints.geojson');
    assert.not.type(step_4.gpx.layer, 'undefined');
    assert.type(step_4.gpx.track_info.distance, 'number');
    assert.is(step_4.points, 4);

    // [5]: Clear all
    const step_end = await load_trace(page, -1);
    assert.is(step_end.layers.length, 0);
    assert.type(step_end.ctrl.track_info.name, 'undefined');
    assert.type(step_end.ctrl.track_info.distance, 'undefined');
    assert.is(step_end.points, 0);

    // Count number of events after each step 
    assert.snapshot(    JSON.stringify(step_1.events), JSON.stringify(step_3.events));
    assert.snapshot(    JSON.stringify(step_2.events), JSON.stringify(step_4.events));
    assert.not.snapshot(JSON.stringify(step_1.events), JSON.stringify(step_2.events));
    assert.not.snapshot(JSON.stringify(step_1.events), JSON.stringify(step_4.events));
    assert.not.snapshot(JSON.stringify(step_2.events), JSON.stringify(step_3.events));
    assert.not.snapshot(JSON.stringify(step_3.events), JSON.stringify(step_4.events));

    // Count number of events after clear()
    assert.snapshot(    JSON.stringify(step_end.events), JSON.stringify(step_1.events)); // NB this is just a coincidence, it could break in the future
    assert.snapshot(    JSON.stringify(step_end.events), JSON.stringify(step_1.events)); // NB this is just a coincidence, it could break in the future
    assert.not.snapshot(JSON.stringify(step_end.events), JSON.stringify(step_2.events));
    assert.not.snapshot(JSON.stringify(step_end.events), JSON.stringify(step_4.events));

}, 10000);

test.run();

async function load_trace(page, trace_id) {
  return await page.evaluate((trace_id) => new Promise(resolve => {
    controlElevation.once(trace_id >=0 ? 'eledata_loaded' : 'eledata_clear', (gpx) => resolve({
      gpx,
      ctrl: controlElevation,
      events: controlElevation._events,
      layers: controlElevation._layers.getLayers(),
      points: d3.selectAll('.point > .point').nodes().length
    }));
    load_track(trace_id);
  }), trace_id);
}
