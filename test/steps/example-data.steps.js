import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Given, When, Then } from '@cucumber/cucumber';
import { chromium } from 'playwright';
import { cityMapperBrowserOptions, fixturePath, localFixture, openExample, mapTile } from '../support/browser.js';
import { useCachedUnpkg } from '../support/unpkg.js';

Then('the city mapper example renders an interactive GeoJSON track and profile', { timeout: 60000 }, async function () {
    this.browser = await chromium.launch(cityMapperBrowserOptions);
    this.page = await this.browser.newPage();
    await this.page.setViewportSize({ width: 742, height: 380 });
    const image = await mapTile(this.page);
    const terrainImage = await mapTile(this.page, 'rgb(128, 100, 0)');
    await this.page.route(/^https:\/\/(?!unpkg\.com\/)/, async route => {
        await route.fulfill({
            contentType: 'image/png', body: image,
            headers: { 'access-control-allow-origin': '*' },
        });
    });
    await useCachedUnpkg(this.page);
    await this.page.route('https://tiles.mapterhorn.com/**', route => route.fulfill({
        contentType: 'image/png', body: terrainImage,
        headers: { 'access-control-allow-origin': '*' },
    }));
    await this.page.route(/^https:\/\/unpkg\.com\/@raruto\/leaflet-elevation@[^/]+\//, async route => {
        const path = new URL(route.request().url()).pathname.replace(/^\/@raruto\/leaflet-elevation@[^/]+\//, '/');
        const response = await route.fetch({ url: this.base + path });
        assert.ok(response.ok(), `Failed to load local elevation resource: ${path}`);
        await route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': '*' } });
    });
    this.page.on('pageerror', error => this.errors.push(error.stack || error.message));
    this.page.on('console', message => { if (message.type() === 'error') this.errors.push(message.text()); });
    try {
        await this.page.goto(`${this.base}/examples/leaflet-elevation_city-mapper.html`, { waitUntil: 'domcontentloaded' });
        assert.ok(await this.page.evaluate(async () => !!(await navigator.gpu?.requestAdapter())), 'WebGPU adapter unavailable');
        await this.page.waitForFunction(() => window.controlElevation?._data.length > 0 &&
            controlElevation._layers.getLayers().some(layer => layer instanceof L.Polyline && map.hasLayer(layer)) &&
            document.querySelector('#map canvas.leaflet-3d'));
        const height = await this.page.evaluate(async () =>
            (await terrain.options.getTile(10, 993, 654, new AbortController().signal))[0]);
        assert.equal(height, 100);
        const source = JSON.parse(await readFile(fixturePath('demo.geojson'), 'utf8'));
        const result = await this.page.evaluate(() => ({
            samples: controlElevation._data.map(point => [point.latlng.lng, point.latlng.lat, point.z]),
            distance: controlElevation.track_info.distance,
            time: controlElevation.track_info.time,
            chart: controlElevation._chart._paths.altitude.getAttribute('d'),
            track: controlElevation._layers.getLayers().some(layer => layer instanceof L.Polyline && map.hasLayer(layer)),
            pitch: map.getPitch(),
            mapHeight: map.getContainer().getBoundingClientRect().height,
            viewportHeight: innerHeight,
        }));
        assert.deepStrictEqual(result.samples, source.features.flatMap(feature => feature.geometry.coordinates));
        assert.ok(result.distance > 0 && result.time > 0);
        assert.match(result.chart, /L/);
        assert.ok(result.track && result.pitch > 0);
        assert.ok(result.mapHeight >= result.viewportHeight / 2);
        await this.page.waitForTimeout(1000);
        const screenshot = await this.page.locator('#map').screenshot();
        const trackPixels = await this.page.evaluate(async image => {
            const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${image}`)).blob());
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const context = canvas.getContext('2d');
            context.drawImage(bitmap, 0, 0);
            bitmap.close();
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
            let count = 0;
            for (let i = 0; i < pixels.length; i += 4) {
                if (pixels[i] > 220 && pixels[i + 1] > 30 && pixels[i + 1] < 120 && pixels[i + 2] < 60) count++;
            }
            return count;
        }, screenshot.toString('base64'));
        assert.ok(trackPixels > 20, `Track not visible in 3D map (${trackPixels} pixels)`);
        const overlay = this.page.locator('.brush .overlay').first();
        const box = await overlay.boundingBox();
        await overlay.hover({ position: { x: box.width / 2, y: box.height / 2 } });
        await this.page.waitForFunction(() => controlElevation._marker.getLatLng());
        const state = await this.page.evaluate(() => {
            const errors = [];
            for (const [pitch, bearing, index] of [[45, 25, 30], [70, 90, 80], [25, 180, 130]]) {
                map.setPitch(pitch, { animate: false });
                map.setBearing(bearing, { animate: false });
                controlElevation._updateMarker(controlElevation._data[index]);
                const circle = controlElevation._marker._container.querySelector('circle').getBoundingClientRect();
                const anchor = controlElevation._marker._anchor.getElement().getBoundingClientRect();
                errors.push(Math.hypot(circle.x + circle.width / 2 - anchor.x, circle.y + circle.height / 2 - anchor.y));
            }
            map.setPitch(70, { animate: false });
            const scale = map.edgeScaleControl._scaleBar;
            const ctx = scale._ctx, move = ctx.moveTo, line = ctx.lineTo, stroke = ctx.stroke, ticks = [];
            let position;
            ctx.moveTo = function (x, y) { position = [x, y]; return move.call(this, x, y); };
            ctx.lineTo = function (x, y) {
                if (position && position[1] === 0 && x === position[0] && y > 0) ticks.push(x);
                return line.call(this, x, y);
            };
            try { scale._reset(); }
            finally { ctx.moveTo = move; ctx.lineTo = line; ctx.stroke = stroke; }
            ticks.sort((a, b) => a - b);
            return {
                errors, ticks,
                listensToPitch: (map._events.pitch || []).some(listener => listener.ctx === scale && listener.fn === scale._reset),
            };
        });
        assert.ok(state.errors.every(error => error < 2), `Marker misalignment: ${state.errors}`);
        assert.ok(state.listensToPitch && state.ticks.length > 2);
        assert.ok(state.ticks.slice(1).every((tick, i) => tick - state.ticks[i] >= 2.9), 'Edge scale ticks overlap');
        const cleanup = await this.page.evaluate(() => {
            const marker = controlElevation._marker;
            const scale = map.edgeScaleControl._scaleBar;
            marker.remove();
            const markerRemoved = !map.hasLayer(marker._anchor);
            controlElevation._updateMarker(controlElevation._data[80]);
            const markerRestored = map.hasLayer(marker._anchor);
            controlElevation.remove();
            scale.remove();
            return {
                markerRemoved, markerRestored,
                markerDetached: !map.hasLayer(marker._anchor),
                scaleDetached: !(map._events.pitch || []).some(listener => listener.ctx === scale && listener.fn === scale._reset),
                controlDetached: !(map._events.pitch || []).some(listener => listener.ctx === controlElevation && listener.fn === controlElevation._rotateMarker),
            };
        });
        assert.ok(Object.values(cleanup).every(Boolean), `Incomplete marker or scale cleanup: ${JSON.stringify(cleanup)}`);
        assert.deepStrictEqual(this.errors, []);
    } finally {
        await this.page.evaluate(() => { window.map?.remove(); window.map = null; });
    }
});

async function waitForTrack(page) {
    await page.waitForFunction(() =>
        typeof controlElevation !== 'undefined' && controlElevation._chart &&
        controlElevation._data.length > 0 && controlElevation._layers.getLayers().length > 0
    );
}

Given('I open the {string} data example using {string}', async function (example, fixture) {
    await localFixture(this.page, fixture);
    this.sourceText = await readFile(fixturePath(fixture), 'utf8');
    this.sourceFormat = fixture.split('.').at(-1);
    await openExample(this, example);
    await waitForTrack(this.page);
});

Then('every profile sample matches the source track coordinates and elevation', async function () {
    const result = await this.page.evaluate(({ text, format }) => {
        let expected;
        if (format === 'geojson') expected = JSON.parse(text).features.flatMap(feature => feature.geometry.coordinates);
        else {
            const xml = new DOMParser().parseFromString(text, 'application/xml');
            expected = format === 'kml'
                ? [...xml.querySelectorAll('LineString coordinates')].flatMap(node =>
                    node.textContent.trim().split(/\s+/).map(point => point.split(',').map(Number)))
                : [...xml.querySelectorAll('Trackpoint')].map(node => [
                    Number(node.querySelector('LongitudeDegrees').textContent),
                    Number(node.querySelector('LatitudeDegrees').textContent),
                    Number(node.querySelector('AltitudeMeters').textContent)
                ]);
        }
        return {
            expected,
            actual: controlElevation._data.map(point => [point.latlng.lng, point.latlng.lat, point.z])
        };
    }, { text: this.sourceText, format: this.sourceFormat });
    assert.ok(result.expected.length > 1);
    assert.deepStrictEqual(result.actual, result.expected);
});

Then('the track distance and summary agree with its geographic length', async function () {
    const state = await this.page.evaluate(() => {
        const data = controlElevation._data;
        const geographic = data.slice(1).reduce((sum, point, i) => sum + point.latlng.distanceTo(data[i].latlng), 0) / 1000;
        return {
            distance: controlElevation.track_info.distance, geographic, count: data.length,
            summary: controlElevation._container.querySelector('.totlen .summaryvalue').textContent
        };
    });
    assert.ok(state.distance > 0);
    assert.ok(Math.abs(state.distance - state.geographic) <= state.count * 0.00001);
    assert.strictEqual(state.summary, `${state.distance.toFixed(2)}\u00a0km`);
});

Then('its map track appears in the layer switcher', async function () {
    await this.page.waitForFunction(() => {
        const lines = controlElevation._layers.getLayers().filter(layer => layer instanceof L.Polyline);
        return lines.length > 0 && lines.every(layer => map.hasLayer(layer));
    });
    await this.page.waitForFunction(() => document.querySelector('.leaflet-control-layers-overlays input'));
    const visible = await this.page.evaluate(() => {
        const lines = [];
        controlElevation._layers.eachLayer(layer => {
            if (layer instanceof L.Polyline) lines.push(map.hasLayer(layer));
        });
        return lines;
    });
    assert.ok(visible.length > 0);
    assert.ok(visible.every(Boolean));
    assert.ok(await this.page.locator('.leaflet-control-layers-overlays input:checked').count() > 0);
});

Given('I open the {string} waypoint example using {string}', async function (example, fixture) {
    await localFixture(this.page, fixture);
    const source = await readFile(fixturePath(fixture), 'utf8');
    this.waypointExample = example;
    await openExample(this, example);
    await waitForTrack(this.page);
    await this.page.waitForFunction(() => controlElevation._markers.getLayers().length === 4);
    this.waypoints = await this.page.evaluate(({ source, format }) => {
        if (format === 'geojson') return JSON.parse(source).features
            .filter(feature => feature.geometry.type === 'Point')
            .map(feature => ({ name: feature.properties.name, description: feature.properties.desc || '' }));
        return [...new DOMParser().parseFromString(source, 'application/xml').querySelectorAll('wpt')]
            .map(node => ({ name: node.querySelector('name').textContent, description: node.querySelector('desc')?.textContent || '' }));
    }, { source, format: fixture.split('.').at(-1) });
});

Then('four waypoints appear on the map and as labelled chart checkpoints', async function () {
    await this.page.waitForFunction(() => {
        const markers = controlElevation._markers.getLayers();
        return markers.length === 4 && markers.every(marker => map.hasLayer(marker));
    });
    const state = await this.page.evaluate(() => ({
        markers: controlElevation._markers.getLayers().map(marker => ({
            visible: map.hasLayer(marker), label: marker.getTooltip().getContent()
        })),
        labels: [...controlElevation._container.querySelectorAll('.point > .point text')].map(node => node.textContent)
    }));
    assert.strictEqual(state.markers.length, 4);
    assert.strictEqual(state.labels.length, 4);
    for (const waypoint of this.waypoints) {
        assert.ok(state.labels.includes(waypoint.name));
        assert.ok(state.markers.some(marker => marker.visible && marker.label.includes(waypoint.name)));
    }
});

Then('their icons distinguish the trailhead and summit from other waypoints', async function () {
    const icons = await this.page.evaluate(() => controlElevation._markers.getLayers().map(marker => ({
        label: marker.getTooltip().getContent(),
        html: marker.getElement().innerHTML
    })));
    assert.strictEqual(icons.filter(icon => /peak|trail-head|summit/.test(icon.html)).length, 2);
    assert.ok(icons.find(icon => icon.label.includes('Vista Ridge Trailhead')).html.includes(
        this.waypointExample === 'geojson-waypoints' ? 'peak' : 'trail-head'));
    assert.ok(icons.find(icon => icon.label.includes('Barrett Spur')).html.includes(
        this.waypointExample === 'geojson-waypoints' ? 'peak' : 'summit'));
});

When('I open each waypoint popup', async function () {
    this.popups = await this.page.evaluate(() => controlElevation._markers.getLayers().map(marker => {
        marker.openPopup();
        return {
            open: marker.isPopupOpen(),
            content: marker.getPopup().getElement().querySelector('.leaflet-popup-content').innerHTML
        };
    }));
});

Then('each popup contains its source name and description', function () {
    assert.strictEqual(this.popups.length, this.waypoints.length);
    this.waypoints.forEach((waypoint, index) => {
        assert.strictEqual(this.popups[index].open, true);
        assert.ok(this.popups[index].content.includes(waypoint.name));
        if (waypoint.description) assert.ok(this.popups[index].content.includes(waypoint.description));
    });
});

Given('the string-data example has loaded its inline GeoJSON', async function () {
    await openExample(this, 'string-data');
    await waitForTrack(this.page);
    this.originalInline = await this.page.evaluate(() => ({
        text: document.querySelector('#text-data').value,
        points: controlElevation._data.map(point => [point.latlng.lng, point.latlng.lat, point.z]),
        distance: controlElevation.track_info.distance
    }));
});

When('I replace the text with a three-point GeoJSON track and press UPDATE', async function () {
    this.editedCoordinates = [[10, 45, 100], [10.01, 45, 125], [10.02, 45.01, 150]];
    await this.page.locator('#text-data').fill(JSON.stringify({
        type: 'FeatureCollection', name: 'edited-track',
        features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: this.editedCoordinates } }]
    }));
    await this.page.evaluate(() => {
        window.editedLoaded = new Promise(resolve => controlElevation.once('eledata_loaded', () => resolve()));
    });
    await this.page.locator('button.update').click();
    await this.page.evaluate(() => window.editedLoaded);
});

Then('the edited coordinates, elevations and distance replace the original track', async function () {
    const state = await this.page.evaluate(() => ({
        points: controlElevation._data.map(point => [point.latlng.lng, point.latlng.lat, point.z]),
        distance: controlElevation.track_info.distance
    }));
    assert.deepStrictEqual(state.points, this.editedCoordinates);
    assert.ok(state.distance > 0);
    assert.notStrictEqual(state.distance, this.originalInline.distance);
});

When('I empty the track text and press UPDATE', async function () {
    await this.page.locator('#text-data').fill('');
    await this.page.locator('button.update').click();
});

Then('the editable chart has no data or map track layers', async function () {
    assert.deepStrictEqual(await this.page.evaluate(() => ({
        points: controlElevation._data.length, layers: controlElevation._layers.getLayers().length
    })), { points: 0, layers: 0 });
});

When('I press RESET', async function () {
    await this.page.evaluate(() => {
        window.resetLoaded = new Promise(resolve => controlElevation.once('eledata_loaded', () => resolve()));
    });
    await this.page.locator('button.reset').click();
    await this.page.evaluate(() => window.resetLoaded);
});

Then('the original text, profile and distance are restored', async function () {
    assert.deepStrictEqual(await this.page.evaluate(() => ({
        text: document.querySelector('#text-data').value,
        points: controlElevation._data.map(point => [point.latlng.lng, point.latlng.lat, point.z]),
        distance: controlElevation.track_info.distance
    })), this.originalInline);
});
