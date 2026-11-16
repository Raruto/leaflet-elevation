import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { mkdtemp, readFile, rm, rmdir, unlink, writeFile } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Then } from '@cucumber/cucumber';
import { chromium } from 'playwright';
import { rewritePluginUrls, startServer } from '../../build/server.js';
import { fixturePath } from '../support/browser.js';
import { cachedAsset, missingAssets, useCachedUnpkg } from '../support/unpkg.js';
import { prepareIntegration } from '../../build/prepareIntegration.js';

Then('integration preparation builds city mapper once and propagates setup failures', async function () {
    const keys = ['CI', 'LEAFLET_CITY_MAPPER_FOLDER'];
    const saved = new Map(keys.map(key => [key, process.env[key]]));
    const spawn = childProcess.spawnSync, folders = [], calls = [];
    let failed = false;
    childProcess.spawnSync = (command, args, options) => {
        calls.push({ command, args, options });
        if (command === 'git') folders.push(args.at(-1));
        return { status: failed ? 1 : 0 };
    };
    syncBuiltinESMExports();
    try {
        for (const key of keys) delete process.env[key];
        await prepareIntegration();
        assert.equal(calls.length, 0);
        process.env.CI = 'true';
        await prepareIntegration();
        assert.equal(calls.length, 3);
        assert.deepEqual(calls[0].args.slice(0, -1), [
            'clone', '--depth', '1', '--branch', 'master', 'https://github.com/Raruto/leaflet-city-mapper.git',
        ]);
        assert.deepEqual(calls.slice(1).map(call => call.args), [['ci'], ['run', 'build']]);
        assert.ok(calls.slice(1).every(call => call.options.cwd === folders[0]));
        assert.equal(process.env.LEAFLET_CITY_MAPPER_FOLDER, join(folders[0], 'dist'));
        await prepareIntegration();
        assert.equal(calls.length, 3, 'Explicit bundles must not be cloned or rebuilt');
        delete process.env.LEAFLET_CITY_MAPPER_FOLDER;
        failed = true;
        await assert.rejects(prepareIntegration(), /Integration setup failed: git/);
        assert.equal(process.env.LEAFLET_CITY_MAPPER_FOLDER, undefined);
    } finally {
        childProcess.spawnSync = spawn;
        syncBuiltinESMExports();
        for (const [key, value] of saved) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        for (const folder of folders) await rm(folder, { recursive: true, force: true });
    }
});

Then('the development server serves only the selected city mapper bundles', async function () {
    const directory = await mkdtemp(join(tmpdir(), 'elevation-city-mapper-'));
    const names = ['leaflet-city-mapper.js', 'leaflet-city-mapper-worker.js'];
    let server;
    try {
        for (const name of names) await writeFile(join(directory, name), name);
        server = await startServer(0, { localCdn: true, cityMapperDist: directory });
        const base = `http://127.0.0.1:${server.address().port}`;
        const html = await (await fetch(`${base}/examples/leaflet-elevation_city-mapper.html`)).text();
        assert.ok(html.includes('src="/__city-mapper/leaflet-city-mapper.js"'));
        assert.ok(!html.includes('https://unpkg.com/leaflet-city-mapper@'), 'The upcoming CDN version must also be rewritten');
        for (const name of names) {
            const response = await fetch(`${base}/__city-mapper/${name}`);
            assert.equal(response.status, 200);
            assert.equal(await response.text(), name);
        }
        assert.equal((await fetch(`${base}/__city-mapper/other.js`)).status, 404);
    } finally {
        if (server) {
            server.closeAllConnections();
            await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        }
        for (const name of names) await unlink(join(directory, name));
        await rmdir(directory);
    }
});

