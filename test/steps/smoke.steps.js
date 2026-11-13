import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { AfterAll, Before, Then } from '@cucumber/cucumber';
import { startServer } from '../../build/server.js';
import { chromium } from 'playwright';

const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const pluginName = manifest.name.split('/').pop();
const packagePath = manifest.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const packageCdn = new RegExp(`https://(?:unpkg\\.com/|cdn\\.jsdelivr\\.net/(?:npm/|gh/Raruto/))${packagePath}(?:@[^/\\s"\x27<>]+)?/`);
const bundleName = new RegExp(`^${pluginName}(?:-src|\\.min)?\\.js$`);
let server;
let browser;
let base;

Before({ tags: '@smoke', timeout: 30000 }, async function () {
  if (!server) {
    server = await startServer(0, { localCdn: true });
    base = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch();
  }
});

AfterAll(async function () {
  try {
    if (browser) await browser.close();
  } finally {
    if (server) await new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); });
  }
});

Then('all HTML examples are listed', function () {
  const examples = [];
  function collect(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) collect(file);
      else if (entry.isFile() && entry.name.endsWith('.html')) {
        examples.push(path.relative('examples', file).split(path.sep).join('/'));
      }
    }
  }
  collect('examples');
  const feature = readFileSync('test/features/smoke.feature', 'utf8');
  const listed = [...feature.matchAll(/^\s*\|\s*([^|]+\.html)\s*\|\s*$/gm)].map(match => match[1].trim());
  assert.ok(examples.length, 'No HTML examples found');
  assert.deepEqual(listed.sort(), examples.sort(), 'Update the examples table');
});

Then('development pages rewrite CDN URLs without changing files', { timeout: 30000 }, async function () {
  const origin = typeof base === 'string' ? base : this.baseUrl;
  const feature = readFileSync('test/features/smoke.feature', 'utf8');
  const examples = [...feature.matchAll(/^\s*\|\s*([^|]+\.html)\s*\|\s*$/gm)].map(match => match[1].trim());
  assert.ok(examples.length, 'No examples to check');
  const packageSpecifier = new RegExp('(["\x27`])' + packagePath + '(?:@[^/\\s"\x27<>]+)?/');
  for (const example of examples) {
    const file = path.join('examples', example);
    const original = readFileSync(file, 'utf8');
    const response = await fetch(`${origin}/examples/${example}`);
    assert.equal(response.status, 200, example);
    const html = await response.text();
    assert.doesNotMatch(html, packageCdn, example);
    assert.doesNotMatch(html, packageSpecifier, example);
    const external = original.match(/https?:\/\/[^\s"'<>`]+/g) || [];
    for (const url of external) {
      if (!packageCdn.test(url)) assert.ok(html.includes(url), `Changed external URL: ${url}`);
    }
    const assets = new Set([...html.matchAll(/["'`](\/[^"'`\s<>]+\.(?:js|css)(?:\?[^"'`\s<>]*)?)["'`]/g)].map(match => match[1]));
    assert.ok(assets.size, `No local assets in ${example}`);
    for (const asset of assets) {
      const result = await fetch(origin + asset);
      assert.equal(result.status, 200, `${example}: ${asset}`);
      const filename = path.resolve('.' + decodeURIComponent(new URL(origin + asset).pathname));
      assert.deepEqual(Buffer.from(await result.arrayBuffer()), readFileSync(filename), asset);
    }
    assert.equal(readFileSync(file, 'utf8'), original);
  }
});

Then('the example {string} loads without browser errors', { timeout: 30000 }, async function (example) {
  const page = await browser.newPage();
  const errors = [];
  let googleKeyWarning = false;
  let bundleLoaded = false;
  function isBundleResponse(response) {
    const url = new URL(response.url());
    return response.request().resourceType() === 'script' && response.status() >= 200 && response.status() < 300 &&
      url.origin === base && bundleName.test(path.posix.basename(url.pathname));
  }
  page.on('request', request => {
    if (packageCdn.test(request.url())) errors.push(`Unexpected plugin CDN request: ${request.url()}`);
  });
  page.on('pageerror', error => errors.push(`JavaScript: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') {
      if (message.text().includes('Google Maps JavaScript API error: ApiProjectMapError') ||
        message.text().startsWith('You are using this API without a key. See https://developers.google.com/maps/documentation/javascript/error-messages')) {
        googleKeyWarning = true;
      }
      else errors.push(`Console: ${message.text()}`);
    }
  });
  page.on('requestfailed', request => {
    const error = request.failure().errorText;
    if (request.resourceType() !== 'image' || error !== 'net::ERR_ABORTED') {
      errors.push(`Request: ${request.url()} (${error})`);
    }
  });
  page.on('response', response => {
    if (isBundleResponse(response)) bundleLoaded = true;
    if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  try {
    const url = `${base}/examples/${example.split('/').map(encodeURIComponent).join('/')}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 19000 });
    await Promise.all([
      bundleLoaded ? Promise.resolve() : page.waitForResponse(isBundleResponse, { timeout: 8000 }),
      page.locator('.leaflet-container').first().waitFor({ state: 'attached', timeout: 8000 }),
    ]);
    await page.waitForTimeout(1000);
    assert.ok(!errors.length, errors.join('\n'));
    if (googleKeyWarning) console.log('Google Maps API-key warning ignored: API key not configured');
  } catch (error) {
    if (errors.length) throw new Error(`${error.message}\n${errors.join('\n')}`, { cause: error });
    throw error;
  } finally {
    page.removeAllListeners();
    await page.close();
  }
});
