/**
 * examples/leaflet-elevation_multiple-maps.html
 */

import { suite } from 'uvu';
import * as assert from 'uvu/assert';
import { setup, reset } from '../test/setup/http_server.js';

const test = suite('examples/leaflet-elevation_multiple-maps.html');

test.before.each(setup);
test.after.each(reset);

test('multiple_maps', async ({ localhost, page }) => {
    await page.goto(localhost + '/examples/leaflet-elevation_multiple-maps.html');
    const charts = await page.evaluate(() => new Promise(resolve => {
        resolve(charts)
    }));
    charts.forEach((chart) => {
        assert.snapshot(
            JSON.stringify(chart.options.margins),
            JSON.stringify({ top: 30, right: 70, bottom: 90, left: 40 })
        );
    });
});

test.run();