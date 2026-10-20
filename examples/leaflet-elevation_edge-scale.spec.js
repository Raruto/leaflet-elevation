/**
 * examples/leaflet-elevation_edge-scale.html
 */

import assert from 'node:assert/strict';
import { suite } from '../test/browser.js';

const test = suite('examples/leaflet-elevation_edge-scale.html');

test('edge-scale', async ({ page }) => {
    await page.waitForFunction(() =>
        typeof map !== 'undefined' && typeof map.edgeScaleControl !== 'undefined'
    );
    const { map, controlElevation } = await page.evaluate(() => ({ map, controlElevation }));
    assert.notStrictEqual(typeof map.edgeScaleControl, 'undefined');
    assert.strictEqual(controlElevation.options.edgeScale.bar, true);
    assert.strictEqual(controlElevation.options.edgeScale.icon, true);
    assert.strictEqual(controlElevation.options.edgeScale.coords, true);
});