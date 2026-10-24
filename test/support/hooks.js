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

After(async function ({ result }) {
    this.releaseData?.();
    if (result.status === 'FAILED' && this.page) {
        console.error('Browser errors:', this.errors);
        console.error('Map state:', await this.page.evaluate(() => {
            if (typeof L === 'undefined' || typeof map === 'undefined' || !(map instanceof L.Map)) return null;
            return {
                size: map.getSize(),
                viewport: map.getContainer().getBoundingClientRect().toJSON(),
                bounds: map.getBounds(),
                zoom: map.getZoom(),
                zoomSnap: map.options.zoomSnap,
                animatingZoom: map._animatingZoom,
                panning: !!map._panAnim?._inProgress,
                group: typeof routes === 'undefined' ? null : {
                    loaded: routes._loadedCount,
                    bounds: routes.getBounds(),
                    selected: routes.getSelection()?._leaflet_id
                },
                tracks: typeof traces === 'undefined' ? null : traces.map(trace => ({
                    mapped: map.hasLayer(trace.gpx),
                    bounds: trace.gpx.getBounds()
                }))
            };
        }));
    }
    await this.browser?.close();
});

AfterAll(async function () {
    if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});
