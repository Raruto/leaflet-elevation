/**
 * examples/leaflet-elevation_clear-button.html
 */

import * as assert from 'uvu/assert';
import { suite } from '../test/setup/http_server.js';

const test = suite('examples/leaflet-elevation_clear-button.html');

test('eledata_clear', async ({ page }) => {
    let gpx, points;

    // Load "demo.geojson"
    ({ gpx, points } = await load_trace(page, 0));
    assert.is(gpx.name, 'demo.geojson');
    assert.not.type(gpx.layer, 'undefined');
    assert.type(gpx.track_info.distance, 'number');
    assert.is(points, 0);

    // Load "waypoints.geojson"
    ({ gpx, points } = await load_trace(page, 1));
    assert.is(gpx.name, 'waypoints.geojson');
    assert.not.type(gpx.layer, 'undefined');
    assert.type(gpx.track_info.distance, 'number');
    assert.is(points, 4);

    // Load "demo.geojson"
    ({ gpx, points } = await load_trace(page, 0));
    assert.is(gpx.name, 'demo.geojson');
    assert.not.type(gpx.layer, 'undefined');
    assert.type(gpx.track_info.distance, 'number');
    assert.is(points, 0);

    // Load "waypoints.geojson"
    ({ gpx, points } = await load_trace(page, 1));
    assert.is(gpx.name, 'waypoints.geojson');
    assert.not.type(gpx.layer, 'undefined');
    assert.type(gpx.track_info.distance, 'number');
    assert.is(points, 4);

    // Clear all
    const { ctrl, layers, wpts } = await page.evaluate(() => new Promise(resolve => {
      controlElevation.once('eledata_clear', () => resolve({
        ctrl: controlElevation,
        layers: controlElevation._layers.getLayers(),
        wpts: d3.selectAll('.point > .point').nodes().length,
      }));
      load_track(-1);
    }));
    assert.is(layers.length, 0);
    assert.type(ctrl.track_info.name, 'undefined');
    assert.type(ctrl.track_info.distance, 'undefined');
    assert.is(wpts, 0);
});

test.run();

async function load_trace(page, trace_id) {
  return await page.evaluate((trace_id) => new Promise(resolve => {
    controlElevation.once('eledata_loaded', (gpx) => resolve({gpx, points: d3.selectAll('.point > .point').nodes().length }));
    load_track(trace_id);
  }), trace_id);
}
