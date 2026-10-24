import assert from 'node:assert/strict';
import { Given, When, Then } from '@cucumber/cucumber';
import { localFixture, openExample } from '../support/browser.js';

Given('the almost-over example has loaded its initial track', async function () {
    await openExample(this, 'almost-over');
    await this.page.waitForFunction(() =>
        typeof controlElevation !== 'undefined' && controlElevation._data.length > 0 &&
        map.almostOver && map.almostOver._layers.length > 0
    );
});

When('I reload the almost-over tracks in this order', async function (table) {
    this.tracks = [];
    for (const row of table.hashes()) {
        const actual = await this.page.evaluate(filename => new Promise(resolve => {
            const ctrl = controlElevation;
            ctrl.once('eledata_clear', () => {
                ctrl.once('eledata_loaded', gpx => {
                    ctrl._initAlmostOverHandler(map, gpx.layer).then(() => resolve({
                        gpx,
                        moveEvents: map._events['almost:move'].length,
                        outEvents: map._events['almost:out'].length,
                        enabled: map.almostOver.enabled(),
                        option: ctrl.options.almostOver,
                        layers: map.almostOver._layers.length,
                        data: ctrl._data
                    }));
                });
                ctrl.load(`./${filename}`);
            });
            ctrl.clear();
        }), row.filename);
        this.tracks.push({ expected: row, actual });
    }
});

Then('each track has the expected statistics and almost-over layers', function () {
    for (const { expected, actual } of this.tracks) {
        assert.strictEqual(actual.gpx.name, expected.filename);
        assert.notStrictEqual(typeof actual.gpx.layer, 'undefined');
        assert.deepStrictEqual(actual.gpx.track_info, {
            name: expected.filename,
            distance: Number(expected.distance),
            time: Number(expected.time),
            elevation_max: Number(expected.maximum),
            elevation_min: Number(expected.minimum),
            elevation_avg: Number(expected.average)
        });
        assert.strictEqual(actual.layers, Number(expected.layers));
    }
    assert.deepStrictEqual(this.tracks[0].actual.gpx.track_info, this.tracks[2].actual.gpx.track_info);
});

Then('almost-over stays enabled with exactly one move and one out listener', function () {
    for (const { actual } of this.tracks) {
        assert.strictEqual(actual.enabled, true);
        assert.strictEqual(actual.option, true);
        assert.strictEqual(actual.moveEvents, 1);
        assert.strictEqual(actual.outEvents, 1);
    }
});

Then('all known sea-level samples in via-aurelia retain zero elevation', function () {
    const track = this.tracks.find(({ expected }) => expected.filename === 'via-aurelia.gpx').actual;
    for (const index of [1029, 1030, 2048, 3747, 3843, 3845, 3891, 3965, 3966, 4057, 4058, 4072, 4262, 4263, 4264, 4269, 11284]) {
        assert.strictEqual(track.data[index].z, 0);
    }
});

Given('the bathymetry example has loaded its track', async function () {
    await openExample(this, 'bathymetry');
    await this.page.waitForFunction(() => typeof controlElevation !== 'undefined' && controlElevation._data.length > 0);
});

When('I display the map marker for every underwater sample', async function () {
    this.markers = await this.page.evaluate(() => controlElevation._data.map(item => {
        controlElevation._updateMarker(item);
        const line = document.querySelector('.height-focus.line');
        const label = document.querySelector('.height-focus-label');
        return {
            height: (+line.getAttribute('y1') - +line.getAttribute('y2')) / controlElevation._height(),
            elevation: item.z,
            label: label.textContent,
            labelY: +label.getAttribute('y'),
            lineY: +line.getAttribute('y2')
        };
    }));
});

Then('all {int} markers have finite heights within the chart and aligned elevation labels', function (count) {
    assert.strictEqual(this.markers.length, count);
    for (const marker of this.markers) {
        assert.ok(Number.isFinite(marker.height));
        assert.ok(marker.height >= 0 && marker.height <= 1);
        assert.ok(marker.label.includes(String(marker.elevation)));
        assert.strictEqual(marker.labelY, marker.lineY);
    }
});

Then('their heights increase monotonically from the chart minimum to maximum', function () {
    const sorted = this.markers.slice().sort((a, b) => a.elevation - b.elevation);
    assert.strictEqual(sorted[0].height, 0);
    assert.ok(Math.abs(sorted.at(-1).height - 1) < 1e-8);
    sorted.slice(1).forEach((marker, i) => assert.ok(marker.height >= sorted[i].height - 1e-8));
});

When('I open the edge-scale example', async function () {
    await openExample(this, 'edge-scale');
    await this.page.waitForFunction(() => typeof map !== 'undefined' && typeof map.edgeScaleControl !== 'undefined');
});

Then('the edge scale control is initialized with its bar, icon and coordinates enabled', async function () {
    const state = await this.page.evaluate(() => ({
        initialized: typeof map.edgeScaleControl !== 'undefined',
        options: controlElevation.options.edgeScale
    }));
    assert.strictEqual(state.initialized, true);
    assert.strictEqual(state.options.bar, true);
    assert.strictEqual(state.options.icon, true);
    assert.strictEqual(state.options.coords, true);
});

When('I open the multiple-maps example', async function () {
    await openExample(this, 'multiple-maps');
});

Then('every chart keeps its legend and the shared default margins stay unchanged', async function () {
    const state = await this.page.evaluate(() => ({
        legends: charts.map(chart => chart.options.legend),
        margins: L.Control.Elevation.prototype.options.margins
    }));
    state.legends.forEach(legend => assert.strictEqual(legend, true));
    assert.deepStrictEqual(state.margins, { top: 30, right: 30, bottom: 30, left: 40 });
});

Given('the GeoJSON group example has an attached chart', async function () {
    for (const filename of ['demo.geojson', 'waypoints.geojson']) await localFixture(this.page, filename);
    await openExample(this, 'geojson-group');
    await this.page.locator('.elevation-control .brush .overlay').waitFor();
    await this.page.mouse.move(0, 0);
    await this.page.evaluate(() => {
        window.mapMouseMoves = 0;
        window.chartMouseMoves = 0;
        document.querySelector('.leaflet-map').addEventListener('mousemove', () => window.mapMouseMoves++);
        document.querySelector('.elevation-control .brush .overlay').addEventListener('mousemove', () => window.chartMouseMoves++);
    });
});

When('I move the pointer into the chart overlay', async function () {
    const bounds = await this.page.locator('.elevation-control .brush .overlay').boundingBox();
    assert.ok(bounds && bounds.width > 0 && bounds.height > 0);
    await this.page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
});

Then('the chart receives the mouse movement but the map does not', async function () {
    assert.ok(await this.page.evaluate(() => window.chartMouseMoves > 0));
    assert.strictEqual(await this.page.evaluate(() => window.mapMouseMoves), 0);
});
