import assert from 'node:assert/strict';
import { Given, When, Then } from '@cucumber/cucumber';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

Given('the native Leaflet compatibility fixture uses {string}', async function (bundle) {
    this.browser = await chromium.launch();
    this.page = await this.browser.newPage();
    this.page.on('pageerror', error => this.errors.push(error.stack));
    await this.page.route('https://unpkg.com/@tmcw/togeojson@*/dist/togeojson.umd.js', route =>
        route.fulfill({ path: fileURLToPath(new URL('../../node_modules/@tmcw/togeojson/dist/togeojson.umd.js', import.meta.url)) }));
    await this.page.goto(`${this.base}/test/fixtures/leaflet-elevation-compatibility.html?leaflet=${process.env.LEAFLET_VERSION || '1'}&bundle=${bundle}`);
    await this.page.waitForFunction(() => window.profile?._data.length === 3 && profile._chart && profile._marker && profile._summary && map.edgeScaleControl && L.DistanceMarkers);
});

When('I create a rotated map for the native compatibility fixture', async function () {
    await this.page.addScriptTag({ url: 'https://unpkg.com/leaflet-rotate@0.6.0/dist/leaflet-rotate.js' });
    await this.page.evaluate(() => {
        const container = document.createElement('div');
        container.style.width = '800px';
        container.style.height = '600px';
        document.body.appendChild(container);
        window.map = new (L.LeafletMap || L.Map)(container, {
            center: [45, 9], zoom: 12, rotate: true, edgeScaleControl: true
        });
    });
});

Then('native profiles, markers, gradients, distance markers and scales work', async function () {
    const result = await this.page.evaluate(() => {
        profile._marker.update({ map, item: profile._data[1], yCoordMax: 100, yCoordMin: 0 });
        return {
            version: L.version,
            distance: profile.track_info.distance > 0,
            height: profile._data[0].z,
            path: !!profile._chart._paths.altitude,
            summary: profile._summary._container.textContent.length > 0,
            marker: !!document.querySelector('.height-focus-group circle'),
            hotline: profile._hotline.getLayers().length > 0,
            scales: (() => {
                const scale = map.edgeScaleControl._scaleBar;
                const { width, height } = scale._canvas;
                const pixels = scale._ctx.getImageData(0, 0, width, height).data;
                let top = 0, left = 0;
                for (let x = 1; x < width - 1; x++) {
                    const i = (7 * width + x) * 4;
                    if (pixels[i + 3] && pixels[i] < 180) top++;
                }
                for (let y = 1; y < height - 1; y++) {
                    const i = (y * width + 7) * 4;
                    if (pixels[i + 3] && pixels[i] < 180) left++;
                }
                return top > 0 && left > 0;
            })(),
            distanceMarkers: typeof L.DistanceMarkers,
        };
    });
    assert.equal(result.version, process.env.LEAFLET_VERSION === '2' ? '2.0.0-beta.3' : '1.9.4');
    assert.equal(result.height, 0);
    for (const key of ['distance', 'path', 'summary', 'marker', 'hotline', 'scales']) assert.equal(result[key], true, key);
    assert.equal(result.distanceMarkers, 'function');
    assert.deepEqual(this.errors, []);
});

Then('native profile clearing and reloading preserves initialization hooks', async function () {
    await this.page.evaluate(async () => {
        profile.clear();
        profile.load(JSON.stringify(track));
        const calls = [];
        L.Control.Elevation.addInitHook(function () {
            if (!this._data || !this._layers) throw new Error('Elevation hook before initialization');
            calls.push(this);
        });

        new L.Control.Elevation({ legend: false });
        if (calls.length !== 1) throw new Error('Elevation hook must run once');
    });
    await this.page.waitForFunction(() => profile._data.length === 3 && profile._hotline.getLayers().length > 0);
    await this.page.evaluate(() => {
        window.attached = new L.Control.Elevation({
            detached: false, marker: 'position-marker', distanceMarkers: false,
            hotline: false, edgeScale: false, autofitBounds: false,
            srcFolder: profile.options.srcFolder,
        }).addTo(map);
        attached.load(JSON.stringify(track));
    });
    await this.page.waitForFunction(() => attached._data.length === 3 && attached._marker && attached._chart);
    const attached = await this.page.evaluate(() => {
        attached._marker.update({ map, item: attached._data[1] });
        const visible = map.hasLayer(attached._marker._marker);
        const parent = attached.getContainer().parentElement === map._controlCorners.topright;
        const independent = attached.options.margins !== profile.options.margins;
        attached.clear();
        attached.remove();
        return { visible, parent, independent };
    });
    assert.deepEqual(attached, { visible: true, parent: true, independent: true });
    assert.deepEqual(this.errors, []);
});

Then('native grouped-track legends and measurement controls work', async function () {
    await this.page.addScriptTag({ url: `${this.base}/libs/leaflet-gpxgroup.min.js` });
    await this.page.addScriptTag({ url: `${this.base}/libs/leaflet-ruler.min.js` });
    const result = await this.page.evaluate(() => {
        const group = new L.GpxGroup([]);
        const route = new L.LayerGroup();
        const legend = new L.Control.LayersLegend({ Route: route }).addTo(map);
        let selected;
        const onSelect = event => { selected = event.layer; };
        map.on('legend_selected', onSelect);
        legend.getContainer().querySelector('input').click();
        const selectedRoute = selected === route;
        legend.remove();
        map.off('legend_selected', onSelect);
        const ruler = new L.Control.Ruler().addTo(map);
        ruler._toggleMeasure();
        map.fire('click', { latlng: new L.LatLng(45, 9) });
        map.fire('click', { latlng: new L.LatLng(45.01, 9.02) });
        const measured = ruler._latlngs.length === 2 && ruler._totalLength > 0;
        ruler._toggleMeasure();
        ruler.remove();
        return { selectedRoute, measured, group: group instanceof L.Evented, options: new L.Control().getPosition() };
    });
    assert.deepEqual(result, { selectedRoute: true, measured: true, group: true, options: 'topright' });
    assert.deepEqual(this.errors, []);
});
