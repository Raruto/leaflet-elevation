import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Given, When, Then } from '@cucumber/cucumber';
import { localFixture, openExample } from '../support/browser.js';

async function hoverProfile(page, fraction) {
    const box = await page.locator('.elevation-control .brush .overlay').boundingBox();
    assert.ok(box && box.width > 0 && box.height > 0);
    await page.mouse.move(box.x + box.width * fraction, box.y + box.height / 2);
}

async function groupTrackPoint(page, selected = false) {
    return page.evaluate(selected => {
        const candidates = selected ? [routes.getSelection()] : routes._layers.getLayers().filter(route => !route.isSelected());
        for (const route of candidates) for (const line of route.getLayers()) {
            const latlngs = line.getLatLngs().flat(Infinity);
            for (let i = 1; i < latlngs.length; i++) {
                const point = map.latLngToContainerPoint(latlngs[i]);
                const rect = map.getContainer().getBoundingClientRect();
                const x = Math.round(rect.left + point.x);
                const y = Math.round(rect.top + point.y);
                if (document.elementFromPoint(x, y) === line._path) {
                    window.interactionRoute = route;
                    window.interactionLine = line;
                    return { x, y };
                }
            }
        }
        throw new Error('No unobscured interactive point on the route');
    }, selected);
}

Given('the chart module loads only after the map track is visible', async function () {
    this.page.on('response', response => {
        if (/^https:\/\/unpkg\.com\/@raruto\/leaflet-elevation@[^/]+\/dist\/leaflet-elevation\.min\.js$/.test(response.url())) {
            this.pluginResponse = response;
        }
    });
    await this.page.route('**/src/components/chart.js', async route => {
        await this.page.waitForFunction(() => document.querySelector('path.elevation-polyline'));
        await route.continue();
    });
});

Then('the dynamically loaded plugin matches the local build', async function () {
    assert.ok(this.pluginResponse, 'leaflet-ui did not request the plugin bundle');
    assert.strictEqual(await this.pluginResponse.text(),
        await readFile(new URL('../../dist/leaflet-elevation.min.js', import.meta.url), 'utf8'));
    assert.strictEqual(await this.page.evaluate(() =>
        map.getSize().y === map.getContainer().clientHeight
    ), true);
});

Given('the interactive {string} example is ready', async function (name) {
    this.interactionExample = name;
    for (const filename of ['demo.geojson', 'via-emilia.gpx', 'via-aurelia.gpx']) {
        await localFixture(this.page, filename);
    }
    if (name === 'dynamic-runner') {
        await this.page.route('**/via-emilia.gpx', async route => {
            await this.page.waitForFunction(() =>
                typeof controlElevation !== 'undefined' &&
                typeof controlElevation.animate === 'function' &&
                typeof controlElevation._x === 'function' &&
                typeof controlElevation._y === 'function' &&
                controlElevation._marker
            );
            await route.fallback();
        });
    }
    await openExample(this, name);
    if (['hoverable-tracks', 'toggable-charts'].includes(name)) {
        await this.page.waitForFunction(() =>
            typeof routes !== 'undefined' && routes && routes._loadedCount === tracks.length && !map._animatingZoom
        );
        await this.page.waitForFunction(() => !map._panAnim?._inProgress && map.getBounds().contains(routes.getBounds()));
        await this.page.evaluate(() => new Promise(resolve => {
            let previous = '';
            let stable = 0;
            const frame = () => {
                const current = `${map.getCenter().lat},${map.getCenter().lng},${map.getZoom()}`;
                stable = current === previous ? stable + 1 : 0;
                previous = current;
                if (stable >= 5) resolve();
                else requestAnimationFrame(frame);
            };
            requestAnimationFrame(frame);
        }));
    } else {
        await this.page.locator('.elevation-control .brush .overlay').waitFor({ state: 'attached' });
        if (name !== 'follow-marker') {
            await this.page.waitForFunction(() => controlElevation._data.length > 0);
        }
        await this.page.waitForFunction(() =>
            [...document.querySelectorAll('.elevation-control .area path')].some(path => path.getAttribute('d')?.length > 10)
        );
        if (name === 'follow-marker') {
            await this.page.waitForFunction(() =>
                map.getZoom() > 5 && !map._animatingZoom && !map._panAnim?._inProgress
            );
        } else if (name === 'hidden-map') {
            await this.page.waitForFunction(() => controlElevation._layers.getLayers().some(layer => map.hasLayer(layer)));
        }
    }
    await this.page.mouse.move(0, 0);
    if (name === 'hoverable-tracks') {
        await this.page.evaluate(() => routes.setSelection(null));
        await this.page.waitForFunction(() =>
            routes.getSelection() === null &&
            document.querySelector('.chart-placeholder').style.display !== 'none'
        );
    }
});

