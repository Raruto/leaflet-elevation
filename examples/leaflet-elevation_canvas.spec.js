import assert from 'node:assert/strict';
import { it } from 'node:test';
import { chromium, webkit } from 'playwright';
import { startServer } from '../build/server.js';

async function samplePixels(page, points) {
    const screenshot = await page.screenshot({ scale: 'css' });
    return page.evaluate(async ({ png, points }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${png}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        return points.map(([x, y]) => [...ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data].slice(0, 3));
    }, { png: screenshot.toString('base64'), points });
}

/**
 * @see https://github.com/Raruto/leaflet-elevation/issues/232
 */
it('canvas profiles align with SVG margins and stay below tooltips in Chromium and WebKit', { timeout: 60000 }, async t => {
    const server = await startServer(0);
    t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const { engine, platform, userAgent } of [
        { engine: chromium, platform: 'MacIntel' },
        { engine: webkit, platform: 'MacIntel' },
        { engine: webkit, platform: 'iPhone', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' },
        { engine: webkit, platform: 'iPhone', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/130.0.0.0 Mobile/15E148 Safari/604.1' }
    ]) {
        const browser = await engine.launch();
        try {
            const page = await browser.newPage({ viewport: { width: 500, height: 400 }, userAgent });
            await page.addInitScript(platform => Object.defineProperty(navigator, 'platform', { get: () => platform }), platform);
            await page.goto(base);
            await page.setContent('<style>body { margin: 0 } svg { display: block }</style>');
            await page.addScriptTag({ url: `${base}/node_modules/d3/dist/d3.min.js` });
            await page.evaluate(async base => {
                const { Chart } = await import(`${base}/src/components/d3.js`);
                window.chart = Chart({ width: 320, height: 240, preferCanvas: true, margins: { left: 40, top: 30, right: 20, bottom: 20 } });
                document.body.append(chart.svg.node());
                chart.panes.tooltip.attr('display', null).append('rect')
                    .attr('x', 20).attr('y', 20).attr('width', 40).attr('height', 40).attr('fill', '#0000ff');
            }, base);
            for (const [left, clear] of [[40, false], [70, false], [70, true]]) {
                await page.evaluate(({ left, clear }) => {
                    if (!clear) chart._resize({ width: 320, height: 240, margins: { left, top: 30, right: 20, bottom: 20 } });
                    chart.utils.mask.selectAll('.test-gap').remove();
                    chart.utils.mask.append('rect').attr('class', 'test-gap')
                        .attr('x', 80).attr('y', 0).attr('width', 20).attr('height', 100).attr('fill', 'black');
                    const ctx = chart.utils.context;
                    ctx.fillStyle = '#ff0000';
                    ctx.fillRect(0, 0, chart._width, chart._height);
                    if (clear) ctx.clearRect(0, 0, chart._width, chart._height);
                    chart._renderCanvas();
                }, { left, clear });
                const pixels = await samplePixels(page, [[left - 5, 40], [left + 10, 40], [left + 30, 60], [left + 90, 40]]);
                assert.deepStrictEqual(pixels, [
                    [255, 255, 255], clear ? [255, 255, 255] : [255, 0, 0], [0, 0, 255], [255, 255, 255]
                ], `${engine.name()} ${platform} clear=${clear}`);
            }
        } finally {
            await browser.close();
        }
    }
});

async function checkProfile(t, configurations) {
    const server = await startServer(0);
    t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const { name, engine, platform, userAgent, deviceScaleFactor } of configurations) {
        await t.test(name, async () => {
            const browser = await engine.launch();
            try {
                const page = await browser.newPage({
                    viewport: { width: 400, height: 500 }, userAgent, deviceScaleFactor
                });
                const errors = [];
                page.on('pageerror', error => errors.push(error.message));
                await page.addInitScript(platform => Object.defineProperty(navigator, 'platform', { get: () => platform }), platform);
                await page.goto(base);
                await page.setContent(`<style>
                    body { margin: 0; background: white }
                    #host { position: absolute; left: 23px; top: 41px; transform: scale(.8); transform-origin: 0 0 }
                    svg { display: block }
                    canvas { max-width: 100% }
                    .mouse-focus-line { stroke: blue; stroke-width: 6 }
                </style><div id="host"></div>`);
                await page.addStyleTag({ url: `${base}/src/index.css` });
                await page.addScriptTag({ url: `${base}/node_modules/leaflet/dist/leaflet.js` });
                await page.addScriptTag({ url: `${base}/node_modules/d3/dist/d3.min.js` });
                await page.evaluate(async base => {
                    L.Control.Elevation = { Utils: await import(`${base}/src/utils.js`) };
                    window.ProfileChart = (await import(`${base}/src/components/chart.js`)).Chart;
                }, base);
                for (const preferCanvas of [true, false]) {
                    await page.evaluate(preferCanvas => {
                        document.querySelector('#host').replaceChildren();
                        window.profile = new ProfileChart({
                            width: 320, height: 240, margins: { left: 40, top: 30, right: 20, bottom: 20 },
                            preferCanvas, xAttr: 'dist', yAttr: 'z', yAxisMin: 0, yAxisMax: 100,
                            distance: false, altitude: false, legend: false, ruler: false,
                            dragging: false, zooming: false
                        }, Object.assign(new L.Evented(), { _data: [{ dist: 0, z: 50 }, { dist: 1, z: 50 }] }));
                        profile._registerAreaPath({
                            name: 'altitude', color: '#ff0000', strokeColor: '#ff0000',
                            fillOpacity: 1, strokeOpacity: 1, scaleX: 'distance', scaleY: 'altitude'
                        });
                        d3.select('#host').call(profile.render());
                        profile.update();
                    }, preferCanvas);
                    for (const [width, left] of [[320, 40], [280, 70]]) {
                        await page.evaluate(({ width, left }) => {
                            profile.options.width = width;
                            profile.options.margins.left = left;
                            profile._chart._resize(profile.options);
                            profile.update();
                            profile._showDiagramIndicator(profile._data[0], 100);
                        }, { width, left });
                        const w = width - left - 20;
                        const point = (x, y) => [23 + .8 * (left + x), 41 + .8 * (30 + y)];
                        const points = [point(-5, 150), point(10, 90), point(10, 110),
                            point(w - 10, 180), point(w + 5, 150), point(100, 150)];
                        const white = [255, 255, 255], red = [255, 0, 0], blue = [0, 0, 255];
                        const label = `${name} canvas=${preferCanvas} width=${width}`;
                        assert.deepStrictEqual(await samplePixels(page, points), [white, white, red, red, white, blue], label);
                        await page.evaluate(() => profile._togglePath('altitude', false));
                        assert.deepStrictEqual(await samplePixels(page, points), [white, white, white, white, white, blue], `${label} hidden`);
                        await page.evaluate(() => profile._togglePath('altitude', true));
                        assert.deepStrictEqual(await samplePixels(page, points), [white, white, red, red, white, blue], `${label} restored`);
                        await page.evaluate(() => profile.clear());
                        assert.deepStrictEqual(await samplePixels(page, points), points.map(() => white), `${label} cleared`);
                    }
                }
                assert.deepStrictEqual(errors, []);
            } finally {
                await browser.close();
            }
        });
    }
}

/**
 * @see https://github.com/Raruto/leaflet-elevation/issues/123
 */
it('mobile WebKit profiles and tooltips survive transformed containers and high DPR', { timeout: 60000 }, async t => {
    await checkProfile(t, [
        { name: 'iOS Safari', platform: 'iPhone', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' },
        { name: 'iOS Firefox', platform: 'iPhone', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 FxiOS/130.0 Mobile/15E148 Safari/605.1.15' },
        { name: 'iOS Chrome', platform: 'iPhone', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/130.0.0.0 Mobile/15E148 Safari/604.1' },
        { name: 'iPad desktop mode', platform: 'MacIntel', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' }
    ].map(configuration => ({ engine: webkit, deviceScaleFactor: 3, ...configuration })));
});

/**
 * @see https://github.com/Raruto/leaflet-elevation/issues/232
 */
it('desktop Chrome avoids double translation and Safari preserves profile scale and stacking', { timeout: 60000 }, async t => {
    await checkProfile(t, [
        { name: 'macOS Chrome', engine: chromium, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36' },
        { name: 'macOS Safari', engine: webkit, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6.1 Safari/605.1.15' }
    ].map(configuration => ({ platform: 'MacIntel', deviceScaleFactor: 2, ...configuration })));
});
