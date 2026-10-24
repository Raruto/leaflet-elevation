import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Given, When, Then } from '@cucumber/cucumber';
import { fixturePath, localFixture, openExample } from '../support/browser.js';

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
