// @ts-check
import { test, expect, Route } from '@playwright/test';

test.describe('examples/leaflet-elevation.html', () => {

  test.beforeEach(async ({ page, context }) => {
    context.route(/.html$/, mock_cdn_urls);
    await page.goto('/examples/leaflet-elevation.html');
  });

  test('has title', async ({ page }) => {
    await expect(page).toHaveTitle(/leaflet-elevation\.js/);
  });

});

/**
 * Replace CDN URLs with locally developed files within Network response.
 */
async function mock_cdn_urls(route: Route) {
  const response = await route.fetch();
  let body = await response.text();
  body = body.replace(new RegExp('https://unpkg.com/@raruto/leaflet-elevation@(.*?)/', 'g'), '../');
  body = body.replace(new RegExp('@raruto/leaflet-elevation@(.*?)/', 'g'), '../');
  route.fulfill({ response, body, headers: response.headers() });
}