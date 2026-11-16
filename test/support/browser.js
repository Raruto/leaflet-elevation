import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Given, Then } from '@cucumber/cucumber';
import { chromium } from 'playwright';
import { useCachedUnpkg } from './unpkg.js';

export const fixturePath = name => fileURLToPath(new URL(`../../examples/${name}`, import.meta.url));

export const cityMapperBrowserOptions = {
    headless: true,
    ...(process.platform === 'win32' ? { channel: 'chromium' } : {}),
    args: process.platform === 'win32'
        ? ['--disable-gpu-process-for-dx12-info-collection']
        : ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
            '--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader',
            '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--disable-vulkan-surface'],
};

export async function mapTile(page, color = 'rgb(128, 100, 0)') {
    const image = await page.evaluate(color => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 512;
        const context = canvas.getContext('2d');
        context.fillStyle = color;
        context.fillRect(0, 0, 512, 512);
        return canvas.toDataURL('image/png').split(',')[1];
    }, color);
    return Buffer.from(image, 'base64');
}

export async function localFixture(page, name) {
    await page.route(`**/${name}`, route => route.fulfill({ path: fixturePath(name) }));
}

export async function openExample(world, name) {
    await world.page.goto(`${world.base}/examples/leaflet-elevation${name ? `_${name}` : ''}.html`);
}

export async function waitForMapBounds(page, bounds) {
    await page.waitForFunction(({ _southWest, _northEast }) => {
        const track = new L.Bounds(map.latLngToContainerPoint(_southWest), map.latLngToContainerPoint(_northEast));
        // Leaflet rounds projected coordinates to pixels when fitting the viewport.
        return !map._animatingZoom && !map._panAnim?._inProgress &&
            new L.Bounds([-1, -1], map.getSize().add([1, 1])).contains(track);
    }, bounds);
}

Given('a Chromium browser using the local plugin', async function () {
    this.browser = await chromium.launch();
    this.page = await this.browser.newPage();
    await useCachedUnpkg(this.page);
    this.page.on('pageerror', error => this.errors.push(error.stack || error.message));
    this.d3Requests = [];
    await this.page.route(/(?:\/d3(?:@|\/)|\/d3[^/]*\.js)/i, route => {
        this.d3Requests.push(route.request().url());
        return route.abort();
    });
    await this.page.route(/^https:\/\/unpkg\.com\/@raruto\/leaflet-elevation@[^/]+\//, async route => {
        const pathname = new URL(route.request().url()).pathname.replace(/^\/@raruto\/leaflet-elevation@[^/]+\//, '/');
        const response = await route.fetch({ url: this.base + pathname });
        assert.ok(response.ok(), `Failed to load local plugin resource: ${pathname} (${response.status()})`);
        await route.fulfill({
            response,
            headers: { ...response.headers(), 'access-control-allow-origin': '*' }
        });
    });
    await this.page.route(/\.html$/, async route => {
        const response = await route.fetch();
        let body = (await response.text()).replace(/https:\/\/unpkg.com\/@raruto\/leaflet-elevation@[^/]+\//g, '../');
        if (this.htmlTransform) body = this.htmlTransform(body);
        if (process.env.LEAFLET_VERSION === '2') {
            body = body
                .replace(/leaflet@[^/]+\/dist\/leaflet\.js/g, 'leaflet@2.0.0-beta.3/dist/leaflet-global.js')
                .replace('<head>', '<head><link rel="stylesheet" href="https://unpkg.com/leaflet@2.0.0-beta.3/dist/leaflet.css">');
        }
        await route.fulfill({ response, body });
    });
});

Then('no browser errors have occurred', function () {
    assert.deepStrictEqual(this.errors, []);
    assert.deepStrictEqual(this.d3Requests, [], 'The plugin must not request D3');
});
