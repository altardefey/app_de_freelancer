const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.join(__dirname, '../dist');
const scripts = path.join(root, '_inline');
fs.mkdirSync(scripts, { recursive: true });
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) walk(file);
    else if (file.endsWith('.html')) {
      // tira os scripts inline pra csp não precisar liberar unsafe-inline
      const html = fs.readFileSync(file, 'utf8').replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (tag, attrs, code) => {
        if (/\bsrc\s*=|application\/(ld\+)?json/i.test(attrs) || !code.trim()) return tag;
        const name = `${createHash('sha256').update(code).digest('hex')}.js`;
        fs.writeFileSync(path.join(scripts, name), code);
        return `<script${attrs} src="/_inline/${name}"></script>`;
      });
      fs.writeFileSync(file, html);
    }
  }
}
walk(root);
