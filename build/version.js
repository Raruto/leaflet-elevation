import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const version = process.env.npm_new_version;
const npmCli = process.env.npm_execpath;
if (!version || !npmCli) throw new Error('Run this script through npm version');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, options);
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`${command} terminated by ${result.signal}`);
  return result;
}

if (run(process.execPath, [npmCli, 'whoami'], { stdio: 'inherit' }).status !== 0) {
  if (run(process.execPath, [npmCli, 'login'], { stdio: 'inherit' }).status !== 0 ||
      run(process.execPath, [npmCli, 'whoami'], { stdio: 'inherit' }).status !== 0) {
    throw new Error('npm authentication failed');
  }
}

const root = fileURLToPath(new URL('../', import.meta.url));
const { name } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const search = run('git', ['grep', '-IlzF', '--', `${name}@`], { cwd: root, encoding: 'utf8' });
if (search.status !== 0 && search.status !== 1) throw new Error(`git grep failed: ${search.stderr}`);
const pattern = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}@[0-9][0-9A-Za-z.+-]*`, 'g');
const changed = [];
for (const path of search.stdout.split('\0').filter(Boolean)) {
  const file = resolve(root, path);
  const contents = readFileSync(file, 'utf8');
  const updated = contents.replace(pattern, `${name}@${version}`);
  if (updated !== contents) {
    writeFileSync(file, updated);
    changed.push(path);
  }
}
if (changed.length && run('git', ['add', '--', ...changed], { cwd: root, stdio: 'inherit' }).status !== 0) {
  throw new Error('Could not stage version reference updates');
}
