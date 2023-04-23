/**
 * examples/leaflet-elevation.html
 */

import * as assert from 'uvu/assert';
import { suite } from '../test/setup/http_server.js';

const test = suite('examples/leaflet-elevation.html');

test('eledata_loaded', async ({ page }) => {
    const gpx = await page.evaluate(() => new Promise(resolve => {
      controlElevation.on('eledata_loaded', (gpx) => resolve(gpx));
    }));
    assert.is(gpx.name, 'via-emilia.gpx');
    assert.not.type(gpx.layer, 'undefined');
    assert.type(gpx.track_info.distance, 'number');
});

test.run();