/**
 * examples/leaflet-elevation_edge-scale.html
 */

import * as assert from 'uvu/assert';
import { suite } from '../test/setup/http_server.js';

const test = suite('examples/leaflet-elevation_edge-scale.html');

test('multiple_maps', async ({ page }) => {
    const map = await page.evaluate(() => new Promise(resolve => {
        resolve(map);
    }));
    assert.not.type(map.edgeScaleControl, 'undefined');
});

test.run();