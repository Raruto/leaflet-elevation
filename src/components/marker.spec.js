import { suite } from 'uvu';
import * as assert from 'uvu/assert';
import httpServer from 'http-server';
import { chromium } from 'playwright';

const test = suite('src/components/marker.js');

test.before(async (ctx) => {
    ctx.server = httpServer.createServer({ root: process.cwd() });
    await new Promise(resolve => ctx.server.listen(0, '127.0.0.1', resolve));
    ctx.localhost = 'http://127.0.0.1:' + ctx.server.server.address().port;
    ctx.browser = await chromium.launch();
});

test.after(async ({ browser, server }) => {
    await browser.close();
    server.close();
});

test.before.each(async (ctx) => {
    ctx.page = await ctx.browser.newPage();
    await ctx.page.route(ctx.localhost + '/marker-test', route => route.fulfill({
        contentType: 'text/html',
        body: `<!DOCTYPE html>
            <link rel="stylesheet" href="/node_modules/leaflet/dist/leaflet.css">
            <link rel="stylesheet" href="/dist/leaflet-elevation.css">
            <div id="map" style="width:800px;height:600px"></div>
            <script src="/node_modules/leaflet/dist/leaflet.js"></script>
            <script src="/node_modules/d3/dist/d3.min.js"></script>
            <script src="/dist/leaflet-elevation.js"></script>`
    }));
    await ctx.page.goto(ctx.localhost + '/marker-test');
});

test.after.each(async ({ page }) => page.close());

async function createControl(page, options = {}) {
    await page.evaluate((options) => {
        window.map = L.map('map').setView([31.5, 35.5], 10);
        window.control = L.control.elevation({
            detached: false,
            height: 200,
            width: 400,
            legend: false,
            summary: false,
            closeBtn: false,
            followMarker: false,
            almostOver: false,
            distanceMarkers: false,
            edgeScale: false,
            hotline: false,
            ...options
        }).addTo(map);
    }, options);
    await page.waitForFunction(() => control._chart && control._marker && control._modulesLoaded);
}

async function loadTrack(page, elevations) {
    return page.evaluate((elevations) => new Promise(resolve => {
        control.once('eledata_added', () => {
            const markers = control._data.map(item => {
                control._updateMarker(item);
                const line = document.querySelector('.height-focus.line');
                const label = document.querySelector('.height-focus-label');
                return {
                    height: (+line.getAttribute('y1') - +line.getAttribute('y2')) / control._height(),
                    elevation: item.z,
                    label: label.textContent,
                    labelY: +label.getAttribute('y'),
                    lineY: +line.getAttribute('y2')
                };
            });
            resolve(markers);
        });
        control.addData({
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: elevations.map((z, i) => [35.5 + i * 0.01, 31.5, z])
            }
        });
    }), elevations);
}

function checkHeights(markers, expected) {
    assert.is(markers.length, expected.length);
    markers.forEach((marker, i) => {
        assert.ok(Number.isFinite(marker.height), 'marker height is finite');
        assert.ok(Math.abs(marker.height - expected[i]) < 1e-8,
            `point ${i}: expected height ${expected[i]}, got ${marker.height}`);
        assert.is(marker.labelY, marker.lineY, 'label stays at the end of the marker line');
    });
}

for (const [name, elevations, expected] of [
    ['negative elevations', [-400, -250, -100], [0, 0.5, 1]],
    ['crossing sea level', [-100, 0, 100], [0, 0.5, 1]],
    ['positive elevations', [100, 200, 400], [0.25, 0.5, 1]],
    ['ending at sea level', [-100, -50, 0], [0, 0.5, 1]],
    ['flat negative elevations', [-100, -100], [0, 0]],
    ['flat zero elevations', [0, 0], [0, 0]],
    ['flat positive elevations', [100, 100], [1, 1]]
]) {
    test(name, async ({ page }) => {
        await createControl(page);
        checkHeights(await loadTrack(page, elevations), expected);
    });
}

test('negative elevations in imperial units', async ({ page }) => {
    await createControl(page, { imperial: true });
    const markers = await loadTrack(page, [-400, -250, -100]);
    checkHeights(markers, [0, 0.5, 1]);
    assert.ok(markers.every(marker => marker.elevation < 0 && marker.label.includes('ft')));
});

test('clearing tracks resets both elevation bounds', async ({ page }) => {
    await createControl(page);
    await loadTrack(page, [100, 400]);
    await page.evaluate(() => control.clear());
    checkHeights(await loadTrack(page, [-400, -250, -100]), [0, 0.5, 1]);
    await page.evaluate(() => control.clear());
    checkHeights(await loadTrack(page, [25, 50, 100]), [0.25, 0.5, 1]);
});

test('appended tracks share the elevation bounds', async ({ page }) => {
    await createControl(page);
    await loadTrack(page, [-400, -100]);
    checkHeights(await loadTrack(page, [0, 400]), [0, 0.375, 0.5, 1]);
});

test.run();
