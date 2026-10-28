import assert from 'node:assert/strict';
import { Given, When, Then } from '@cucumber/cucumber';

Given('a native chart in a scaled container', async function () {
    await this.page.goto(this.base);
    await this.page.setContent('<style>body{margin:0} #host{margin:40px;transform:scale(.8);transform-origin:0 0}</style><div id="host" class="elevation-control"></div>');
    await this.page.addStyleTag({ url: `${this.base}/src/index.css` });
    await this.page.addScriptTag({ url: `${this.base}/node_modules/leaflet/dist/leaflet.js` });
    await this.page.evaluate(async base => {
        const utils = await import(`${base}/src/utils.js`);
        L._ = text => text;
        L.Control.Elevation = { Utils: utils };
        window.nativeChart = await import(`${base}/src/components/chart.js`);
        const { Chart } = nativeChart;
        window.profile = new Chart({
            width: 500, height: 300, margins: { left: 40, top: 30, right: 30, bottom: 60 },
            xAttr: 'dist', yAttr: 'z', yAxisMin: -50, yAxisMax: 50,
            dragging: true, zooming: true, legend: true, ruler: true, altitude: true,
        }, Object.assign(new L.Evented(), {
            _data: Array.from({ length: 11 }, (_, i) => ({ dist: i, z: i * 10 - 50, latlng: new L.LatLng(0, i) })),
        }));
        profile._registerAreaPath({ name: 'altitude', scaleX: 'distance', scaleY: 'altitude' });
        profile._registerAxisScale({ name: 'time', axis: 'x', position: 'top', scale: 'x' });
        profile.render()(document.querySelector('#host'));
        profile.update();
        window.nativeEvents = { dragged: [], ruler: [], hover: [] };
        profile.on('dragged', event => nativeEvents.dragged.push([event.dragstart.dist, event.dragend.dist]));
        profile.on('ruler_filter', event => nativeEvents.ruler.push(event.coords.map(group => group.map(point => point.lng))));
        profile.on('mouse_move', event => {
            nativeEvents.hover.push(event.xCoord);
            profile._showDiagramIndicator(event.item, event.xCoord);
        });
        profile.on('mouse_out', () => profile._hideDiagramIndicator());
        profile.on('zoom', () => profile.update());
    }, this.base);
});

Then('native scales and bisection handle constant, empty and duplicate values', async function () {
    const result = await this.page.evaluate(() => {
        const { bisect } = L.Control.Elevation.Utils;
        const scale = profile._x.copy().domain([-5, 5]).range([200, 0]);
        const copy = scale.copy().domain([0, 100]);
        const constant = scale.copy().domain([10, 10]).range([0, 200]);
        const data = [{ x: 0 }, { x: 1 }, { x: 1 }, { x: 3 }];
        profile._registerAxisScale({
            name: 'test', axis: 'y', attr: 'x', min: 0, max: 10,
            scale: { forceBounds: true },
        });
        return {
            empty: profile._domains.distance([]),
            negative: profile._domains.distance([{ dist: -4 }, { dist: -2 }, { dist: null }, { dist: NaN }]),
            forced: profile._domains.test(data),
            middle: scale(0), inverse: scale.invert(100), constant: constant(10),
            constantInverse: constant.invert(10), original: scale.domain(), copy: copy.domain(),
            ticks: scale.ticks(5), small: scale.copy().domain([0, 0.001]).ticks(5),
            indices: [bisect(data, 1, 'x'), bisect(data, 1, 'x', true), bisect(data, 5, 'x'), bisect([], 0, 'x')],
        };
    });
    assert.deepStrictEqual(result, {
        empty: [0, 1], negative: [-4, -2], forced: [0, 10],
        middle: 100, inverse: 0, constant: 100, constantInverse: 10,
        original: [-5, 5], copy: [0, 100], ticks: [-4, -2, 0, 2, 4],
        small: [0, .0002, .0004, .0006, .0008, .001], indices: [1, 3, 4, 0],
    });
});

Then('all supported interpolations produce the expected SVG paths', async function () {
    assert.deepStrictEqual(await this.page.evaluate(() => {
        const values = {};
        const chart = new nativeChart.Chart({
            width: 4, height: 10, margins: { left: 0, top: 0, right: 0, bottom: 0 },
            xAttr: 'x', yAttr: 'y',
        }, new L.Evented());
        chart._registerAreaPath({ name: 'test', scaleX: 'distance', scaleY: 'altitude' });
        chart._x.domain([0, 4]).range([0, 4]);
        chart._y.domain([0, 10]).range([0, 10]);
        for (const interpolation of ['curveLinear', 'curveStep', 'curveStepBefore', 'curveStepAfter']) {
            chart.options.interpolation = interpolation;
            chart._data = [{ x: 0, y: 2 }, { x: 4, y: 6 }];
            chart._updateArea();
            values[interpolation] = chart._paths.test.getAttribute('d');
            chart._data = [];
            chart._updateArea();
            if (chart._paths.test.getAttribute('d') !== '') throw new Error('An empty profile must have no path');
        }
        try {
            chart.options.interpolation = 'curveBasis';
            chart._updateArea();
            throw new Error('Unsupported interpolation was accepted');
        } catch (error) {
            if (!error.message.startsWith('Unsupported interpolation')) throw error;
        }
        return values;
    }), {
        curveLinear: 'M0,2L4,6L4,10L0,10Z',
        curveStep: 'M0,2H2V6H4L4,10L0,10Z',
        curveStepBefore: 'M0,2V6H4L4,10L0,10Z',
        curveStepAfter: 'M0,2H4V6L4,10L0,10Z',
    });
});

