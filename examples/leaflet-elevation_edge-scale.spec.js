/**
 * examples/leaflet-elevation_edge-scale.html
 */

import * as assert from 'uvu/assert';
import { suite } from '../test/setup/http_server.js';

const test = suite('examples/leaflet-elevation_edge-scale.html');

test('edge-scale', async ({ page }) => {
    const { map, controlElevation } = await page.evaluate(() => new Promise(resolve => {
        resolve({ map, controlElevation });
    }));
    assert.not.type(map.edgeScaleControl, 'undefined');
    assert.is(controlElevation.options.edgeScale.bar, true);
    assert.is(controlElevation.options.edgeScale.icon, true);
    assert.is(controlElevation.options.edgeScale.coords, true);
});

test.run();