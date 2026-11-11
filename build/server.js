import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const contentTypes = {
    '.css': 'text/css',
    '.geojson': 'application/geo+json',
    '.gpx': 'application/gpx+xml',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.kml': 'application/vnd.google-earth.kml+xml',
    '.md': 'text/markdown',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.tcx': 'application/vnd.garmin.tcx+xml',
    '.txt': 'text/plain',
    '.xml': 'text/xml',
};

export function rewritePluginUrls(html) {
    return html
        .replace(/https?:\/\/[^/\s"'`?#]+\/(?:[^/\s"'`?#]+\/)*(?:@raruto\/|%40raruto%2f)leaflet-elevation(?:@[^/\s"'?#]+)?(?=\/|[?#"'`\s])/gi,
            (match, offset, source) => source[offset + match.length] === '/' ? '' : '/dist/leaflet-elevation.min.js')
        .replace(/(["'`])@raruto\/leaflet-elevation(?:@[^/\s"'?#]+)?(?=\/|[?#"'`\s])/g,
            (match, quote, offset, source) => quote + (source[offset + match.length] === '/' ? '' : '/dist/leaflet-elevation.min.js'));
}

export function startServer(port = 8080, { localCdn = false } = {}) {
    const server = createServer(async (request, response) => {
        let filename;
        try {
            filename = resolve(root, `.${decodeURIComponent(new URL(request.url, 'http://localhost').pathname)}`);
        } catch {
            response.writeHead(400).end('Bad request');
            return;
        }

        const pathFromRoot = relative(root, filename);
        if (pathFromRoot.startsWith(`..${sep}`) || pathFromRoot === '..') {
            response.writeHead(403).end('Forbidden');
            return;
        }

        try {
            if ((await stat(filename)).isDirectory()) {
                const entries = await readdir(filename, { withFileTypes: true });
                const base = new URL(request.url, 'http://localhost').pathname.replace(/\/?$/, '/');
                const links = entries.map(entry => {
                    const name = entry.name.replace(/[&<>"']/g, char => ({
                        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
                    })[char]);
                    const href = `${base}${encodeURIComponent(entry.name)}${entry.isDirectory() ? '/' : ''}`;
                    return `<li><a href="${href}">${name}${entry.isDirectory() ? '/' : ''}</a></li>`;
                }).join('');
                response.writeHead(200, { 'Content-Type': 'text/html' });
                response.end(`<ul>${links}</ul>`);
                return;
            }
            let content = await readFile(filename);
            if (localCdn) {
                response.setHeader('Cache-Control', 'no-store');
                if (extname(filename) === '.html') {
                    content = Buffer.from(rewritePluginUrls(content.toString()));
                }
            }
            response.writeHead(200, { 'Content-Type': contentTypes[extname(filename)] || 'application/octet-stream' });
            response.end(content);
        } catch (error) {
            if (error.code === 'ENOENT' || error.code === 'EISDIR') {
                response.writeHead(404).end('Not found');
            } else {
                console.error(error);
                response.writeHead(500).end('Internal server error');
            }
        }
    });

    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
            server.off('error', reject);
            resolve(server);
        });
    });
}
