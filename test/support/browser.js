import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Given, Then } from '@cucumber/cucumber';
import { chromium } from 'playwright';

export const fixturePath = name => fileURLToPath(new URL(`../../examples/${name}`, import.meta.url));

export async function localFixture(page, name) {
    await page.route(`**/${name}`, route => route.fulfill({ path: fixturePath(name) }));
}

export async function openExample(world, name) {
    await world.page.goto(`${world.base}/examples/leaflet-elevation${name ? `_${name}` : ''}.html`);
}

Given('a Chromium browser using the local plugin', async function () {
    this.browser = await chromium.launch();
    this.page = await this.browser.newPage();
    this.page.on('pageerror', error => this.errors.push(error.stack || error.message));
    await this.page.route(/\.html$/, async route => {
        const response = await route.fetch();
        let body = (await response.text()).replace(/https:\/\/unpkg.com\/@raruto\/leaflet-elevation@[^/]+\//g, '../');
        if (this.htmlTransform) body = this.htmlTransform(body);
        await route.fulfill({ response, body });
    });
});

Then('no browser errors have occurred', function () {
    assert.deepStrictEqual(this.errors, []);
});
