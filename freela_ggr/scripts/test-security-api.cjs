const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
// carrega o código do servidor com o supabase simulado, sem tocar em contas reais
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
let user = null;
let failure = null;
const session = { access_token: 'access-test-token', refresh_token: 'refresh-test-token', expires_in: 3600 };
const original = Module._load;
Module._load = function (name, ...args) {
  if (name === '@supabase/supabase-js') return { createClient: () => ({ auth: {
    getUser: async () => ({ data: { user }, error: null }),
    refreshSession: async () => ({ data: { session: null, user: null } }),
    signInWithPassword: async () => ({ data: { session, user: { id: 'user-1', email: 'a@b.com', user_metadata: { private: 'do not leak' } } }, error: failure }),
    signUp: async () => ({ data: { session: null, user: { id: 'existing-or-new' } }, error: null }),
  } }) };
  return original.call(this, name, ...args);
};
const handler = require('../api/gateway.ts').default;
const validation = require('../src/security/validation.ts');
process.env.APP_ORIGIN = 'https://app.example.com';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
process.env.VERCEL = '1';
async function call(action, payload = {}, extra = {}) {
  const headers = {};
  let body;
  const response = { setHeader: (k,v) => headers[k] = v, end: value => body = JSON.parse(value) };
  await handler({ method: 'POST', headers: { origin: process.env.APP_ORIGIN, 'x-forwarded-proto': 'https', 'content-type': 'application/json', ...extra }, body: { action, payload } }, response);
  return { status: response.statusCode, headers, body };
}
(async () => {
  assert.equal((await call('session', {}, { origin: 'https://evil.example.com' })).status, 403);
  assert.equal((await call('session', {}, { 'x-forwarded-proto': 'http' })).status, 403);
  assert.equal((await call('session', {}, { 'content-type': 'text/plain' })).status, 415);
  assert.equal((await call('session', {}, { 'content-length': '20000' })).status, 413);
  assert.equal((await call('budgets')).status, 401);
  assert.equal((await call('login', { email: 'a@b.com', password: 'password' })).status, 400);
  const credentials = { email: 'a@b.com', password: 'Password123!', options: { captchaToken: 'test' } };
  assert.equal((await call('login', { ...credentials, role: 'admin' })).status, 400);
  const login = await call('login', credentials);
  assert.equal(login.status, 200);
  assert.match(login.headers['Cache-Control'], /no-store/);
  for (const cookie of login.headers['Set-Cookie']) {
    assert.match(cookie, /^__Host-/); assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/); assert.match(cookie, /SameSite=Lax/);
    assert.doesNotMatch(cookie, /Domain=/);
  }
  assert.doesNotMatch(JSON.stringify(login.body), /access-test|refresh-test|user_metadata|do not leak/);
  const logout = await call('logout');
  assert.equal(logout.status, 200);
  for (const cookie of logout.headers['Set-Cookie']) assert.match(cookie, /Max-Age=0/);
  failure = { code: 'PT429', details: '{"retry_after_seconds":60}', message: 'sensitive internal details' };
  const limited = await call('login', credentials);
  assert.equal(limited.status, 429); assert.doesNotMatch(JSON.stringify(limited.body), /sensitive/);
  assert.throws(() => validation.budgetInput({ client: 'a', service: 'b', value: '1', user_id: 'attacker' }));
  assert.equal(validation.budgetInput({ client: 'a', service: 'b', value: 'R$ 1', details: '' }).details, '');
  assert.deepEqual(validation.quoteInput({ id: '00000000-0000-0000-0000-000000000001', quoteAmount: 129.99 }), {
    id: '00000000-0000-0000-0000-000000000001', quote_amount: 129.99, quote_message: null,
  });
  assert.throws(() => validation.quoteInput({ id: '00000000-0000-0000-0000-000000000001', quoteAmount: 0 }));
  assert.throws(() => validation.rating(6));
  assert.throws(() => validation.uuid("' or true --"));
  assert.throws(() => validation.password('x'.repeat(73), true));
  console.log('PASS: csrf, https, corpo limitado, autenticação, cookies, respostas sem tokens, captcha obrigatório, validação e erros seguros.');
})().catch(error => { console.error(error); process.exitCode=1; });
