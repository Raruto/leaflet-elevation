/**
 * examples/leaflet-elevation_multiple-maps.html
 */

import * as assert from 'uvu/assert';
import { suite } from '../test/setup/http_server.js';

const test = suite('examples/leaflet-elevation_multiple-maps.html');

test('multiple_maps', async ({ page }) => {
    const default_margins = await page.evaluate(() => new Promise(resolve => {
        resolve(L.Control.Elevation.prototype.options.margins);
    }));
    assert.snapshot(
        JSON.stringify(default_margins),
        JSON.stringify({ top: 30, right: 30, bottom: 30, left: 40 })
    );
});

test.run();