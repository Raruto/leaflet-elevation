import assert from 'node:assert/strict';
import { Given, When, Then } from '@cucumber/cucumber';
import { fixturePath, openExample } from '../support/browser.js';

Given('the GPX upload example is ready', async function () {
    this.page.on('console', message => {
        if (['warning', 'error'].includes(message.type())) this.errors.push(message.text());
    });
    await openExample(this, 'upload-gpx');
});

When('I upload {string}', async function (filename) {
    await this.page.evaluate(() => {
        window.uploadedData = new Promise(resolve => controlElevation.once('eledata_loaded', () => resolve()));
    });
    await this.page.locator('input[type="file"]').setInputFiles(fixturePath(filename));
    await this.page.evaluate(() => window.uploadedData);
    await this.page.waitForFunction(() => controlElevation._chart && controlElevation._data.length > 0);
    await this.page.waitForFunction(() => controlElevation._markers.getLayers().every(marker => map.hasLayer(marker)));
    this.upload = await this.page.evaluate(() => ({
        markers: controlElevation._markers.getLayers().map(marker => ({
            visible: map.hasLayer(marker),
            label: marker.getTooltip()?.getContent()
        })),
        visibleMarkers: Object.values(map._layers).filter(layer => layer instanceof L.Marker).length,
        points: controlElevation._container.querySelectorAll('.point > .point').length,
        distance: controlElevation.track_info.distance
    }));
});

Then('the track has {int} visible labelled waypoint markers and chart checkpoints', function (count) {
    assert.strictEqual(this.upload.markers.length, count);
    assert.strictEqual(this.upload.visibleMarkers, count);
    assert.strictEqual(this.upload.points, count);
    assert.ok(this.upload.markers.every(marker => marker.visible && marker.label));
});

Then('the uploaded track has a positive distance', function () {
    assert.ok(this.upload.distance > 0);
});

Then('no browser errors or warnings have occurred during uploads', function () {
    assert.deepStrictEqual(this.errors, []);
});
