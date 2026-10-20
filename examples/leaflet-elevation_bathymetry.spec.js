/**
 * examples/leaflet-elevation_bathymetry.html
 */

import assert from 'node:assert/strict';
import { suite } from '../test/browser.js';

const test = suite('examples/leaflet-elevation_bathymetry.html');

test('bathymetry example keeps every underwater marker finite, bounded and ordered', async ({ page }) => {
    const markers = await page.evaluate(() => {
        const data = controlElevation._data.map(item => {
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
        });

        return data;
    });

    assert.strictEqual(markers.length, 178);

    markers.forEach(marker => {
        assert.ok(Number.isFinite(marker.height));
        assert.ok(marker.height >= 0 && marker.height <= 1);
        assert.ok(marker.label.includes(String(marker.elevation)));
        assert.strictEqual(marker.labelY, marker.lineY);
    });

    const sorted = markers.slice().sort((a, b) => a.elevation - b.elevation);
    assert.strictEqual(sorted[0].height, 0);
    assert.ok(Math.abs(sorted[sorted.length - 1].height - 1) < 1e-8);
    sorted.slice(1).forEach((marker, i) => assert.ok(marker.height >= sorted[i].height - 1e-8));
});

test('attached chart mouse movement does not propagate to the map', async ({ page }) => {
    const overlay = page.locator('.elevation-control .brush .overlay');
    await overlay.waitFor();

    await page.evaluate(() => {
        window.mapMouseMoves = 0;
        document.querySelector('.leaflet-map').addEventListener('mousemove', () => window.mapMouseMoves++);
    });

    const bounds = await overlay.boundingBox();
    assert.ok(bounds && bounds.width > 0 && bounds.height > 0);
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);

    assert.strictEqual(await page.evaluate(() => window.mapMouseMoves), 0);
});
