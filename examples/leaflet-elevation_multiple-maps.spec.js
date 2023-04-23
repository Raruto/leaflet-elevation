/**
 * examples/leaflet-elevation_multiple-maps.html
 */

import * as assert from 'uvu/assert';
import { suite } from '../test/setup/http_server.js';

const test = suite('examples/leaflet-elevation_multiple-maps.html');

/**
 * @see https://github.com/Raruto/leaflet-elevation/issues/238#issuecomment-1493717835
 * @see https://github.com/Raruto/leaflet-elevation/issues/238#issuecomment-1493826767
 */
test('multiple-maps', async ({ page }) => {
    const { charts, default_margins } = await page.evaluate(() => new Promise(resolve => {
        resolve({ charts, default_margins: L.Control.Elevation.prototype.options.margins });
    }));
    charts.forEach(chart => { assert.is(chart.options.legend, true); });
    assert.snapshot(
        JSON.stringify(default_margins),
        JSON.stringify({ top: 30, right: 30, bottom: 30, left: 40 })
    );
});

test.run();