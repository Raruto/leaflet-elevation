import { spawnSync } from 'node:child_process';
import { build } from './build.js';

await build();

for (const version of ['1', '2']) {
  console.log(`\nRunning tests with Leaflet v${version}.x`);
  const result = spawnSync(process.execPath, [
    'node_modules/@cucumber/cucumber/bin/cucumber.js',
    ...process.argv.slice(2),
  ], {
    env: { ...process.env, LEAFLET_VERSION: version },
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
}