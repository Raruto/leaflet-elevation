import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const builds = [
    {
        entryPoints: ['src/index.js'],
        outfile: 'dist/leaflet-elevation.js',
        bundle: true,
        format: 'iife',
        platform: 'browser',
        sourcemap: true,
        define: { 'import.meta': 'null' },
    },
    {
        entryPoints: ['src/index.js'],
        outfile: 'dist/leaflet-elevation.min.js',
        bundle: true,
        format: 'iife',
        platform: 'browser',
        minify: true,
        define: { 'import.meta': 'null' },
    },
    {
        entryPoints: ['src/index.css'],
        outfile: 'dist/leaflet-elevation.css',
        bundle: true,
        external: ['../images/*.svg'],
    },
    {
        entryPoints: ['src/index.css'],
        outfile: 'dist/leaflet-elevation.min.css',
        bundle: true,
        minify: true,
        external: ['../images/*.svg'],
    },
    ...readdirSync('libs')
        .filter(f => /\.(js|css)$/.test(f) && !/\.min\./.test(f) && f !== 'fullpage.css')
        .map(f => ({
            entryPoints: [`libs/${f}`],
            outfile: `libs/${f.replace(/\.(js|css)$/, '.min.$1')}`,
            minify: true,
            allowOverwrite: true,
        })),
];

export async function build({ watch = false } = {}) {
    if (!watch) {
        await Promise.all(builds.map(options => esbuild.build(options)));
        return;
    }

    const contexts = await Promise.all(builds.map(options => esbuild.context(options)));
    await Promise.all(contexts.map(context => context.watch()));
    return () => Promise.all(contexts.map(context => context.dispose()));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    build().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