Then('the development server rewrites static and plugin loader URLs', async function () {
    const server = await startServer(0, { localCdn: true });
    let browser;
    try {
        browser = await chromium.launch();
        const context = await browser.newContext();
        await useCachedUnpkg(context);
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

        await page.goto(`${base}/examples/leaflet-elevation.html`);
        await page.waitForFunction(() => typeof controlElevation !== 'undefined' && controlElevation?._data.length > 0);

        const urls = JSON.parse(rewritePluginUrls(JSON.stringify([
            'https://unpkg.com/@raruto/leaflet-elevation@3.0.1/src/index.js?cache=1',
            'https://cdn.jsdelivr.net/npm/@raruto/leaflet-elevation@3.0.1/dist/leaflet-elevation.css',
            'https://unpkg.com/%40raruto%2Fleaflet-elevation@2.9.2/src/index.js',
            '@raruto/leaflet-elevation@3.0.1/src/index.js',
            'https://unpkg.com/@raruto/leaflet-elevation@3.0.1',
            'https://unpkg.com/@raruto/leaflet-elevation@3.0.1/does-not-exist.js',
            'https://unpkg.com/unrelated-package@1/test.txt',
        ])));
        const assets = await page.evaluate(async urls => {
            return Promise.all(urls.map(async url => {
                const response = await fetch(url);
                return { url, status: response.status, text: await response.text() };
            }));
        }, urls);
        const index = await readFile(new URL('../../src/index.js', import.meta.url), 'utf8');
        const css = await readFile(new URL('../../dist/leaflet-elevation.css', import.meta.url), 'utf8');
        const bundle = await readFile(new URL('../../dist/leaflet-elevation.min.js', import.meta.url), 'utf8');
        assert.deepEqual(assets, [
            { url: '/src/index.js?cache=1', status: 200, text: index },
            { url: '/dist/leaflet-elevation.css', status: 200, text: css },
            { url: '/src/index.js', status: 200, text: index },
            { url: '/src/index.js', status: 200, text: index },
            { url: '/dist/leaflet-elevation.min.js', status: 200, text: bundle },
            { url: '/does-not-exist.js', status: 404, text: 'Not found' },
            { url: 'https://unpkg.com/unrelated-package@1/test.txt', status: 200, text: 'external' },
        ]);
        assert.deepEqual(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0);
        assert.deepEqual(errors, []);
    } finally {
        await browser?.close();
        server.closeAllConnections();
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
});

Then('unpkg resources are served from the predownloaded cache', async function () {
    const browser = await chromium.launch();
    try {
        const context = await browser.newContext();
        await context.route('https://unpkg.com/**', route => route.abort());
        await useCachedUnpkg(context);
        const page = await context.newPage();
        await page.goto(this.base);
        const { name } = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
        const legacyIcon = `${name}@2.9.0/images/elevation-locate.png`;
        for (const asset of [
            'leaflet@1.9.4/dist/leaflet.js',
            'leaflet@1.9.4/dist/images/marker-icon.png',
            'leaflet@1.9.4/dist/images/marker-shadow.png',
            'leaflet-ui@0.8.1/dist/locales/en-US.js',
            'leaflet-ui@0.8.1/dist/locales/en.js',
            legacyIcon,
        ]) {
            const response = await page.evaluate(async asset => {
                const response = await fetch(`https://unpkg.com/${asset}`);
                return { status: response.status, bytes: [...new Uint8Array(await response.arrayBuffer())] };
            }, asset);
            assert.equal(response.status, 200, asset);
            const file = asset === legacyIcon ? new URL('../../images/elevation-locate.png', import.meta.url) : cachedAsset(asset);
            assert.deepEqual(Buffer.from(response.bytes), await readFile(file), asset);
        }
        const missing = 'unlisted-package@1.0.0/missing.js';
        const status = await page.evaluate(async url => (await fetch(url)).status, `https://unpkg.com/${missing}`);
        assert.equal(status, 404);
        assert.ok(missingAssets.delete(missing), 'Missing resources must be reported');
    } finally {
        await browser.close();
    }
});
