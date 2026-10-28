import assert from 'node:assert/strict';
import { Given, When, Then } from '@cucumber/cucumber';
import { fixturePath, openExample } from '../support/browser.js';

Given('the GPX upload example is ready', async function () {
    await this.page.route('**/leaflet-filelayer@*/**', route => route.abort());
    this.page.on('console', message => {
        if (message.type() === 'error') this.errors.push(message.text());
        if (message.type() === 'warning') this.warnings.push(message.text());
    });
    await openExample(this, 'upload-gpx');
});

Then('invalid, unsupported and oversized uploads are reported without clearing the track', async function () {
    const original = await this.page.evaluate(() => ({
        points: controlElevation._data.length,
        markers: controlElevation._markers.getLayers().length
    }));
    for (const [name, content, message] of [
        ['invalid.gpx', '<gpx><trk>', 'The selected file is not valid GPX.'],
        ['empty.gpx', '<gpx/>', 'The GPX file contains no tracks or routes.'],
        ['track.txt', '<gpx/>', 'Please select a GPX file.'],
        ['large.gpx', ' '.repeat(10 * 1024 * 1024 + 1), 'The GPX file must not exceed 10 MiB.']
    ]) {
        await this.page.locator('input[type="file"]').setInputFiles({
            name, mimeType: 'application/gpx+xml', buffer: Buffer.from(content)
        });
        await this.page.getByRole('alert').filter({ hasText: message }).waitFor();
        assert.deepStrictEqual(await this.page.evaluate(() => ({
            points: controlElevation._data.length,
            markers: controlElevation._markers.getLayers().length
        })), original);
        assert.strictEqual(await this.page.locator('input[type="file"]').inputValue(), '');
        assert.strictEqual(await this.page.getByRole('button', { name: 'Load local GPX file' }).isEnabled(), true);
    }
    assert.strictEqual(this.errors.length, 4);
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

Then('no browser errors or unexpected warnings have occurred during uploads', function () {
    assert.deepStrictEqual(this.errors, []);
    assert.deepStrictEqual(this.warnings, process.env.LEAFLET_VERSION === '2'
        ? ['Map: touchZoom option is deprecated and will be removed in future versions. Use pinchZoom instead.']
        : []);
});
