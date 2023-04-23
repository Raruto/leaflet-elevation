/**
 * examples/leaflet-elevation_clear-button.html
 */

import * as assert from 'uvu/assert';
import { suite } from '../test/setup/http_server.js';

const test = suite('examples/leaflet-elevation_clear-button.html');

test('eledata_loaded', async ({ page }) => {
    let gpx;

    gpx = await page.evaluate(() => new Promise(resolve => {
      load_track(0);
      controlElevation.on('eledata_loaded', (gpx) => resolve(gpx));
    }));
    assert.is(gpx.name, 'demo.geojson');
    assert.not.type(gpx.layer, 'undefined');
    assert.type(gpx.track_info.distance, 'number');

    gpx = await page.evaluate(() => new Promise(resolve => {
      load_track(1);
      controlElevation.on('eledata_loaded', (gpx) => resolve(gpx));
    }));
    assert.is(gpx.name, 'waypoints.geojson');
    assert.not.type(gpx.layer, 'undefined');
    assert.type(gpx.track_info.distance, 'number');
});

test.run();