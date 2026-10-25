import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { When, Then } from '@cucumber/cucumber';
import { openExample, localFixture, fixturePath } from '../support/browser.js';

When('I open the presentation example {string}', async function (name) {
    const fixtures = {
        chart_labels: 'via-emilia.gpx',
        'custom-theme': 'demo.geojson',
        'extended-ui': 'time.gpx',
        'i18n-strings': 'via-emilia.gpx',
        'multiple-charts': 'via-emilia.gpx',
        'slope-chart': 'via-emilia.gpx',
        'speed-chart': 'time.geojson',
        'temperature-chart': 'atemp.gpx'
    };
    assert.ok(fixtures[name], `Unknown presentation example: ${name}`);
    await localFixture(this.page, fixtures[name]);
    await openExample(this, name);
    await this.page.waitForFunction(() => {
        const controls = typeof charts !== 'undefined' ? Object.values(charts) :
            typeof controlElevation !== 'undefined' ? [controlElevation] : [];
        return controls.length && controls.every(control =>
            control._data.length > 0 && control._chart &&
            Object.values(control._chart._paths).some(path => path.getAttribute('d')?.includes('L'))
        );
    });
});

Then('the chart shows the eight Via Emilia city labels rotated around their anchors', async function () {
    const labels = await this.page.locator('g.point text').evaluateAll(nodes => nodes.map(node => ({
        text: node.textContent,
        rotation: node.getAttribute('transform'),
        anchor: node.getAttribute('text-anchor'),
        dx: node.getAttribute('dx'),
        dy: node.getAttribute('dy')
    })));
    assert.deepStrictEqual(labels.map(label => label.text),
        ['Piacenza', 'Parma', 'Reggio Emilia', 'Modena', 'Bologna', 'Forlì', 'Cesena', 'Rimini']);
    for (const label of labels) {
        assert.equal(label.rotation, 'rotate(-25)');
        assert.equal(label.anchor, 'middle');
        assert.equal(label.dx, '4px');
        assert.equal(label.dy, '-9px');
    }
    assert.match(await this.page.locator('.elevation-summary').innerText(), /Entfernung:/);
});

