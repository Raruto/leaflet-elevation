import assert from 'node:assert/strict';
import { Given, When, Then } from '@cucumber/cucumber';
import { openExample } from '../support/browser.js';

Given('imperial units and a short GPX without timestamps', async function () {
    this.htmlTransform = body => body.replace('imperial: false', 'imperial: true');
    await this.page.route('**/via-emilia.gpx', route => route.fulfill({
        contentType: 'application/gpx+xml',
        body: '<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg><trkpt lat="0" lon="0"><ele>0</ele></trkpt><trkpt lat="0" lon="0.01"><ele>0</ele></trkpt></trkseg></trk></gpx>'
    }));
});

When('I load the track with estimated time', async function () {
    await openExample(this, '');
    await this.page.waitForFunction(() =>
        typeof controlElevation !== 'undefined' && controlElevation._data.length === 2 &&
        Number.isFinite(controlElevation.track_info.time)
    );
    this.time = await this.page.evaluate(() => ({
        duration: controlElevation.track_info.time,
        expectedDuration: new L.LatLng(0, 0).distanceTo(new L.LatLng(0, 0.01)) / 1000 / 3.6 * 3600 * 1000,
        distance: controlElevation.track_info.distance
    }));
});

Then('the estimated duration uses geographic kilometres within {int} milliseconds', function (tolerance) {
    assert.ok(Math.abs(this.time.duration - this.time.expectedDuration) <= tolerance);
});

Then('the displayed track distance is less than one mile', function () {
    assert.ok(this.time.distance < 1);
});

Given('a four-day GPX with variable speed and a 24-hour stationary pause', async function () {
    this.htmlTransform = body => body
        .replace('time: "summary"', 'time: true, xTimeFormat: duration => String(duration)')
        .replace('almostOver: true', 'almostOver: false');
    await this.page.route('**/via-emilia.gpx', route => route.fulfill({
        contentType: 'application/gpx+xml',
        body: '<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>' +
            [[0, 0], [1, 1], [2, 40], [2, 64], [3, 65], [4, 96]].map(([lon, hours]) =>
                `<trkpt lat="0" lon="${lon}"><ele>10</ele><time>${new Date(Date.UTC(2024, 0, 1) + hours * 3600000).toISOString()}</time></trkpt>`
            ).join('') + '</trkseg></trk></gpx>'
    }));
});

When('I load the track with the time axis and a numeric duration formatter', async function () {
    await openExample(this, '');
    await this.page.waitForFunction(() =>
        typeof controlElevation !== 'undefined' && controlElevation._data.length === 6 &&
        controlElevation._container.querySelector('.x.axis.time .tick')
    );
});

When('I set the time-axis zoom to {int}', async function (zoom) {
    await this.page.evaluate(zoom => {
        const chart = controlElevation._chart;
        chart._setZoom(zoom, -50 * (zoom - 1));
    }, zoom);
});

Then('the time ticks interpolate recorded durations at their horizontal positions', async function () {
    const ticks = await this.page.evaluate(() => {
        const chart = controlElevation._chart;
        const data = controlElevation._data;
        return [...chart._axis.querySelectorAll('.x.axis.time .tick')].map(node => {
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
    });
    assert.ok(ticks.length >= 2);
    for (const tick of ticks) {
        if (tick.expected === 0) assert.strictEqual(tick.label, '');
        else assert.ok(Math.abs(Number(tick.label) - tick.expected) < 1, JSON.stringify(tick));
    }
});

Then('the time labels at recorded distances use the duration after the pause', async function () {
    assert.deepStrictEqual(await this.page.evaluate(() => {
        const format = controlElevation._chart._props.axes.time.tickFormat;
        return controlElevation._data.map(point => format(point.dist));
    }), ['', '3600000', '230400000', '230400000', '234000000', '345600000']);
});

When('I clear the time-axis track', async function () {
    await this.page.evaluate(() => controlElevation.clear());
});
