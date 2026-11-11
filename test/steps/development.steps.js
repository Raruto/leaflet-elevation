import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Then } from '@cucumber/cucumber';
import { chromium } from 'playwright';
import { startServer } from '../../build/server.js';
import { fixturePath } from '../support/browser.js';

Then('the development server serves local assets for static and dynamic CDN requests', async function () {
    const server = await startServer(0, { localCdn: true });
    let browser;
    try {
        browser = await chromium.launch();
        const context = await browser.newContext();
        await context.route(/^https:\/\/(?:unpkg\.com|cdn\.jsdelivr\.net)\/.*@raruto\/leaflet-elevation/, route => route.abort());
        await context.route('**/via-emilia.gpx', route => route.fulfill({ path: fixturePath('via-emilia.gpx') }));
        await context.route('https://unpkg.com/unrelated-package@1/test.txt', route => route.fulfill({
            body: 'external', headers: { 'access-control-allow-origin': '*' },
        }));
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const base = `http://127.0.0.1:${server.address().port}`;

        await page.goto(`${base}/examples/leaflet-elevation_almost-over.html?sample=kept#view`);
        await page.waitForFunction(() => typeof controlElevation !== 'undefined' && controlElevation?._data.length > 0);
        assert.equal(page.url(), `${base}/examples/leaflet-elevation_almost-over.html?sample=kept#view`);
        assert.match(await page.evaluate(async () => (await fetch('/examples/leaflet-elevation.html')).text()), /leaflet-elevation\.min\.js/);

        const assets = await page.evaluate(async () => {
            const urls = [
                'https://unpkg.com/@raruto/leaflet-elevation@2.9.2/src/options.js?cache=1',
                'https://cdn.jsdelivr.net/npm/@raruto/leaflet-elevation@1.2.3/dist/leaflet-elevation.css',
                'https://unpkg.com/%40raruto%2Fleaflet-elevation@2.9.2/src/options.js',
                'https://unpkg.com/@raruto/leaflet-elevation@2.9.2',
                'https://unpkg.com/@raruto/leaflet-elevation@2.9.2/does-not-exist.js',
                'https://unpkg.com/unrelated-package@1/test.txt',
            ];
            return Promise.all(urls.map(async url => {
                const response = await fetch(url);
                return { status: response.status, text: await response.text() };
            }));
        });
        const options = await readFile(new URL('../../src/options.js', import.meta.url), 'utf8');
        const css = await readFile(new URL('../../dist/leaflet-elevation.css', import.meta.url), 'utf8');
        const bundle = await readFile(new URL('../../dist/leaflet-elevation.min.js', import.meta.url), 'utf8');
        assert.deepEqual(assets, [
            { status: 200, text: options },
            { status: 200, text: css },
            { status: 200, text: options },
            { status: 200, text: bundle },
            { status: 404, text: 'Not found' },
            { status: 200, text: 'external' },
        ]);
        assert.ok(await page.evaluate(() => new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image.naturalWidth);
            image.onerror = () => reject(new Error('Local CDN image did not load'));
            image.src = 'https://unpkg.com/@raruto/leaflet-elevation@2.9.2/images/elevation-pushpin.svg';
        })));

        await page.goto(`${base}/examples/leaflet-elevation.html`);
        await page.waitForFunction(() => typeof controlElevation !== 'undefined' && controlElevation?._data.length > 0);
        assert.deepEqual(errors, []);
    } finally {
        await browser?.close();
        server.closeAllConnections();
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
});
