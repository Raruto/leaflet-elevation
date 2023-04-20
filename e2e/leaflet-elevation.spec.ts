// @ts-check
import { test, expect, Route } from '@playwright/test';

/**
 * This is a common global (window) variable declared within each `*.html` example
 */
declare const controlElevation: typeof import('../src/control.js').Elevation;

test.describe('examples/leaflet-elevation.html', () => {

  // Proxy network resources. 
  test.beforeEach(async ({ page, context }) => {
    // page.on('console', (msg) => { console.log(msg);});
    context.route(/.html$/, mock_cdn_urls);
    await page.goto('/examples/leaflet-elevation.html');
  });

  // Wait until page is fully loaded.
  test.afterEach(async ({ page, context }) => {
    await expect(page).toHaveTitle(/leaflet-elevation\.js/);
  });

  test('eledata_loaded', async ({ page }) => {
    const gpx = await page.evaluate<any>(() => new Promise(resolve => {
      controlElevation.on('eledata_loaded', (gpx) => resolve(gpx));
    }));
    expect(gpx.name).toBe('via-emilia.gpx');
    expect(gpx.layer).toBeDefined();
    expect(gpx.track_info).toBeDefined();
    expect(gpx.track_info.distance).not.toBeNaN();
  });

});

async function mock_cdn_urls(route: Route) {
  const response = await route.fetch();
  let body = await response.text();
  body = body.replace(new RegExp('https://unpkg.com/@raruto/leaflet-elevation@(.*?)/', 'g'), '../');
  body = body.replace(new RegExp('@raruto/leaflet-elevation@(.*?)/', 'g'), '../');
  route.fulfill({ response, body, headers: response.headers() });
}