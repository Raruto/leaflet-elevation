import { After, AfterAll, Before, setDefaultTimeout } from '@cucumber/cucumber';
import { startServer } from '../../build/server.js';

setDefaultTimeout(60000);

let server;
let base;

Before(async function ({ pickle }) {
    if (!pickle.tags.some(tag => tag.name === '@unit') && !server) {
        server = await startServer(0);
        base = `http://127.0.0.1:${server.address().port}`;
    }
    this.base = base;
    this.errors = [];
});

After(async function () {
    this.releaseData?.();
    await this.browser?.close();
});

AfterAll(async function () {
    if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});
