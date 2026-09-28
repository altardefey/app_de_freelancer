const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ts = require('typescript');
if (fs.existsSync('.env.local')) process.loadEnvFile('.env.local');
process.env.APP_ORIGIN = 'http://localhost:3000';
process.env.SUPABASE_URL ??= process.env.EXPO_PUBLIC_SUPABASE_URL;
process.env.SUPABASE_PUBLISHABLE_KEY ??= process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const handler = require('../api/gateway.ts').default;
const root = path.resolve(__dirname, '../dist');
const headers = require('../vercel.json').headers[0].headers;
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };
http.createServer(async (req, res) => {
  try {
    for (const header of headers) {
      if (header.key === 'Strict-Transport-Security') continue;
      res.setHeader(header.key, header.value.replace('; upgrade-insecure-requests', ''));
    }
    const pathname = new URL(req.url, 'http://localhost:3000').pathname;
    if (pathname === '/api/gateway') {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 16384) { res.statusCode = 413; res.end(); return; }
      }
      req.body = body;
      return await handler(req, res);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; return res.end(); }
    let file = path.resolve(root, '.' + decodeURIComponent(pathname));
    if (file !== root && !file.startsWith(root + path.sep)) { res.statusCode = 403; return res.end(); }
    if (file === root) file = path.join(root, 'index.html');
    if (!path.extname(file)) file += '.html';
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.statusCode = 404; return res.end(); }
    res.setHeader('Content-Type', mime[path.extname(file)] ?? 'application/octet-stream');
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  } catch { res.statusCode = 500; res.end('Não foi possível atender a solicitação.'); }
}).listen(3000, '127.0.0.1', () => console.log('Prévia com API local em http://localhost:3000'));