When('I open, close and reopen the attached elevation chart', async function () {
    this.initialInteractionData = await this.page.evaluate(() => ({
        count: controlElevation._data.length,
        distance: controlElevation.track_info.distance,
        layers: controlElevation._layers.getLayers().length
    }));
    const control = this.page.locator('.elevation-control');
    const button = control.locator('.elevation-toggle-icon');
    assert.ok(!(await control.getAttribute('class')).includes('elevation-expanded'));
    // Focus is an intentional opening action; a subsequent click closes it.
    await button.focus();
    await this.page.locator('.elevation-control.elevation-expanded .brush .overlay').waitFor();
    await button.click();
    await this.page.waitForFunction(() => !document.querySelector('.elevation-control').classList.contains('elevation-expanded'));
    await button.click();
    await this.page.locator('.elevation-control.elevation-expanded .brush .overlay').waitFor();
    await this.page.keyboard.press('Escape');
    await this.page.waitForFunction(() => !document.querySelector('.elevation-control').classList.contains('elevation-expanded'));
    await button.click();
    await this.page.locator('.elevation-control.elevation-expanded .brush .overlay').waitFor();
});

Then('its track and chart data are preserved', async function () {
    const actual = await this.page.evaluate(() => ({
        count: controlElevation._data.length,
        distance: controlElevation.track_info.distance,
        layers: controlElevation._layers.getLayers().length
    }));
    assert.ok(actual.count > 0 && actual.distance > 0 && actual.layers > 0);
    assert.deepStrictEqual(actual, this.initialInteractionData);
});

Then('the animated runner advances on both the chart and map', async function () {
    await this.page.waitForFunction(() => document.querySelector('circle.runner') && controlElevation._marker.getLatLng());
    await this.page.evaluate(() => {
        window.runnerStart = {
            x: +document.querySelector('circle.runner').getAttribute('cx'),
            latlng: controlElevation._marker.getLatLng(),
            length: controlElevation._runner.getLatLngs().length
        };
    });
    await this.page.waitForFunction(() =>
        +document.querySelector('circle.runner').getAttribute('cx') > runnerStart.x &&
        controlElevation._marker.getLatLng().distanceTo(runnerStart.latlng) > 0 &&
        controlElevation._runner.getLatLngs().length >= runnerStart.length
    );
    const state = await this.page.evaluate(() => ({
        mapped: map.hasLayer(controlElevation._runner),
        x: +document.querySelector('circle.runner').getAttribute('cx'),
        expectedX: controlElevation._x(controlElevation._findItemForLatLng(controlElevation._marker.getLatLng()).dist),
        y: +document.querySelector('circle.runner').getAttribute('cy'),
        expectedY: controlElevation._y(controlElevation._findItemForLatLng(controlElevation._marker.getLatLng()).z),
        width: controlElevation._width()
    }));
    assert.strictEqual(state.mapped, true);
    assert.ok(Math.abs(state.x - state.expectedX) < 1);
    assert.ok(Math.abs(state.y - state.expectedY) < 1);
    assert.ok(state.x >= 0 && state.x <= state.width);
});

When('I resize the runner chart', async function () {
    await this.page.setViewportSize({ width: 1100, height: 720 });
    await this.page.waitForFunction(() =>
        document.querySelector('.elevation-control svg.background').textContent.includes('250 km')
    );
});

Then('the five distance checkpoints are displayed', async function () {
    const text = await this.page.locator('.elevation-control svg.background').textContent();
    for (const distance of [50, 100, 150, 200, 250]) assert.ok(text.includes(`${distance} km`));
});

When('I hover over two distant positions on the elevation profile', async function () {
    this.followPositions = [];
    for (const fraction of [0.2, 0.8]) {
        const before = await this.page.evaluate(() => ({ ...map.getCenter() }));
        await hoverProfile(this.page, fraction);
        await this.page.waitForFunction(before =>
            map.getZoom() === 15 && !map._animatingZoom && !map._panAnim?._inProgress &&
            map.getCenter().distanceTo(before) > 1000, before
        );
        this.followPositions.push(await this.page.evaluate(() => {
            const marker = document.querySelector('.height-focus-group .circle-lower').getBoundingClientRect();
            const container = map.getContainer().getBoundingClientRect();
            return {
                center: { ...map.getCenter() },
                zoom: map.getZoom(),
                markerVisible: !document.querySelector('.height-focus-group').classList.contains('leaflet-hidden'),
                markerOffset: Math.hypot(
                    marker.x + marker.width / 2 - container.x - container.width / 2,
                    marker.y + marker.height / 2 - container.y - container.height / 2
                )
            };
        }));
    }
});

