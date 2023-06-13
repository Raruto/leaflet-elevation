import { suite as uvu_suite } from 'uvu';
import { exec } from 'child_process';
import { chromium } from 'playwright';

process.on('exit', async () => {
    await globalThis.server.kill('SIGTERM');
})

/**
 * Start HTTP server 
 */
export async function setup(ctx) {
    if (!globalThis.server) {
        await new Promise((resolve) => {
            globalThis.server = exec('http-server');
            globalThis.server.stdout.on('data', (msg) => {
                // console.log(msg);
                // if (msg.toString().match(/Starting up/)) {
                if (msg.toString().indexOf('Hit CTRL-C to stop the server')) {
                    resolve();
                    // setTimeout(resolve, 1500);
                }
            });
        });
    }
    ctx.localhost = 'http://localhost:8080';
    ctx.browser = await chromium.launch();
    ctx.context = await ctx.browser.newContext();
    ctx.context.route(/.html$/, await mock_cdn_urls);
    ctx.page = await ctx.context.newPage();
}

/**
 * Stop HTTP server 
 */
export async function reset(ctx) {
    await ctx.context.close();
    await ctx.browser.close();
}

/**
 * Sample wrapper for uvu `suite`
 * 
 * @example start a new test session at: http://localhost:8080/examples/leaflet-elevation.html
 * 
 * ```js
 * const test = suite('examples/leaflet-elevation.html');
 * 
 * test('eledata_loaded', async ({ page }) => {
 *   const gpx = await page.evaluate(() => new Promise(resolve => {
 *     controlElevation.on('eledata_loaded', (gpx) => resolve(gpx));
 *   }));
 *   assert.is(gpx.name, 'via-emilia.gpx');
 * });
 * ```
 * 
 * @see https://github.com/lukeed/uvu
 */
export function suite() {
    const test = uvu_suite(...arguments);
    test.before(setup);
    test.after(reset);
    test.before.each(async ({ localhost, page }) => {
        page.on('requestfailed', request => { console.log(request.failure().errorText, request.url()); });
        page.on('pageerror', exception => { console.log(exception); });
        await page.goto((new URL(arguments[0], localhost)).toString());
        await page.waitForLoadState('domcontentloaded');
    });
    // augment uvu `test` function with a third parameter `timeout`
    return new Proxy(test, {
        apply: (object, _, argsList) => {
            return object(argsList[0], timeout(argsList[1], argsList[2]));
        }
    });
}

/**
 * Sets maximum execution time for a function 
 * 
 * @see https://github.com/lukeed/uvu/issues/33#issuecomment-879870292 
 */
function timeout(handler, ms = 10000) {
    return (ctx) => {
        let timer
        return Promise.race([
            handler(ctx),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('[TIMEOUT] Maximum execution time exceeded: ' + ms + 'ms')), ms) })
        ]).finally(() => { clearTimeout(timer) })
    }
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
    route.fulfill({ response, body, headers: response.headers() });
}