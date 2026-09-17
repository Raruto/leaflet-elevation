import { suite } from '../test/setup/http_server.js';
import * as assert from 'uvu/assert';
import { readFileSync } from 'node:fs';

const test = suite('examples/leaflet-elevation_bathymetry.html');
const bathymetry = JSON.parse(readFileSync(new URL('./bathymetry.geojson', import.meta.url)));

async function readMarkers(page) {
    await page.waitForFunction(() => controlElevation._data.length === 178 && controlElevation._marker && controlElevation._chart && controlElevation._modulesLoaded);
    return page.evaluate(() => controlElevation._data.map(item => {
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
}

test('bathymetry example keeps every underwater marker finite, bounded and ordered', async ({ page }) => {
    const markers = await readMarkers(page);
    const elevations = bathymetry.features[0].geometry.coordinates.map(point => point[2]);
    assert.equal(markers.map(marker => marker.elevation), elevations);
    markers.forEach(marker => {
        assert.ok(Number.isFinite(marker.height));
        assert.ok(marker.height >= 0 && marker.height <= 1);
        assert.ok(marker.label.includes(String(marker.elevation)));
        assert.is(marker.labelY, marker.lineY);
    });
    const sorted = markers.slice().sort((a, b) => a.elevation - b.elevation);
    assert.is(sorted[0].height, 0);
    assert.ok(Math.abs(sorted[sorted.length - 1].height - 1) < 1e-8);
    sorted.slice(1).forEach((marker, i) => assert.ok(marker.height >= sorted[i].height - 1e-8));
});

test('switching to an above-sea-level track and back restores underwater marker heights', async ({ page }) => {
    const before = await readMarkers(page);
    await page.selectOption('#track', 'demo.geojson');
    await page.waitForFunction(() => controlElevation._data.length && controlElevation.track_info.elevation_max > 0);
    await page.selectOption('#track', 'bathymetry.geojson');
    const after = await readMarkers(page);
    assert.is(after.length, before.length);
    after.forEach((marker, i) => {
        assert.ok(Math.abs(marker.height - before[i].height) < 1e-8);
        assert.is(marker.labelY, marker.lineY);
    });
    assert.equal(after.map(marker => marker.elevation), before.map(marker => marker.elevation));
});

test('bathymetry markers preserve depths in imperial units', async ({ page }) => {
    await page.goto(page.url() + '?imperial');
    const markers = await readMarkers(page);
    const metric = bathymetry.features[0].geometry.coordinates;
    markers.forEach((marker, i) => {
        assert.ok(Number.isFinite(marker.height));
        assert.ok(marker.height >= -1e-8 && marker.height <= 1 + 1e-8);
        assert.ok(Math.abs(marker.elevation - metric[i][2] * 3.28084) < 1e-8);
        assert.ok(marker.label.includes('ft'));
        assert.is(marker.labelY, marker.lineY);
    });
});

test.run();
