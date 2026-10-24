import assert from 'node:assert/strict';
import { Given, When, Then } from '@cucumber/cucumber';
import { chromium, webkit } from 'playwright';

const lowLevelBrowsers = {
    'macOS Chromium': { engine: chromium, platform: 'MacIntel' },
    'macOS WebKit': { engine: webkit, platform: 'MacIntel' },
    'iOS Safari': {
        engine: webkit,
        platform: 'iPhone',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
    },
    'iOS Chrome': {
        engine: webkit,
        platform: 'iPhone',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/130.0.0.0 Mobile/15E148 Safari/604.1'
    }
};

const chartBrowsers = {
    'macOS Chrome': {
        engine: chromium,
        platform: 'MacIntel',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
        dpr: 2
    },
    'macOS Safari': {
        engine: webkit,
        platform: 'MacIntel',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/15.6.1 Safari/605.1.15',
        dpr: 2
    },
    'iOS Safari': {
        engine: webkit,
        platform: 'iPhone',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
        dpr: 3
    },
    'iOS Firefox': {
        engine: webkit,
        platform: 'iPhone',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 FxiOS/130.0 Mobile/15E148 Safari/605.1.15',
        dpr: 3
    },
    'iOS Chrome': {
        engine: webkit,
        platform: 'iPhone',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/130.0.0.0 Mobile/15E148 Safari/604.1',
        dpr: 3
    },
    'iPad desktop mode': {
        engine: webkit,
        platform: 'MacIntel',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
        dpr: 3
    }
};

async function samplePixels(page, points) {
    const screenshot = await page.screenshot({ scale: 'css' });
    return page.evaluate(async ({ png, points }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${png}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        return points.map(([x, y]) => [...context.getImageData(Math.round(x), Math.round(y), 1, 1).data].slice(0, 3));
    }, { png: screenshot.toString('base64'), points });
}

async function openPage(world, configuration, { profile = false, dpr = 1 } = {}) {
    world.browser = await configuration.engine.launch();
    const pageOptions = {
        viewport: profile ? { width: 400, height: 500 } : { width: 500, height: 400 },
        deviceScaleFactor: dpr
    };
    if (configuration.userAgent) pageOptions.userAgent = configuration.userAgent;
    world.page = await world.browser.newPage(pageOptions);
    if (profile) world.page.on('pageerror', error => world.errors.push(error.message));
    await world.page.addInitScript(platform => {
        Object.defineProperty(navigator, 'platform', { get: () => platform });
    }, configuration.platform);
    await world.page.goto(world.base);
}

async function drawLowLevelCanvas(page, { left, clear = false, resize = false }) {
    await page.evaluate(({ left, clear, resize }) => {
        if (resize) chart._resize({ width: 320, height: 240, margins: { left, top: 30, right: 20, bottom: 20 } });
        chart.utils.mask.selectAll('.test-gap').remove();
        chart.utils.mask.append('rect').attr('class', 'test-gap')
            .attr('x', 80).attr('y', 0).attr('width', 20).attr('height', 100).attr('fill', 'black');
        const context = chart.utils.context;
        context.fillStyle = '#ff0000';
        context.fillRect(0, 0, chart._width, chart._height);
        if (clear) context.clearRect(0, 0, chart._width, chart._height);
        chart._renderCanvas();
    }, { left, clear, resize });
}

Given('I open the low-level canvas page in {string}', async function (browserName) {
    const configuration = lowLevelBrowsers[browserName];
    assert.ok(configuration, `Unknown low-level browser: ${browserName}`);
    await openPage(this, configuration);
    await this.page.setContent('<style>body { margin: 0 } svg { display: block }</style>');
    await this.page.addScriptTag({ url: `${this.base}/node_modules/d3/dist/d3.min.js` });
});

Given('I create a canvas chart with a mask and tooltip overlay', async function () {
    await this.page.evaluate(async base => {
        const { Chart } = await import(`${base}/src/components/d3.js`);
        window.chart = Chart({ width: 320, height: 240, preferCanvas: true, margins: { left: 40, top: 30, right: 20, bottom: 20 } });
        document.body.append(chart.svg.node());
        chart.panes.tooltip.attr('display', null).append('rect')
            .attr('x', 20).attr('y', 20).attr('width', 40).attr('height', 40).attr('fill', '#0000ff');
    }, this.base);
});

When('I draw the red canvas at left margin 40', async function () {
    await drawLowLevelCanvas(this.page, { left: 40 });
    this.canvasLeft = 40;
});

When('I resize and draw the red canvas at left margin 70', async function () {
    await drawLowLevelCanvas(this.page, { left: 70, resize: true });
    this.canvasLeft = 70;
});

