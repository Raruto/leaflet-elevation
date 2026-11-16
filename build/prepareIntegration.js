import { spawnSync } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function prepareIntegration() {
    if (process.env.LEAFLET_CITY_MAPPER_FOLDER || !process.env.CI) return;
    const folder = await mkdtemp(join(tmpdir(), 'elevation-city-mapper-'));
    for (const [command, args, options] of [
        ['git', ['clone', '--depth', '1', '--branch', 'master', 'https://github.com/Raruto/leaflet-city-mapper.git', folder], {}],
        [process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci'], { cwd: folder, shell: process.platform === 'win32' }],
        [process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { cwd: folder, shell: process.platform === 'win32' }],
    ]) {
        const result = spawnSync(command, args, { ...options, stdio: 'inherit' });
        if (result.error) throw result.error;
        if (result.status !== 0) throw new Error(`Integration setup failed: ${command} ${args.join(' ')} (exit ${result.status})`);
    }
    process.env.LEAFLET_CITY_MAPPER_FOLDER = join(folder, 'dist');
}