Then('the map follows both positions at zoom 15', function () {
    assert.strictEqual(this.followPositions.length, 2);
    for (const state of this.followPositions) {
        assert.strictEqual(state.zoom, 15);
        assert.strictEqual(state.markerVisible, true);
        assert.ok(state.markerOffset < 3, `Hovered marker is ${state.markerOffset}px from the map center`);
    }
    assert.notDeepStrictEqual(this.followPositions[0].center, this.followPositions[1].center);
});

When('I hover over and then leave the chart icon', async function () {
    this.hiddenChartDistance = await this.page.evaluate(() => controlElevation.track_info.distance);
    assert.ok(!(await this.page.locator('.elevation-control').getAttribute('class')).includes('elevation-expanded'));
    const button = await this.page.locator('.elevation-toggle-icon').boundingBox();
    await this.page.mouse.move(button.x + 5, button.y + 5);
    await this.page.locator('.elevation-control.elevation-expanded .brush .overlay').waitFor();
    await hoverProfile(this.page, 0.5);
    await this.page.waitForFunction(() => map.getContainer().classList.contains('elechart-hover'));
    await this.page.mouse.move(0, 0);
});

Then('the chart is collapsed again with its track preserved', async function () {
    await this.page.waitForFunction(() => !document.querySelector('.elevation-control').classList.contains('elevation-expanded'));
    assert.strictEqual(await this.page.evaluate(() => controlElevation.track_info.distance), this.hiddenChartDistance);
    assert.ok(this.hiddenChartDistance > 0);
});

When('I hover over the hidden-map profile', async function () {
    assert.strictEqual(await this.page.locator('#map').evaluate(el => el.getBoundingClientRect().height), 0);
    await this.page.evaluate(() => controlElevation.on('elechart_change', event => {
        window.hiddenMapSample = event.data.latlng;
    }));
    await hoverProfile(this.page, 0.4);
});

Then('the map becomes visible', async function () {
    await this.page.waitForFunction(() =>
        map.getContainer().classList.contains('elechart-hover') &&
        map.getSize().y > 100 && getComputedStyle(map.getContainer()).opacity === '1' &&
        Math.abs(map.getSize().y - map.getContainer().getBoundingClientRect().height) < 1
    );
    const box = await this.page.locator('#map').boundingBox();
    assert.ok(box.height > 100);
});

When('I continue hovering over another hidden-map profile position', async function () {
    await hoverProfile(this.page, 0.6);
});

Then('the map centers on the hovered sample', async function () {
    await this.page.waitForFunction(() =>
        typeof hiddenMapSample !== 'undefined' && !map._panAnim?._inProgress &&
        map.latLngToContainerPoint(hiddenMapSample).distanceTo(map.getSize().divideBy(2)) < 2
    );
});

When('I leave the hidden-map profile', async function () {
    await this.page.mouse.move(0, 0);
});

Then('the map is hidden again', async function () {
    await this.page.waitForFunction(() =>
        !map.getContainer().classList.contains('elechart-hover') &&
        map.getContainer().getBoundingClientRect().height === 0 &&
        getComputedStyle(map.getContainer()).opacity === '0'
    );
});

When('I hover over an unselected group track', async function () {
    assert.strictEqual(await this.page.locator('.chart-placeholder').isVisible(), true);
    const point = await groupTrackPoint(this.page);
    await this.page.mouse.move(point.x, point.y);
});

Then('its profile replaces the placeholder and its legend is selected', async function () {
    await this.page.waitForFunction(() => {
        const legend = document.getElementById(`legend_${L.stamp(interactionRoute)}`);
        return routes.getSelection() === interactionRoute && routes._elevation._data.length > 0 &&
            document.querySelector('.chart-placeholder').style.display === 'none' &&
            legend && legend.parentNode.previousSibling.checked;
    });
    const state = await this.page.evaluate(() => ({
        checked: document.getElementById(`legend_${L.stamp(interactionRoute)}`).parentNode.previousSibling.checked,
        color: interactionLine.options.color,
        tooltip: interactionLine.getTooltip().getContent(),
        name: interactionRoute.options.name
    }));
    assert.strictEqual(state.checked, true);
    assert.strictEqual(state.color, '#ff0');
    assert.strictEqual(state.tooltip, state.name);
    await this.page.locator('.elevation-control .brush .overlay').waitFor();
});

