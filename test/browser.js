import { it } from 'node:test';
import { chromium } from 'playwright';
import { startServer } from '../build/server.js';

/**
 * Browser-backed test suite using Node's built-in test runner.
 * 
 * Each browser test gets its own local server and browser.
 */
export function suite(url) {
    return (name, handler, timeout = 10000) =>
        it(`${url}: ${name}`, { timeout }, async () => {
            const server = await startServer();
            let browser;
            try {
                browser = await chromium.launch();
                const context = await browser.newContext();
                await context.route(/.html$/, mock_cdn_urls);
                const page = await context.newPage();
                page.on('console', msg => console.log(msg.text()));
                page.on('requestfailed', request => { console.log(request.failure().errorText, request.url()); });
                page.on('pageerror', exception => { console.log(exception); });
                await page.goto(new URL(url, 'http://127.0.0.1:8080').toString());
                await page.waitForLoadState('domcontentloaded');
                await handler({ page });
            } finally {
                await browser?.close();
                await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
            }
        });
}

/**
 * Replace CDN URLs with locally developed files within Network response.
 * 
 * @requires playwright
 */
async function mock_cdn_urls(route) {
    const response = await route.fetch();
    let body = await response.text();
    body = body.replace(new RegExp('https://unpkg.com/@raruto/leaflet-elevation@(.*?)/', 'g'), '../');
    body = body.replace(new RegExp('@raruto/leaflet-elevation@(.*?)/', 'g'), '../');
    await route.fulfill({ response, body, headers: response.headers() });
}