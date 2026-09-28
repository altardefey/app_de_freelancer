const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
const findings = new Set();
let scanned = 0;
function scan(content, file) {
  if (content.includes('\0')) return;
  scanned++;
  const checks = [
    ['chave privada', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ['chave secreta supabase', /sb_secret_[A-Za-z0-9_-]{15,}/],
    ['token github', /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/],
    ['token de serviço', /(?:sk_live_|sk-proj-)[A-Za-z0-9_-]{20,}/],
    ['credencial na conexão', /postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]{5,}@/],
    ['secret atribuído', /(?:service_role_key|client_secret|jwt_secret|database_password)\s*[:=]\s*["'][A-Za-z0-9_\-./+=]{20,}["']/i],
  ];
  for (const [label, pattern] of checks) if (pattern.test(content)) findings.add(`${file}: ${label}`);
  for (const token of content.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) ?? []) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
      if (payload.role !== 'anon') findings.add(`${file}: jwt não público`);
    } catch { /* ignora exemplos que não são jwt de verdade */ }
  }
}
// olha os arquivos atuais e todos os blobs alcançáveis no histórico, sem imprimir valores
for (const file of git(['ls-files', '--cached', '--others', '--exclude-standard']).trim().split('\n')) {
  if (!file) continue;
  try { scan(readFileSync(path.join(root, file), 'utf8'), file); } catch { /* pode ser um arquivo removido */ }
}
const objects = git(['rev-list', '--objects', '--all']).trim().split('\n');
const sizes = git(['cat-file', '--batch-all-objects', '--batch-check=%(objectname) %(objecttype) %(objectsize)']).trim().split('\n');
const blobs = new Set(sizes.filter(line => / blob /.test(line) && Number(line.split(' ')[2]) < 2000000).map(line => line.split(' ')[0]));
for (const line of objects) {
  const [oid, ...parts] = line.split(' ');
  if (blobs.has(oid)) scan(git(['cat-file', 'blob', oid]), `histórico ${oid.slice(0, 8)} ${parts.join(' ')}`);
}
console.log(`Verificados ${scanned} arquivos/blobs de texto. Valores de credenciais não são exibidos.`);
for (const finding of findings) console.log(finding);
console.log(findings.size ? `${findings.size} possíveis exposições para revisar.` : 'Nenhum segredo reconhecido pelos padrões da verificação.');
process.exitCode = findings.size ? 1 : 0;