Then('native axes and custom callbacks receive SVG elements', async function () {
    assert.deepStrictEqual(await this.page.evaluate(() => {
        const { create } = L.Control.Elevation.Utils;
        const html = create('div', 'host', { title: 'HTML' });
        const svg = create('svg:svg', 'chart', { viewBox: '0 0 10 10' }, html);
        const circle = create('svg:circle', 'point', { r: 2 }, svg);
        return [
            html instanceof HTMLDivElement, html.className, html.title,
            svg instanceof SVGSVGElement, svg.getAttribute('class'), svg.getAttribute('viewBox'),
            circle instanceof SVGCircleElement, circle.getAttribute('class'),
            circle.getAttribute('r'), circle.parentNode === svg, svg.parentNode === html,
        ];
    }), [true, 'host', 'HTML', true, 'chart', '0 0 10 10', true, 'point', '2', true, true]);
    assert.deepStrictEqual(await this.page.evaluate(async base => {
        const modules = await Promise.all(['chart', 'marker', 'summary'].map(name =>
            import(`${base}/src/components/${name}.js`)));
        return modules.map(module => Object.keys(module));
    }, this.base), [['Chart'], ['Marker'], ['Summary']]);
    assert.strictEqual(await this.page.evaluate(() => {
        let mounted = false;
        profile._props.axes.time.onAxisMount = axis => { mounted = axis instanceof SVGGElement && !!axis.querySelector('.tick'); };
        profile.update();
        return mounted && profile._paths.altitude instanceof SVGPathElement &&
            profile._chart.pane('area') instanceof SVGGElement && typeof window.d3 === 'undefined';
    }), true);
});

async function drag(page, start, end) {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await page.mouse.up();
}

Then('the tooltip tightly encloses changing labels on both sides of the chart', async function () {
    const measurements = await this.page.evaluate(() => {
        const results = [];
        profile._registerTooltip({ name: 'altitude', value: item => `Altitude: ${item.z} m`, order: 1 });
        profile._registerTooltip({ name: 'description', value: item => item.description, order: 2 });
        profile._registerTooltip({ name: 'time', value: () => 'Duration: 00:38:03', order: 3 });
        for (const description of ['A much longer recorded track description', 'Short']) {
            for (const x of [20, profile._width() - 20]) {
                profile._showDiagramIndicator({ ...profile._data[5], description }, x);
                const text = profile._tooltip.querySelector('text').getBBox();
                const rect = profile._tooltip.querySelector('rect').getBBox();
                results.push({
                    x, text: { x: text.x, y: text.y, width: text.width, height: text.height },
                    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                });
            }
        }
        return results;
    });
    for (const { x, text, rect } of measurements) {
        assert.ok(Math.abs(rect.width - text.width - 10) < 1, JSON.stringify({ text, rect }));
        assert.ok(Math.abs(rect.height - text.height - 10) < 1);
        assert.ok(Math.abs(rect.x - text.x + 5) < 1, JSON.stringify({ text, rect }));
        assert.ok(text.y >= rect.y && text.y + text.height <= rect.y + rect.height);
        if (x === 20) assert.ok(rect.x > x);
        else assert.ok(rect.x + rect.width < x);
    }
    assert.ok(measurements[0].rect.width > measurements[2].rect.width);
});

When('I select, move and resize a native profile range', async function () {
    const box = await this.page.locator('.brush .overlay').boundingBox();
    const point = fraction => ({ x: box.x + box.width * fraction, y: box.y + box.height / 2 });
    await drag(this.page, point(.2), point(.6));
    await drag(this.page, point(.4), point(.5));
    await drag(this.page, point(.7), point(.9));
});

Then('the selected samples and rectangle match the pointer positions', async function () {
    const state = await this.page.evaluate(() => ({
        selection: profile._selection.map(value => value / profile._width()),
        events: nativeEvents.dragged,
    }));
    assert.equal(state.events.length, 3);
    for (const [actual, expected] of state.selection.map((value, i) => [value, [.3, .9][i]])) assert.ok(Math.abs(actual - expected) < .01);
    // Pixel rounding may put a pointer just after a sample, selecting the next recorded point.
    for (const [i, expected] of [[0, [2, 6]], [1, [3, 7]], [2, [3, 9]]]) {
        state.events[i].forEach((sample, j) => assert.ok(sample >= expected[j] && sample <= expected[j] + 1));
    }
});

