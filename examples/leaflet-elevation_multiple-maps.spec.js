/**
 * examples/leaflet-elevation_multiple-maps.html
 */

import * as assert from 'uvu/assert';
import { suite } from '../test/setup/http_server.js';

const test = suite('examples/leaflet-elevation_multiple-maps.html');

test('multiple_maps', async ({ page }) => {
    const charts = await page.evaluate(() => new Promise(resolve => resolve(charts)));
    charts.forEach((chart, idx) => {
        console.log('chart #' + idx);
        assert.snapshot(
            JSON.stringify(chart.options.margins),
            JSON.stringify({ top: 30, right: 70, bottom: 62, left: 40 })
        );
    });
});

test.run();