import assert from 'node:assert/strict';
import { Given, Then } from '@cucumber/cucumber';
import { openExample } from '../support/browser.js';

Given('the live-tracking example is ready', async function () {
    await openExample(this, 'live-tracking');
    await this.page.waitForFunction(() => index === locations.length);
});

Then('all GPS locations are shown on one map layer and in the elevation chart', async function () {
    const result = await this.page.evaluate(() => ({
        locations: locations.length,
        mapPoints: trackLayer.getLatLngs().length,
        chartPoints: controlElevation._data.length,
        trackLayers: controlElevation._layers.getLayers().length
    }));

    assert.deepStrictEqual(result, {
        locations: 12,
        mapPoints: 12,
        chartPoints: 12,
        trackLayers: 1
    });
});
