import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Then } from '@cucumber/cucumber';

const root = fileURLToPath(new URL('../../', import.meta.url));
const textExtensions = new Set(['.css', '.feature', '.htm', '.html', '.js', '.json', '.md', '.mjs', '.scss', '.sh', '.svg', '.ts', '.tsx', '.txt', '.xml', '.yaml', '.yml']);
const ignoredDirectories = new Set(['.git', 'dist', 'node_modules']);

Then('every versioned Leaflet UI reference matches the latest npm release', async function () {
    const response = await fetch('https://registry.npmjs.org/leaflet-ui/latest', {
        signal: AbortSignal.timeout(15000),
    });
    assert.ok(response.ok, `npm registry returned HTTP ${response.status}`);
    const { version } = await response.json();
    assert.equal(typeof version, 'string', 'npm registry response has no release version');
    assert.match(version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/, 'Invalid npm release version');

    const pending = [root];
    const outdated = [];
    while (pending.length) {
        const directory = pending.pop();
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            const path = join(directory, entry.name);
            if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) pending.push(path);
            if (!entry.isFile() || !textExtensions.has(extname(entry.name).toLowerCase())) continue;
            const contents = await readFile(path, 'utf8');
            const found = new Set();
            for (const match of contents.matchAll(/leaflet-ui@([^/\s"'`<>()[\]{};,]+)/g)) {
                if (match[1] !== version) found.add(match[1]);
            }
            if (found.size) outdated.push(`${relative(root, path)}: ${[...found].join(', ')}`);
        }
    }
    assert.ok(outdated.length === 0, `Latest leaflet-ui release is ${version}; update these references:\n${outdated.sort().join('\n')}`);
});
