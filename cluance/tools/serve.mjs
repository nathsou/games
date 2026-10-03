import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, extname, sep} from 'node:path';
const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const sharedRoot = resolve(root, '../shared');
const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp':'image/webp', '.json': 'application/json', '.svg':'image/svg+xml'};
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/similo' || pathname.startsWith('/similo/')) {
      res.writeHead(302, {Location:'/cluance/' + new URL(req.url, 'http://localhost').search}).end(); return;
    }
    const shared = pathname.startsWith('/shared/'), base = shared ? sharedRoot : root;
    const relative = shared ? pathname.slice('/shared'.length) : pathname.replace(/^\/cluance(?=\/|$)/, '') || '/';
    const path = resolve(base, '.' + relative);
    if (!path.startsWith(base + sep) && path !== base) { res.writeHead(403).end(); return; }
    const file = path === base || pathname.endsWith('/') ? resolve(path, 'index.html') : path;
    res.writeHead(200, {'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
    res.end(await readFile(file));
  } catch { res.writeHead(404).end('Not found'); }
}).listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log('Cluance: http://127.0.0.1:' + (process.env.PORT || 4173)));
