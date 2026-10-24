import assert from 'node:assert/strict';
import { Given, When, Then } from '@cucumber/cucumber';

// Arithmetic helpers do not use Leaflet, but the module exports Leaflet aliases.
const previousLeaflet = globalThis.L;
let utils;
try {
    globalThis.L = { DomEvent: {}, Util: {}, DomUtil: {} };
    utils = await import('../../src/utils.js');
} finally {
    if (previousLeaflet === undefined) delete globalThis.L;
    else globalThis.L = previousLeaflet;
}

const statistics = {
    average: utils.iAvg,
    minimum: utils.iMin,
    maximum: utils.iMax,
    sum: utils.iSum
};

Given('an incremental {string} with no previous samples', function (name) {
    assert.ok(Object.hasOwn(statistics, name), `Unknown statistic: ${name}`);
    this.statistic = statistics[name];
    this.statisticValue = undefined;
    this.sampleCount = 0;
});

When('I add the samples {string} in order', function (samples) {
    this.statisticResults = samples.split(',').map(sample => {
        this.statisticValue = this.statistic(Number(sample.trim()), this.statisticValue, ++this.sampleCount);
        return { sample: sample.trim(), value: this.statisticValue };
    });
});

Then('the result after each sample rounded to two decimals is', function (table) {
    const rows = table.hashes();
    assert.strictEqual(this.statisticResults.length, rows.length);
    rows.forEach(({ sample, expected }, index) => {
        const actual = this.statisticResults[index];
        assert.strictEqual(actual.sample, sample);
        const message = `After sample ${index + 1} (${sample})`;
        if (expected === 'NaN') assert.ok(Number.isNaN(actual.value), message);
        else assert.strictEqual(+actual.value.toFixed(2), Number(expected), message);
    });
});
