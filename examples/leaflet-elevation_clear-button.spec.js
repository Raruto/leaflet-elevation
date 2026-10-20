/**
 * examples/leaflet-elevation_clear-button.html
 */

import assert from 'node:assert/strict';
import { suite } from '../test/setup/http_server.js';

const test = suite('examples/leaflet-elevation_clear-button.html');

test('eledata_clear', async ({ page }) => {

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

    // Count number of events after each step 
    assert.strictEqual(    JSON.stringify(step_1.events), JSON.stringify(step_3.events));
    assert.strictEqual(    JSON.stringify(step_2.events), JSON.stringify(step_4.events));
    assert.notStrictEqual(JSON.stringify(step_1.events), JSON.stringify(step_2.events));
    assert.notStrictEqual(JSON.stringify(step_1.events), JSON.stringify(step_4.events));
    assert.notStrictEqual(JSON.stringify(step_2.events), JSON.stringify(step_3.events));
    assert.notStrictEqual(JSON.stringify(step_3.events), JSON.stringify(step_4.events));

    // Count number of events after clear()
    assert.strictEqual(    JSON.stringify(step_end.events), JSON.stringify(step_1.events)); // NB this is just a coincidence, it could break in the future
    assert.strictEqual(    JSON.stringify(step_end.events), JSON.stringify(step_1.events)); // NB this is just a coincidence, it could break in the future
    assert.notStrictEqual(JSON.stringify(step_end.events), JSON.stringify(step_2.events));
    assert.notStrictEqual(JSON.stringify(step_end.events), JSON.stringify(step_4.events));

});

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