When('I disable native brushing and clear the chart', async function () {
    await this.page.evaluate(() => { profile._brushEnabled = false; profile._resetDrag(); });
    const box = await this.page.locator('.brush .overlay').boundingBox();
    await drag(this.page, { x: box.x + 10, y: box.y + 20 }, { x: box.x + 100, y: box.y + 20 });
    assert.strictEqual(await this.page.evaluate(() => profile._selection), null);
    await this.page.evaluate(() => { profile._setZoom(2, -100); profile.clear(); });
});

Then('no range or stale zoom remains', async function () {
    assert.deepStrictEqual(await this.page.evaluate(() => ({
        selection: profile._selection, zoom: profile._transform,
        hidden: profile._chart.panes.brush.querySelector('.selection').getAttribute('display'),
        path: profile._paths.altitude.getAttribute('d'), tooltip: profile._tooltip.getAttribute('display'),
    })), { selection: null, zoom: { k: 1, x: 0 }, hidden: 'none', path: 'M0 0', tooltip: 'none' });
});

When('I zoom and pan the native chart using the mouse', async function () {
    const box = await this.page.locator('.brush .overlay').boundingBox();
    await this.page.mouse.move(box.x + box.width / 2, box.y + 20);
    await this.page.keyboard.down('Shift');
    await this.page.mouse.wheel(0, -500);
    await this.page.waitForFunction(() => profile._transform.k > 1);
    await drag(this.page, { x: box.x + box.width / 2, y: box.y + 20 }, { x: box.x + box.width * .6, y: box.y + 20 });
    await this.page.keyboard.up('Shift');
});

Then('the zoom is bounded and the axes share the visible distance scale', async function () {
    const state = await this.page.evaluate(() => {
        const { k, x } = profile._transform;
        const aliases = profile._scales.time === profile._x && profile._props.axes.time.scale === profile._x;
        const domain = profile._x.domain();
        profile._setZoom(100, -1e9);
        const maximum = { ...profile._transform };
        return { k, x, aliases, domain, maximum, width: profile._width() };
    });
    assert.ok(state.k > 1 && state.k <= 10);
    assert.ok(state.x <= 0);
    assert.ok(state.aliases);
    assert.ok(Math.abs(state.domain[1] - state.domain[0] - 10 / state.k) < 1e-10);
    assert.deepStrictEqual(state.maximum, { k: 10, x: -9 * state.width });
});

When('I drag the native ruler and toggle the legend using the keyboard', async function () {
    await this.page.evaluate(() => profile._resetZoom());
    const ruler = await this.page.locator('.horizontal-drag-rect').boundingBox();
    const plot = await this.page.locator('.brush .overlay').boundingBox();
    await drag(this.page, { x: ruler.x + ruler.width / 2, y: ruler.y + ruler.height / 2 }, { x: plot.x + plot.width / 2, y: plot.y + plot.height / 2 });
    await this.page.locator('.legend-item').focus();
    await this.page.keyboard.press('Enter');
});

Then('the elevation filter and legend state match the interaction', async function () {
    const state = await this.page.evaluate(() => ({
        groups: nativeEvents.ruler.at(-1),
        label: profile._ruler.querySelector('text').textContent,
        hidden: profile._paths.altitude.classList.contains('leaflet-hidden'),
        pressed: profile._legend.querySelector('.legend-item').getAttribute('aria-pressed'),
    }));
    assert.deepStrictEqual(state.groups, [[5, 6, 7, 8, 9, 10]]);
    assert.match(state.label, /^-?0 m$/);
    assert.strictEqual(state.hidden, true);
    assert.strictEqual(state.pressed, 'false');
});

async function touch(world, cancel = false) {
    const session = await world.page.context().newCDPSession(world.page);
    const box = await world.page.locator('.brush .overlay').boundingBox();
    const point = fraction => [{ x: box.x + box.width * fraction, y: box.y + box.height / 2 }];
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(.2) });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(.8) });
    await session.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
    await session.detach();
}

When('I drag a native profile range using touch', async function () { await touch(this); });

Then('a touch range is selected and its tooltip is hidden on release', async function () {
    const state = await this.page.evaluate(() => ({
        count: nativeEvents.dragged.length, selection: profile._selection,
        tooltip: profile._tooltip.getAttribute('display'), gesture: profile._gesture,
    }));
    assert.equal(state.count, 1);
    assert.ok(state.selection[1] > state.selection[0]);
    assert.equal(state.tooltip, 'none');
    assert.equal(state.gesture, null);
});

When('I cancel another touch selection', async function () {
    await this.page.evaluate(() => profile._resetDrag());
    await touch(this, true);
});

Then('the active gesture and selection are cleared', async function () {
    assert.deepStrictEqual(await this.page.evaluate(() => [profile._gesture, profile._selection]), [null, null]);
});
