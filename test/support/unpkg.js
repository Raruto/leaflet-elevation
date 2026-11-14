import { existsSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cache = fileURLToPath(new URL('../../node_modules/.cache/unpkg/', import.meta.url));
export const assets = [
    '@tmcw/togeojson@7.1.3/dist/togeojson.umd.js',
    'leaflet-gpx@1.7.0/gpx.js',
    'leaflet-rotate@0.6.0/dist/leaflet-rotate.js',
    'leaflet-ui@0.8.1/dist/leaflet-ui.css',
    'leaflet-ui@0.8.1/dist/leaflet-ui.js',
    'leaflet-ui@0.8.1/dist/locales/en-US.js',
    'leaflet-ui@0.8.1/dist/locales/en.js',
    'leaflet-ui@0.8.1/dist/locales/it.js',
    'leaflet-ui@0.8.1/dist/images/leaflet-pegman/maps.gstatic.com/api-3cb_scout5.png',
    'leaflet-ui@0.8.1/dist/images/leaflet-pegman/maps.gstatic.com/pegman_v3runway-1x.png',
    'leaflet-ui@0.8.1/dist/images/leaflet-search/imagessearch-icon.png',
    'leaflet@1.9.4/dist/leaflet-src.js',
    'leaflet@1.9.4/dist/leaflet.css',
    'leaflet@1.9.4/dist/leaflet.js',
    'leaflet@1.9.4/dist/images/marker-icon.png',
    'leaflet@1.9.4/dist/images/marker-shadow.png',
    'leaflet@2.0.0-beta.3/dist/leaflet-global.js',
    'leaflet@2.0.0-beta.3/dist/leaflet.css',
];

export function cachedAsset(asset) {
    return join(cache, ...asset.split('/'));
}

export async function downloadAssets() {
    await Promise.all(assets.map(async asset => {
        const url = `https://unpkg.com/${asset}`;
        const filename = cachedAsset(asset);
        if (existsSync(filename) && statSync(filename).size) return;
        const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
        await mkdir(dirname(filename), { recursive: true });
        await writeFile(filename, Buffer.from(await response.arrayBuffer()));
    }));
}

export const missingAssets = new Set();

export async function useCachedUnpkg(page) {
    await page.route('https://unpkg.com/**', async route => {
        const asset = decodeURIComponent(new URL(route.request().url()).pathname.slice(1));
        const legacyIcon = /^@raruto\/leaflet-elevation@2\.9\.0\/images\/elevation-locate\.png$/.test(asset);
        if (!legacyIcon && !assets.includes(asset)) {
            missingAssets.add(asset);
            await route.fulfill({
                status: 404,
                body: `Uncached unpkg resource: ${asset}`,
                headers: { 'access-control-allow-origin': '*' },
            });
            return;
        }
        await route.fulfill({
            path: legacyIcon
                ? fileURLToPath(new URL('../../images/elevation-locate.png', import.meta.url))
                : cachedAsset(asset),
            headers: { 'access-control-allow-origin': '*' },
        });
    });
}
