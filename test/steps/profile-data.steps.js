import assert from 'node:assert/strict';
import { Given, When, Then } from '@cucumber/cucumber';
import { localFixture, openExample } from '../support/browser.js';

Given('the gradient example uses its original track-statistic limits', async function () {
    await localFixture(this.page, 'demo.geojson');
});

Given('the gradient example uses numeric limits {int} and {int}', async function (min, max) {
    this.htmlTransform = body => {
        assert.match(body, /min: 'elevation_min'/);
        assert.match(body, /max: 'elevation_max'/);
        return body.replace("min: 'elevation_min'", `min: ${min}`).replace("max: 'elevation_max'", `max: ${max}`);
    };
    await localFixture(this.page, 'demo.geojson');
});

When('I load the gradient track', async function () {
    await openExample(this, 'linear-gradient');
    await this.page.waitForFunction(() =>
        typeof controlElevation !== 'undefined' && controlElevation._data.length > 0 &&
        document.querySelector('linearGradient[id^="altitude-gradient-"] stop')
    );
    this.gradient = await this.page.evaluate(() => {
        const xAttr = controlElevation._chart._props.areas.altitude.xAttr;
        return {
            values: controlElevation._data.map(point => point[xAttr]),
            elevations: controlElevation._data.map(point => point.z),
            stops: [...document.querySelectorAll('linearGradient[id^="altitude-gradient-"] stop')].map(stop => ({
                offset: Number(stop.getAttribute('offset')),
                color: stop.getAttribute('stop-color')
            }))
        };
    });
});

Then('the lowest and highest elevations use opposite ends of the gradient palette', function () {
    const { elevations, stops } = this.gradient;
    const low = stops[elevations.indexOf(Math.min(...elevations))].color.match(/\d+/g).map(Number);
    const high = stops[elevations.indexOf(Math.max(...elevations))].color.match(/\d+/g).map(Number);
    assert.ok(low[0] <= 2 && low[1] >= 135 && low[2] === 0);
    assert.ok(high[0] >= 253 && high[1] <= 2 && high[2] === 0);
    assert.ok(new Set(stops.map(stop => stop.color)).size > 2);
});

Then('the altitude path uses the generated SVG gradient', async function () {
    assert.strictEqual(await this.page.evaluate(() => {
        const chart = controlElevation._chart;
        const gradient = chart._container.select('linearGradient[id^="altitude-gradient-"]').attr('id');
        const path = chart._paths.altitude;
        return path.attr('fill') === `url(#${gradient})` && path.node().isConnected;
    }), true);
});

Then('every gradient stop is positioned at its normalized chart x coordinate', function () {
    const { values, stops } = this.gradient;
    assert.strictEqual(stops.length, values.length);
    assert.deepStrictEqual(stops.map(stop => stop.offset),
        values.map(value => (value - values[0]) / (values.at(-1) - values[0])));
});

Then('all gradient stops use the lower-limit color {string}', function (color) {
    assert.ok(this.gradient.stops.every(stop => stop.color === color));
});

Given('a hotline track with missing, zero and valid elevations', async function () {
    this.htmlTransform = body => body.replace('hotline: false', 'hotline: true').replace('almostOver: true', 'almostOver: false');
    await this.page.route('**/via-emilia.gpx', route => route.fulfill({
        contentType: 'application/gpx+xml',
        body: '<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>' +
            [undefined, 0, 10, undefined, undefined, 20, undefined].map((alt, i) =>
                `<trkpt lat="45" lon="${10 + i / 100}">${alt === undefined ? '' : `<ele>${alt}</ele>`}</trkpt>`
            ).join('') + '</trkseg></trk></gpx>'
    }));
    await openExample(this, '');
    await this.page.waitForFunction(() =>
        typeof controlElevation !== 'undefined' && controlElevation._hotline.getLayers().length > 0 &&
        controlElevation._hotline.getLayers()[0]._map
    );
});

When('I draw mixed, unknown and constant elevation segments and pan the map', async function () {
    this.colors = await this.page.evaluate(() => {
        const line = controlElevation._hotline.getLayers()[0];
        const hotline = line._renderer._hotline;
        const data = line.getLatLngs();
        const original = hotline.getRGBForValue;
        const coloredValues = [];
        hotline.getRGBForValue = function (value) {
            coloredValues.push(value);
            return original.call(this, value);
        };
        hotline.min(0).max(20).data([data.map((point, i) => ({ x: i * 10, y: 10, z: point.alt }))]).draw();
        const mixedValues = coloredValues.splice(0);
        hotline.data([[{ x: 0, y: 0 }, { x: 10, y: 10 }]]).draw();
        const missingValues = coloredValues.splice(0);
        const constantColors = [0, 50].map(value => {
            hotline.min(value).max(value);
            hotline.data([[{ x: 0, y: 0, z: value }, { x: 10, y: 10, z: value }]]).draw();
            return hotline.getRGBForValue(value);
        });
        map.panBy([30, 10], { animate: false });
        return { mixedValues, missingValues, constantColors };
    });
    await this.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
});

Then('only finite segment endpoints are passed to the color scale', function () {
    assert.deepStrictEqual(this.colors.mixedValues, [0, 10]);
    assert.deepStrictEqual(this.colors.missingValues, []);
});

Then('constant elevation colors contain only finite components', function () {
    assert.ok(this.colors.constantColors.flat().every(Number.isFinite));
});

Given('a detached elevation control with a visible ruler', async function () {
    await localFixture(this.page, 'via-emilia.gpx');
    await openExample(this, '');
    await this.page.waitForFunction(() =>
        typeof controlElevation !== 'undefined' && controlElevation._chart &&
        controlElevation._data.length > 0 && controlElevation._container.querySelector('.horizontal-drag-line')
    );
});

When('I remove and re-add the control', async function () {
    this.rulerRestored = await this.page.evaluate(() => {
        const control = controlElevation;
        const oldContainer = control._container;
        control.onRemove(map);
        oldContainer.remove();
        control.addTo(map);
        return new Promise(resolve => {
            const check = () => {
                if (control._container && control._container !== oldContainer && control._chart &&
                    control._container.querySelector('.horizontal-drag-line')) {
                    resolve(control.eleDiv === control._container);
                } else {
                    requestAnimationFrame(check);
                }
            };
            check();
        });
    });
});

Then('the ruler is restored in the new control container', function () {
    assert.strictEqual(this.rulerRestored, true);
});
