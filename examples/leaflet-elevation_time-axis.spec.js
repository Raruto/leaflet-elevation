import assert from 'node:assert/strict';
import { it } from 'node:test';
import { chromium } from 'playwright';
import { startServer } from '../build/server.js';

/**
 * @see https://github.com/Raruto/leaflet-elevation/issues/170
 */
it('time axis follows recorded durations at each distance, including chart zoom', { timeout: 60000 }, async t => {
    const server = await startServer(0);
    let browser;
    t.after(async () => {
        try {
            await browser?.close();
        } finally {
            await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        }
    });
    browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/\.html$/, async route => {
        const response = await route.fetch();
        const body = (await response.text())
            .replace(/https:\/\/unpkg.com\/@raruto\/leaflet-elevation@[^/]+\//g, '../')
            .replace('time: "summary"', 'time: true, xTimeFormat: duration => String(duration)')
            .replace('almostOver: true', 'almostOver: false');
        await route.fulfill({ response, body });
    });
    await page.route('**/via-emilia.gpx', route => route.fulfill({
        contentType: 'application/gpx+xml',
        body: '<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>' +
            [[0, 0], [1, 1], [2, 40], [2, 64], [3, 65], [4, 96]].map(([lon, hours]) =>
                `<trkpt lat="0" lon="${lon}"><ele>10</ele><time>${new Date(Date.UTC(2024, 0, 1) + hours * 3600000).toISOString()}</time></trkpt>`
            ).join('') + '</trkseg></trk></gpx>'
    }));
    await page.goto(`http://127.0.0.1:${server.address().port}/examples/leaflet-elevation.html`);
    await page.waitForFunction(() =>
        typeof controlElevation !== 'undefined' &&
        controlElevation._data.length === 6 &&
        controlElevation._container.querySelector('.x.axis.time .tick')
    );

    for (const zoom of [1, 2, 1]) {
        const ticks = await page.evaluate(zoom => {
            const chart = controlElevation._chart;
            chart._container.call(chart._zoom.transform, d3.zoomIdentity.translate(-50 * (zoom - 1), 0).scale(zoom));
            const data = controlElevation._data;
            return chart._axis.selectAll('.x.axis.time .tick').nodes().map(node => {
                const x = Number(node.getAttribute('transform').match(/translate\(([^,]+)/)[1]) - 0.5;
                const distance = chart._x.invert(x);
                let i = 0;
                while (i + 1 < data.length && data[i + 1].dist <= distance + 1e-8) i++;
                const start = data[i];
                const end = data[Math.min(i + 1, data.length - 1)];
                const fraction = end.dist > start.dist ? Math.max(0, Math.min(1, (distance - start.dist) / (end.dist - start.dist))) : 0;
                return {
                    label: node.querySelector('text').textContent,
                    expected: start.duration + fraction * (end.duration - start.duration)
                };
            });
        }, zoom);
        assert.ok(ticks.length >= 2);
        for (const tick of ticks) {
            if (tick.expected === 0) assert.strictEqual(tick.label, '');
            else assert.ok(Math.abs(Number(tick.label) - tick.expected) < 1, JSON.stringify(tick));
        }
    }
    assert.deepStrictEqual(await page.evaluate(() => {
        const format = controlElevation._chart._props.axes.time.tickFormat;
        return controlElevation._data.map(point => format(point.dist));
    }), ['', '3600000', '230400000', '230400000', '234000000', '345600000']);
    await page.evaluate(() => controlElevation.clear());
    assert.deepStrictEqual(errors, []);
});
