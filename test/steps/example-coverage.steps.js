import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { Given, Then } from '@cucumber/cucumber';
import { loadSources } from '@cucumber/cucumber/api';

Given('the HTML demonstration pages in the examples folder', async function () {
    this.exampleNames = (await readdir(new URL('../../examples/', import.meta.url)))
        .filter(name => name.endsWith('.html'));
    assert.ok(this.exampleNames.length > 0);
});

Then('each demonstration has at least one scenario tagged with its example name', async function () {
    for (const filename of this.exampleNames) {
        assert.match(filename, /^leaflet-elevation(?:_.+)?\.html$/);
        const name = filename.replace(/^leaflet-elevation_?/, '').replace(/\.html$/, '') || 'default';
        const tag = `@example-${name}`;
        const { plan, errors } = await loadSources({
            paths: ['test/features/**/*.feature'],
            defaultDialect: 'en',
            names: [],
            tagExpression: tag,
            order: 'defined'
        });
        assert.deepStrictEqual(errors, []);
        assert.ok(plan.length > 0, `${filename} needs a behavioral scenario tagged ${tag}`);
    }
});