When('I select a different route in the group legend', async function () {
    this.firstGroupProfile = await this.page.evaluate(() => routes._elevation.track_info.distance);
    const id = await this.page.evaluate(() => {
        window.nextInteractionRoute = routes._layers.getLayers().find(route => route !== interactionRoute);
        return `legend_${L.stamp(nextInteractionRoute)}`;
    });
    await this.page.locator(`label:has(#${id}) input`).check();
});

Then('the profile and highlight switch to that route', async function () {
    await this.page.waitForFunction(() => routes.getSelection() === nextInteractionRoute && routes._elevation._data.length > 0);
    const state = await this.page.evaluate(() => ({
        oldSelected: interactionRoute.isSelected(),
        selected: nextInteractionRoute.isSelected(),
        distance: routes._elevation.track_info.distance,
        oldColor: interactionLine.options.color,
        originalColor: interactionRoute.options.originalStyle.color,
        newColors: nextInteractionRoute.getLayers().map(line => line.options.color)
    }));
    assert.strictEqual(state.oldSelected, false);
    assert.strictEqual(state.selected, true);
    assert.notStrictEqual(state.distance, this.firstGroupProfile);
    assert.strictEqual(state.oldColor, state.originalColor);
    state.newColors.forEach(color => assert.strictEqual(color, '#ff0'));
});

When('I click an unselected group track', async function () {
    assert.strictEqual(await this.page.locator('.elevation-control').count(), 0);
    const point = await groupTrackPoint(this.page);
    await this.page.mouse.click(point.x, point.y);
});

Then('its elevation profile is shown', async function () {
    await this.page.waitForFunction(() => routes.getSelection() === interactionRoute && routes._elevation._data.length > 0);
    await this.page.locator('.elevation-control .brush .overlay').waitFor();
    assert.strictEqual(await this.page.evaluate(() => interactionRoute.isSelected()), true);
});

When('I click that group track again', async function () {
    const point = await groupTrackPoint(this.page, true);
    await this.page.mouse.click(point.x, point.y);
});

Then('its elevation profile is removed and its original color restored', async function () {
    await this.page.waitForFunction(() => routes.getSelection() === null && routes._elevation._data.length === 0);
    assert.strictEqual(await this.page.locator('.elevation-control').count(), 0);
    assert.strictEqual(await this.page.evaluate(() => interactionLine.options.color === interactionRoute.options.originalStyle.color), true);
});

When('I select the second track radio button', async function () {
    await this.page.waitForFunction(() => traces.length === 2 && traces.every(trace => trace.line) && controlLayer._layers.length === 2);
    this.firstTrackProfile = await this.page.evaluate(() => ({
        distance: controlElevation.track_info.distance,
        count: controlElevation._data.length
    }));
    assert.ok(this.firstTrackProfile.distance > 0);
    const name = await this.page.evaluate(() => traces[1].gpx.get_name());
    await this.page.getByLabel(name, { exact: true }).check();
});

Then('only the second track is mapped and its profile replaces the first', async function () {
    await this.page.waitForFunction(() =>
        map.hasLayer(traces[1].gpx) && !map.hasLayer(traces[0].gpx) &&
        map.getBounds().contains(traces[1].gpx.getBounds())
    );
    const state = await this.page.evaluate(() => ({
        distance: controlElevation.track_info.distance,
        count: controlElevation._data.length,
        bounds: map.getBounds().contains(traces[1].gpx.getBounds())
    }));
    assert.ok(state.count > 0);
    assert.ok(state.distance > this.firstTrackProfile.distance * 2);
    assert.strictEqual(state.bounds, true);
});

When('I select the first track radio button', async function () {
    const name = await this.page.evaluate(() => traces[0].gpx.get_name());
    await this.page.getByLabel(name, { exact: true }).check();
});

Then('the original track and elevation profile are restored', async function () {
    await this.page.waitForFunction(() => map.hasLayer(traces[0].gpx) && !map.hasLayer(traces[1].gpx));
    assert.deepStrictEqual(await this.page.evaluate(() => ({
        distance: controlElevation.track_info.distance,
        count: controlElevation._data.length
    })), this.firstTrackProfile);
});
