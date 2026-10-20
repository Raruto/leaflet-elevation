import { build } from './build.js';
import { startServer } from './server.js';

const server = await startServer();
let stopBuild;

try {
    stopBuild = await build({ watch: true });
    console.log('Serving on http://127.0.0.1:8080');
} catch (error) {
    await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
    throw error;
}

let stopping = false;
async function stop() {
    if (stopping) return;
    stopping = true;
    await stopBuild();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
