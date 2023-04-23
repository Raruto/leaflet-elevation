/**
 * examples/leaflet-elevation_clear-button.html
 */

import * as assert from 'uvu/assert';
import { suite } from '../test/setup/http_server.js';

const test = suite('examples/leaflet-elevation_clear-button.html');

test('eledata_clear', async ({ page }) => {
    let gpx;

    // Load "demo.geojson"
    gpx = await page.evaluate(() => new Promise(resolve => {
      controlElevation.once('eledata_loaded', (gpx) => resolve(gpx));
      load_track(0);
    }));
    assert.is(gpx.name, 'demo.geojson');
    assert.not.type(gpx.layer, 'undefined');
    assert.type(gpx.track_info.distance, 'number');

    // Load "waypoints.geojson"
    gpx = await page.evaluate(() => new Promise(resolve => {
      controlElevation.once('eledata_loaded', (gpx) => resolve(gpx));
      load_track(1);
    }));
    assert.is(gpx.name, 'waypoints.geojson');
    assert.not.type(gpx.layer, 'undefined');
    assert.type(gpx.track_info.distance, 'number');

    // Clear all
    const { ctrl, layers} = await page.evaluate(() => new Promise(resolve => {
      controlElevation.once('eledata_clear', () => resolve({
        ctrl: controlElevation,
        layers: controlElevation._layers.getLayers()
      }));
      load_track(-1);
    }));
    assert.is(layers.length, 0);
    assert.type(ctrl.track_info.name, 'undefined');
    assert.type(ctrl.track_info.distance, 'undefined');
});

test.run();