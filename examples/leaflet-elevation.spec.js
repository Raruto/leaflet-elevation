/**
 * examples/leaflet-elevation.html
 */

import assert from 'node:assert/strict';
import { suite } from '../test/setup/http_server.js';

const test = suite('examples/leaflet-elevation.html');

test('eledata_loaded', async ({ page }) => {
    const gpx = await page.evaluate(() => new Promise(resolve => {
      controlElevation.on('eledata_loaded', (gpx) => resolve(gpx));
    }));
    assert.strictEqual(gpx.name, 'via-emilia.gpx');
    assert.notStrictEqual(typeof gpx.layer, 'undefined');
    assert.strictEqual(typeof gpx.track_info.distance, 'number');
});