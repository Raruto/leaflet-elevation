import { exec } from 'child_process';
import { chromium } from 'playwright';

/**
 * Start HTTP server 
 */
export async function setup(ctx) {
    ctx.localhost = 'http://localhost:8080';
    ctx.server = exec('http-server');
    ctx.browser = await chromium.launch();
    ctx.context = await ctx.browser.newContext();
    ctx.context.route(/.html$/, mock_cdn_urls);
    ctx.page = await ctx.context.newPage();
    return Promise.resolve();
}

/**
 * Stop HTTP server 
 */
export async function reset(ctx) {
    await ctx.context.close();
    await ctx.browser.close();
    ctx.server.kill(); 
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