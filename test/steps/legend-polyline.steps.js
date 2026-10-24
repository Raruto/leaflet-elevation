import assert from 'node:assert/strict';
import { Given, When, Then } from '@cucumber/cucumber';
import { openExample } from '../support/browser.js';

Given('a track using the {string} map renderer and {string} chart renderer', async function (renderer, profile) {
    this.mapRenderer = renderer;
    this.htmlTransform = body => body
        .replace('preferCanvas: true', `preferCanvas: ${renderer === 'canvas'}`)
        .replace('theme: "lightblue-theme",', `theme: "lightblue-theme", preferCanvas: ${profile === 'canvas'},`)
        .replace('almostOver: true', 'almostOver: false');
    await this.page.route('**/via-emilia.gpx', route => route.fulfill({
        contentType: 'application/gpx+xml',
        body: '<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>' +
            '<trkpt lat="45" lon="10"><ele>100</ele></trkpt><trkpt lat="45.01" lon="10.01"><ele>150</ele></trkpt>' +
            '</trkseg></trk></gpx>'
    }));
    await openExample(this, '');
    await this.page.waitForFunction(() =>
        typeof controlElevation !== 'undefined' && controlElevation._chart &&
        controlElevation._data.length === 2 && controlElevation._layers.getLayers().some(layer => layer._renderer)
    );
    assert.strictEqual(await this.page.evaluate(() => {
        window.legendTrack = controlElevation._layers.getLayers().find(layer => layer instanceof L.Polyline);
        window.unrelatedTrack = L.polyline([[44, 9], [44.01, 9.01]], { color: '#ff00ff' }).addTo(map);
        window.trackStrokes = [];
        if (legendTrack._renderer instanceof L.Canvas) {
            const renderer = legendTrack._renderer;
            const fillStroke = renderer._fillStroke;
            let currentLayer;
            renderer._fillStroke = function (ctx, layer) {
                currentLayer = layer;
                try {
                    return fillStroke.call(this, ctx, layer);
                } finally {
                    currentLayer = undefined;
                }
            };
            const context = renderer._ctx;
            const stroke = context.stroke;
            context.stroke = function (...args) {
                if (currentLayer === legendTrack && this.globalCompositeOperation === 'source-over') {
                    window.trackStrokes.push(this.strokeStyle);
                }
                return stroke.apply(this, args);
            };
        }
        return legendTrack._renderer instanceof L.Canvas;
    }), renderer === 'canvas');
});

async function drawnColor(world) {
    if (world.mapRenderer === 'SVG') {
        return world.page.evaluate(() => getComputedStyle(legendTrack.getElement()).stroke);
    }
    await world.page.waitForFunction(() => window.trackStrokes.length > 0);
    return world.page.evaluate(() => window.trackStrokes.filter(color => color !== '#ff00ff').at(-1));
}

Then('the map track is drawn in the theme color', async function () {
    await this.page.evaluate(() => {
        window.trackStrokes.length = 0;
        legendTrack.redraw();
    });
    assert.strictEqual(await drawnColor(this), this.mapRenderer === 'canvas' ? '#3366cc' : 'rgb(51, 102, 204)');
});

When('I disable every chart series using the legend', async function () {
    const names = await this.page.evaluate(() => Object.keys(controlElevation._chart._paths)
        .filter(name => !controlElevation._chart._paths[name].classed('leaflet-hidden')));
    assert.ok(names.length > 0);
    for (const name of names) {
        await this.page.evaluate(() => { window.trackStrokes.length = 0; });
        await this.page.locator(`.legend [data-name="${name}"]`).click();
    }
    assert.strictEqual(await this.page.evaluate(() => controlElevation._chartEnabled), false);
});

Then('the map track is drawn in black', async function () {
    assert.strictEqual(await drawnColor(this), this.mapRenderer === 'canvas' ? '#000000' : 'rgb(0, 0, 0)');
});

When('I pan the map with all chart series disabled', async function () {
    await this.page.evaluate(() => {
        window.trackStrokes.length = 0;
        map.panBy([20, 10], { animate: false });
    });
});

When('I enable altitude using the legend', async function () {
    await this.page.locator('.legend [data-name="altitude"]').click();
    assert.strictEqual(await this.page.evaluate(() => controlElevation._chartEnabled), true);
});

Then('unrelated map polylines retain their original color', async function () {
    assert.strictEqual(await this.page.evaluate(() => unrelatedTrack.options.color), '#ff00ff');
});