When('I clear and draw the canvas at left margin 70', async function () {
    await drawLowLevelCanvas(this.page, { left: 70, clear: true });
    this.canvasLeft = 70;
});

Then('the canvas pixels show the aligned profile and tooltip overlay', async function () {
    const left = this.canvasLeft;
    const pixels = await samplePixels(this.page, [[left - 5, 40], [left + 10, 40], [left + 30, 60], [left + 90, 40]]);
    assert.deepStrictEqual(pixels, [[255, 255, 255], [255, 0, 0], [0, 0, 255], [255, 255, 255]]);
});

Then('the canvas pixels show the cleared profile and tooltip overlay', async function () {
    const pixels = await samplePixels(this.page, [[65, 40], [80, 40], [100, 60], [160, 40]]);
    assert.deepStrictEqual(pixels, [[255, 255, 255], [255, 255, 255], [0, 0, 255], [255, 255, 255]]);
});

Given('I open a transformed chart host in {string} at DPR {int}', async function (browserName, dpr) {
    const configuration = chartBrowsers[browserName];
    assert.ok(configuration, `Unknown chart browser: ${browserName}`);
    assert.equal(dpr, configuration.dpr, `Unexpected DPR for ${browserName}`);
    await openPage(this, configuration, { profile: true, dpr });
    await this.page.setContent(`<style>
        body { margin: 0; background: white }
        #host { position: absolute; left: 23px; top: 41px; transform: scale(.8); transform-origin: 0 0 }
        svg { display: block }
        canvas { max-width: 100% }
        .mouse-focus-line { stroke: blue; stroke-width: 6 }
    </style><div id="host"></div>`);
    await this.page.addStyleTag({ url: `${this.base}/src/index.css` });
    await this.page.addScriptTag({ url: `${this.base}/node_modules/leaflet/dist/leaflet.js` });
    await this.page.addScriptTag({ url: `${this.base}/node_modules/d3/dist/d3.min.js` });
    await this.page.evaluate(async base => {
        L.Control.Elevation = { Utils: await import(`${base}/src/utils.js`) };
        window.ProfileChart = (await import(`${base}/src/components/chart.js`)).Chart;
    }, this.base);
});

When('I render a profile with {string} rendering', async function (renderingMode) {
    assert.ok(['canvas', 'SVG'].includes(renderingMode), `Unknown rendering mode: ${renderingMode}`);
    this.preferCanvas = renderingMode.toLowerCase() === 'canvas';
    await this.page.evaluate(preferCanvas => {
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
    }, this.preferCanvas);
});

When('I resize the profile to width {int} and left margin {int}', async function (width, left) {
    this.profileWidth = width;
    this.profileLeft = left;
    await this.page.evaluate(({ width, left }) => {
        profile.options.width = width;
        profile.options.margins.left = left;
        profile._chart._resize(profile.options);
        profile.update();
        profile._showDiagramIndicator(profile._data[0], 100);
    }, { width, left });
});

function profilePoints(width, left) {
    const plotWidth = width - left - 20;
    const point = (x, y) => [23 + .8 * (left + x), 41 + .8 * (30 + y)];
    return [point(-5, 150), point(10, 90), point(10, 110), point(plotWidth - 10, 180),
        point(plotWidth + 5, 150), point(100, 150)];
}

const white = [255, 255, 255];
const red = [255, 0, 0];
const blue = [0, 0, 255];

Then('the profile pixels show the aligned altitude area and tooltip', async function () {
    assert.deepStrictEqual(await samplePixels(this.page, profilePoints(this.profileWidth, this.profileLeft)),
        [white, white, red, red, white, blue]);
});

When('I hide the altitude area', async function () {
    await this.page.evaluate(() => profile._togglePath('altitude', false));
});

Then('the profile pixels show no altitude area and preserve the tooltip', async function () {
    assert.deepStrictEqual(await samplePixels(this.page, profilePoints(this.profileWidth, this.profileLeft)),
        [white, white, white, white, white, blue]);
});

When('I show the altitude area', async function () {
    await this.page.evaluate(() => profile._togglePath('altitude', true));
});

Then('the profile pixels show the restored altitude area and tooltip', async function () {
    assert.deepStrictEqual(await samplePixels(this.page, profilePoints(this.profileWidth, this.profileLeft)),
        [white, white, red, red, white, blue]);
});

When('I clear the profile', async function () {
    await this.page.evaluate(() => profile.clear());
});

Then('the profile pixels show a cleared chart', async function () {
    assert.deepStrictEqual(await samplePixels(this.page, profilePoints(this.profileWidth, this.profileLeft)),
        [white, white, white, white, white, white]);
});

Then('the browser reports no page errors', function () {
    assert.deepStrictEqual(this.errors, []);
});
