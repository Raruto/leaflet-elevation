/**
 * examples/leaflet-elevation.html
 */

import { suite } from 'uvu';
import * as assert from 'uvu/assert';
import { setup, reset } from '../test/setup/http_server.js';

const test = suite('examples/leaflet-elevation.html');

test.before.each(setup);
test.after.each(reset);

test('eledata_loaded', async ({ localhost, page }) => {
    await page.goto(localhost + '/examples/leaflet-elevation.html');
    const gpx = await page.evaluate(() => new Promise(resolve => {
      controlElevation.on('eledata_loaded', (gpx) => resolve(gpx));
    }));
    assert.is(gpx.name, 'via-emilia.gpx');
    assert.not.type(gpx.layer, 'undefined');
    assert.type(gpx.track_info.distance, 'number');
});

test.run();