Then('the custom chart and map line use the example theme', async function () {
    await this.page.locator('.custom-theme .area path.altitude').waitFor({ state: 'attached' });
    await this.page.locator('path.custom-theme.elevation-polyline').waitFor({ state: 'attached' });
    const styles = await this.page.evaluate(() => {
        const area = document.querySelector('.custom-theme .area path.altitude');
        const line = document.querySelector('path.custom-theme.elevation-polyline');
        const style = getComputedStyle(area);
        return {
            fill: style.fill, stroke: style.stroke, opacity: style.fillOpacity,
            lineStroke: getComputedStyle(line).stroke,
            pattern: !!document.querySelector('#herringbone-pattern path'),
            summaryBackground: getComputedStyle(document.querySelector('#data-summary')).backgroundColor
        };
    });
    assert.match(styles.fill, /#herringbone-pattern/);
    assert.equal(styles.stroke, 'rgb(255, 0, 0)');
    assert.equal(styles.opacity, '0.8');
    assert.equal(styles.lineStroke, 'rgb(255, 0, 0)');
    assert.equal(styles.pattern, true);
    assert.equal(styles.summaryBackground, 'rgb(0, 0, 0)');
});

Then('the external summary reports the loaded track statistics', async function () {
    const result = await this.page.evaluate(() => {
        const info = controlElevation.track_info;
        const text = key => document.querySelector(`#data-summary .${key} .summaryvalue`).textContent;
        return {
            actual: ['totlen', 'maxele', 'minele', 'tottime'].map(text),
            expected: [info.distance.toFixed(2) + ' km', info.elevation_max.toFixed(2) + ' m',
                info.elevation_min.toFixed(2) + ' m', L.Control.Elevation.Utils.formatTime(info.time)],
            values: [info.distance, info.elevation_max, info.elevation_min, info.time]
        };
    });
    assert.deepStrictEqual(result.actual, result.expected);
    assert.ok(result.values.every(value => value > 0));
});

Then('the fitness chart reports heart rate cadence and pace from the timed track', async function () {
    const result = await this.page.evaluate(() => {
        const data = controlElevation._data;
        const context = controlElevation._chart._context;
        return {
            stats: ['heart', 'cadence', 'pace'].map(name => ({
                name,
                min: Math.min(...data.map(point => point[name])),
                max: Math.max(...data.map(point => point[name])),
                avg: data.reduce((sum, point) => sum + point[name], 0) / data.length,
                path: controlElevation._chart._paths[name].getAttribute('d')
            })),
            painted: context.getImageData(0, 0, context.canvas.width, context.canvas.height)
                .data.some((value, i) => i % 4 === 3 && value > 0)
        };
    });
    assert.equal(result.painted, true);
    assert.deepStrictEqual(result.stats.slice(0, 2).map(({ min, max }) => [min, max]), [[112, 173], [0, 101]]);
    for (const [i, { min, max, avg, path }] of result.stats.entries()) {
        assert.match(path, /^M/);
        assert.ok(max > min && avg > min && avg < max);
        const [suffix, unit] = [['bpm', 'bpm'], ['rpm', 'rpm'], ['pace', 'min/km']][i];
        for (const [prefix, value] of [['min', min], ['max', max], ['avg', avg]]) {
            const text = await this.page.locator(`.elevation-summary .${prefix}${suffix} .summaryvalue`).innerText();
            assert.equal(text.replace(/\s+/g, ' '), `${Math.round(value)} ${unit}`);
        }
    }
});

When('I toggle the fitness heart legend off and on', async function () {
    const legend = this.page.locator('.legend-heart');
    await legend.click();
    assert.equal(await this.page.evaluate(() => controlElevation._chart._paths.heart.classList.contains('leaflet-hidden')), true);
    assert.equal(await legend.locator('text').evaluate(node => getComputedStyle(node).textDecorationLine), 'line-through');
    await legend.click();
});

Then('the heart profile is restored without hiding cadence or pace', async function () {
    assert.deepStrictEqual(await this.page.evaluate(() =>
        ['heart', 'cadence', 'pace'].map(name => controlElevation._chart._paths[name].classList.contains('leaflet-hidden'))
    ), [false, false, false]);
    assert.equal(await this.page.locator('.legend-heart text').evaluate(node => getComputedStyle(node).textDecorationLine), 'none');
});

Then('the summary and legend use the Italian example translations', async function () {
    const summary = await this.page.locator('.elevation-summary').innerText();
    for (const label of ['Distanza:', 'Durata:', 'Altezza Min:', 'Altezza Max:', 'Altezza Media:']) {
        assert.ok(summary.includes(label), `Missing translation: ${label}`);
    }
    assert.doesNotMatch(summary, /Total Length|Elevation|Total Time/);
    assert.equal(await this.page.locator('.legend-altitude text').textContent(), 'Altitudine');
    assert.match(await this.page.locator('.elevation-summary .totlen .summaryvalue').innerText(), /^264\.69\s+km$/);
});

When('I hover over the presentation chart', async function () {
    await this.page.locator('.elevation-control .brush .overlay').hover({ position: { x: 120, y: 40 } });
    await this.page.waitForFunction(() => document.querySelector('.elevation-control .tooltip')?.getAttribute('display') !== 'none');
});

Then('the presentation tooltip contains {string} and {string}', async function (first, second) {
    const tooltip = this.page.locator('.elevation-control .tooltip');
    assert.equal(await tooltip.isVisible(), true);
    const text = await tooltip.textContent();
    assert.ok(text.includes(first), text);
    assert.ok(text.includes(second), text);
    assert.match(text, /\d/);
});

Then('all three profiles render their own series and external summaries', async function () {
    const profiles = await this.page.evaluate(() => Object.entries(charts).map(([id, control]) => {
        const stat = id === 'elevation' ? 'elevation' : id;
        const series = id === 'elevation' ? 'altitude' : id;
        return {
            id,
            paths: [...control._container.querySelectorAll('.area path')].map(path => path.getAttribute('class')),
            path: control._chart._paths[series].getAttribute('d'),
            actual: ['max', 'min', 'avg'].map(key =>
                document.querySelector(`.summary:has(+ #${id}-chart) .${key} .summaryvalue`).textContent),
            expected: ['max', 'min', 'avg'].map(key => control.track_info[`${stat}_${key}`].toFixed(2)),
            points: control._data.length,
            distance: control.track_info.distance
        };
    }));
    assert.equal(profiles.length, 3);
    for (const profile of profiles) {
        assert.deepStrictEqual(profile.actual, profile.expected);
        assert.equal(profile.paths.length, 1);
        assert.match(profile.paths[0], new RegExp(profile.id === 'elevation' ? 'altitude' : profile.id));
        assert.match(profile.path, /^M.*L/);
        assert.ok(Number(profile.actual[0]) > Number(profile.actual[1]));
        assert.equal(profile.points, profiles[0].points);
        assert.equal(profile.distance, profiles[0].distance);
    }
});

Then('hovering each profile shows its own measurement on the shared map', async function () {
    for (const [id, unit] of [['elevation', 'm'], ['slope', '%'], ['speed', 'km/h']]) {
        await this.page.locator(`#${id}-chart .brush .overlay`).hover({ position: { x: 120, y: 40 } });
        const tooltip = this.page.locator(`#${id}-chart .tooltip`);
        assert.equal(await tooltip.isVisible(), true);
        assert.ok((await tooltip.textContent()).includes(unit));
        assert.equal(await this.page.locator('#map').evaluate(node => node.classList.contains('elechart-hover')), true);
        await this.page.mouse.move(1, 1);
        assert.equal(await tooltip.isVisible(), false);
    }
});

Then('the slope profile agrees with elevation changes over distance', async function () {
    const result = await this.page.evaluate(() => {
        const data = controlElevation._data;
        return {
            comparisons: data.slice(1).map((point, i) => ({
                actual: point.slope,
                expected: (point.z - data[i].z) / ((point.dist - data[i].dist) * 1000) * 100
            })).filter(pair => Number.isFinite(pair.expected)),
            ascent: data.slice(1).reduce((sum, point, i) => sum + Math.max(0, point.z - data[i].z), 0),
            descent: data.slice(1).reduce((sum, point, i) => sum + Math.max(0, data[i].z - point.z), 0)
        };
    });
    assert.ok(result.comparisons.length > 100);
    for (const pair of result.comparisons) assert.ok(Math.abs(pair.actual - pair.expected) <= 0.0051);
    for (const name of ['ascent', 'descent']) {
        const text = await this.page.locator(`.elevation-summary .${name} .summaryvalue`).innerText();
        assert.equal(text.replace(/\s+/g, ' '), `${Math.round(result[name])} m`);
    }
});

Then('the speed profile converts the timed track to knots', async function () {
    const comparisons = await this.page.evaluate(() => controlElevation._data.slice(1).map((point, i) => {
        const previous = controlElevation._data[i];
        return {
            actual: point.speed,
            expected: (point.dist - previous.dist) / ((point.time - previous.time) / 3600000) / 1.852
        };
    }).filter(pair => Number.isFinite(pair.expected)));
    assert.ok(comparisons.length > 100);
    assert.ok(comparisons.some(pair => pair.actual > 10));
    for (const pair of comparisons) assert.ok(Math.abs(pair.actual - pair.expected) <= 0.0051);
});

Then("the temperature profile shows the default parser's integer GPX sensor readings", async function () {
    const gpx = await readFile(fixturePath('atemp.gpx'), 'utf8');
    const readings = [...gpx.matchAll(/<trkpt\b[^>]*>([\s\S]*?)<\/trkpt>/g)].map(match => {
        const value = match[1].match(/<gpxtpx:atemp>([^<]+)<\/gpxtpx:atemp>/);
        return value ? Number(value[1]) : null;
    });
    const actual = await this.page.evaluate(() => controlElevation._data.map(point => point.temperature));
    assert.ok(readings.length > 100);
    assert.equal(actual.length, readings.length);
    assert.ok(readings.some(value => value !== null && !Number.isInteger(value)));
    // Default Utils.parseNumeric truncates fractions; missing readings retain the previous value.
    let previous;
    for (const [i, value] of readings.entries()) {
        assert.ok(Number.isFinite(actual[i]), `Missing temperature at point ${i}`);
        const expected = value === null ? previous : Math.trunc(value) + 0;
        assert.equal(actual[i] + 0, expected, `Parsed temperature mismatch at point ${i}`);
        if (value !== null) assert.ok(Math.abs(expected - value) < 1, `Quantization mismatch at point ${i}`);
        previous = expected;
    }
    assert.equal(Math.min(...actual), -10);
    assert.equal(Math.max(...actual), 6);
});

Then('the {string} profile summary uses {string} units', async function (name, unit) {
    const result = await this.page.evaluate(name => {
        const values = controlElevation._data.map(point => point[name]);
        return {
            min: Math.min(...values), max: Math.max(...values),
            avg: values.reduce((sum, value) => sum + value, 0) / values.length,
            path: controlElevation._chart._paths[name].getAttribute('d'),
            hidden: controlElevation._chart._paths[name].classList.contains('leaflet-hidden')
        };
    }, name);
    assert.match(result.path, /^M.*L/);
    assert.equal(result.hidden, false);
    const suffix = name === 'temperature' ? 'temp' : name;
    for (const stat of ['min', 'max', 'avg']) {
        const text = await this.page.locator(`.elevation-summary .${stat}${suffix} .summaryvalue`).innerText();
        assert.equal(text.replace(/\s+/g, ' '), `${Math.round(result[stat])} ${unit}`);
    }
});
