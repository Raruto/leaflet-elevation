import assert from 'node:assert/strict';
import { Given, When, Then } from '@cucumber/cucumber';
import { fixturePath, openExample } from '../support/browser.js';

Given('the {string} example is waiting to load {string}', async function (example, filename) {
    const gate = new Promise(resolve => { this.releaseData = resolve; });
    await this.page.route(`**/${filename}`, async route => {
        await gate;
        await route.fulfill({ path: fixturePath(filename) });
    });
    await openExample(this, example === 'default' ? '' : example);
    await this.page.evaluate(() => {
        window.loadedData = new Promise(resolve => controlElevation.once('eledata_loaded', resolve));
        window.dataEventOrder = [];
        controlElevation.on('eledata_added', () => window.dataEventOrder.push('added'));
        controlElevation.on('eledata_loaded', () => window.dataEventOrder.push('loaded'));
    });
});

When('the track response is released', async function () {
    this.releaseData();
    this.loaded = await this.page.evaluate(() => window.loadedData);
});

Then('the loaded track is named {string} and has a layer and numeric distance', function (filename) {
    assert.strictEqual(this.loaded.name, filename);
    assert.notStrictEqual(typeof this.loaded.layer, 'undefined');
    assert.strictEqual(typeof this.loaded.track_info.distance, 'number');
});

Then('data is added before the loaded event', async function () {
    assert.deepStrictEqual(await this.page.evaluate(() => window.dataEventOrder), ['added', 'loaded']);
});

Then('the start and end markers match the processed track endpoints', async function () {
    assert.deepStrictEqual(await this.page.evaluate(() => [
        controlElevation._start.getLatLng().equals(controlElevation._data[0].latlng),
        controlElevation._end.getLatLng().equals(controlElevation._data.at(-1).latlng)
    ]), [true, true]);
});

Then('the custom summary displays the loaded distance in kilometres', async function () {
    assert.strictEqual(await this.page.locator('.totlen .summaryvalue').textContent(),
        `${this.loaded.track_info.distance.toFixed(2)} km`);
});

Then('the custom summary displays elevation limits, ascent and descent from track statistics', async function () {
    const info = this.loaded.track_info;
    for (const [selector, expected] of [
        ['.maxele', `${info.elevation_max.toFixed(2)} m`],
        ['.minele', `${info.elevation_min.toFixed(2)} m`],
        ['.gain', `+${info.ascent.toFixed(0)} m`],
        ['.loss', `-${info.descent.toFixed(0)} m`]
    ]) {
        assert.strictEqual(await this.page.locator(`${selector} .summaryvalue`).textContent(), expected);
    }
});
Given('the clear-button example has loaded its initial track', async function () {
    await openExample(this, 'clear-button');
    await this.page.waitForFunction(() =>
        typeof controlElevation !== 'undefined' && controlElevation._data.length > 0 &&
        controlElevation._layers.getLayers().length > 0
    );
    await this.page.evaluate(() => {
        window.elevationEvents = [];
        controlElevation.on('eledata_clear', () => window.elevationEvents.push('clear'));
        controlElevation.on('eledata_loaded', ({ name }) => window.elevationEvents.push(`loaded:${name}`));
    });
});

async function replaceTrack(page, index) {
    return page.evaluate(index => new Promise(resolve => {
        window.elevationEvents.length = 0;
        controlElevation.once(index >= 0 ? 'eledata_loaded' : 'eledata_clear', gpx => resolve({
            gpx,
            ctrl: controlElevation,
            events: window.elevationEvents.slice(),
            layers: controlElevation._layers.getLayers(),
            points: d3.selectAll('.point > .point').nodes().length
        }));
        load_track(index);
    }), index);
}

When('I replace the track in this order', async function (table) {
    this.replacements = [];
    for (const row of table.hashes()) {
        this.replacements.push({ expected: row, actual: await replaceTrack(this.page, Number(row.index)) });
    }
});

Then('each replacement clears once before loading its track and expected points', function () {
    for (const { expected, actual } of this.replacements) {
        assert.strictEqual(actual.gpx.name, expected.name);
        assert.notStrictEqual(typeof actual.gpx.layer, 'undefined');
        assert.strictEqual(typeof actual.gpx.track_info.distance, 'number');
        assert.strictEqual(actual.points, Number(expected.points));
        assert.deepStrictEqual(actual.events, ['clear', `loaded:${expected.name}`]);
    }
});

When('I clear the track without loading another', async function () {
    this.cleared = await replaceTrack(this.page, -1);
});

Then('no track layers, statistics or chart points remain', function () {
    assert.strictEqual(this.cleared.layers.length, 0);
    assert.strictEqual(typeof this.cleared.ctrl.track_info.name, 'undefined');
    assert.strictEqual(typeof this.cleared.ctrl.track_info.distance, 'undefined');
    assert.strictEqual(this.cleared.points, 0);
});

Then('only a clear event is emitted', function () {
    assert.deepStrictEqual(this.cleared.events, ['clear']);
});
