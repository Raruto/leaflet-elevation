import assert from 'node:assert/strict';
import { Given, When, Then } from '@cucumber/cucumber';
import { localFixture, openExample } from '../support/browser.js';

Given('the chart is ready but its marker module is still loading', async function () {
    const gate = new Promise(resolve => { this.releaseData = resolve; });
    await this.page.route('**/src/components/marker.js', async route => {
        await gate;
        await route.continue();
    });
    await localFixture(this.page, 'via-emilia.gpx');
    await openExample(this, '');
    await this.page.waitForFunction(() =>
        typeof controlElevation !== 'undefined' && controlElevation._chart
    );
    assert.strictEqual(await this.page.evaluate(() => typeof controlElevation._marker), 'undefined');
});

When('the map emits zoom and view reset events', async function () {
    await this.page.evaluate(() => {
        for (const type of ['zoom', 'viewreset', 'zoomanim']) {
            map.fire(type, { center: map.getCenter(), zoom: map.getZoom() });
        }
    });
});

Then('the marker finishes loading and can still be hidden', async function () {
    this.releaseData();
    await this.page.waitForFunction(() => controlElevation._marker && controlElevation._data.length > 0);
    assert.strictEqual(await this.page.evaluate(() => {
        controlElevation._updateMarker(controlElevation._data[0]);
        controlElevation._hideMarker();
        return document.querySelector('.height-focus-group').classList.contains('leaflet-hidden');
    }), true);
});

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
    for (const filename of ['demo.geojson', 'waypoints.geojson']) await localFixture(this.page, filename);
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
    for (const filename of ['via-emilia.gpx', 'via-aurelia.gpx', 'demo.tcx']) await localFixture(this.page, filename);
    await openExample(this, 'multiple-maps');
    await this.page.waitForFunction(() =>
        typeof charts !== 'undefined' && charts.length === 3 &&
        charts.every(chart => chart._chart && chart._data.length > 0 && chart._layers.getLayers().length > 0)
    );
});

Then('every chart keeps its legend and the shared default margins stay unchanged', async function () {
    const state = await this.page.evaluate(() => ({
        legends: charts.map(chart => chart.options.legend),
        margins: L.Control.Elevation.prototype.options.margins
    }));
    state.legends.forEach(legend => assert.strictEqual(legend, true));
    assert.deepStrictEqual(state.margins, { top: 30, right: 30, bottom: 30, left: 40 });
});

When('I run the edge-scale example replacement button through all cycles', async function () {
    await this.page.waitForFunction(() => controlElevation._data.length > 0);
    await this.page.evaluate(() => {
        window.edgeLoads = [];
        controlElevation.on('eledata_loaded', () => window.edgeLoads.push(controlElevation._markers.getLayers().length));
    });
    await this.page.locator('#toggleButton').click();
    assert.strictEqual(await this.page.locator('#toggleButton').isDisabled(), true);
    await this.page.waitForFunction(() => !document.querySelector('#toggleButton').disabled && window.edgeLoads.length === 11);
});

Then('the edge scale stays rendered and only the final track waypoints remain', async function () {
    const state = await this.page.evaluate(() => ({
        loads: window.edgeLoads,
        markers: controlElevation._markers.getLayers().length,
        points: controlElevation._container.querySelectorAll('.point > .point').length,
        coords: document.querySelector('.leaflet-control-mapcentercoord').textContent,
        icon: Boolean(document.querySelector('.leaflet-crosshair')),
        canvas: map.edgeScaleControl._scaleBar._canvas.isConnected
    }));
    assert.deepStrictEqual(state.loads, Array.from({ length: 11 }, (_, i) => i % 2 === 0 ? 4 : 0));
    assert.strictEqual(state.markers, 4);
    assert.strictEqual(state.points, 4);
    assert.ok(state.coords.trim().length > 0);
    assert.strictEqual(state.icon, true);
    assert.strictEqual(state.canvas, true);
});

Then('all three maps show their own track and correctly attached or detached chart', async function () {
    const state = await this.page.evaluate(() => charts.map((chart, i) => ({
        map: chart._map === maps[i],
        name: chart.track_info.name,
        distance: chart.track_info.distance,
        detached: chart.options.detached,
        attachedDOM: maps[i].getContainer().contains(chart._container),
        rendered: chart._container.querySelector('path.altitude')?.getAttribute('d')
    })));
    assert.deepStrictEqual(state.map(chart => chart.name), ['via-emilia.gpx', 'via-aurelia.gpx', 'demo.tcx']);
    state.forEach((chart, i) => {
        assert.strictEqual(chart.map, true);
        assert.ok(chart.distance > 0);
        assert.strictEqual(chart.detached, i === 2);
        assert.strictEqual(chart.attachedDOM, i !== 2);
        assert.ok(chart.rendered && chart.rendered !== 'M0 0');
    });
    this.multimapDistances = state.map(chart => chart.distance);
});

When('I hide the altitude profile in the first map', async function () {
    await this.page.locator('#map-1 .legend [data-name="altitude"]').click();
});

Then('the other maps keep their altitude profiles and track statistics unchanged', async function () {
    const state = await this.page.evaluate(() => charts.map(chart => ({
        hidden: chart._chart._paths.altitude.classed('leaflet-hidden'),
        distance: chart.track_info.distance
    })));
    assert.deepStrictEqual(state.map(chart => chart.hidden), [true, false, false]);
    assert.deepStrictEqual(state.map(chart => chart.distance), this.multimapDistances);
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

When('I select the other GeoJSON track in the layer switcher', async function () {
    await this.page.waitForFunction(() => typeof layers !== 'undefined' && layers.getLayers().length === 2);
    this.selectedTrackCoordinates = await this.page.evaluate(async base => {
        const data = await (await fetch(`${base}/examples/waypoints.geojson`)).json();
        // The example reloads Leaflet's toGeoJSON output, which uses six decimal places.
        return data.features.find(feature => feature.geometry.type === 'LineString').geometry.coordinates
            .map(coordinate => coordinate.map(value => L.Util.formatNum(value, 6)));
    }, this.base);
    const selector = this.page.locator('.leaflet-control-layers-base label').filter({ hasText: 'waypoints.geojson' }).locator('input');
    await selector.check();
    await this.page.waitForFunction(expected => {
        const data = controlElevation._data;
        return data.length === expected.length && data[0].latlng.lng === expected[0][0] &&
            data.at(-1).latlng.lat === expected.at(-1)[1];
    }, this.selectedTrackCoordinates);
});

Then('the attached profile contains only the selected track and its map layer', async function () {
    const state = await this.page.evaluate(() => ({
        coordinates: controlElevation._data.map(point => [point.latlng.lng, point.latlng.lat, point.z]),
        visible: layers.getLayers().filter(layer => map.hasLayer(layer)).map(layer =>
            layer.toGeoJSON().features.find(feature => feature.geometry.type === 'LineString').geometry.coordinates),
        checkpoints: controlElevation._container.querySelectorAll('.point > .point').length
    }));
    assert.deepStrictEqual(state.coordinates, this.selectedTrackCoordinates);
    assert.deepStrictEqual(state.visible, [this.selectedTrackCoordinates]);
    assert.strictEqual(state.checkpoints, 0);
});
