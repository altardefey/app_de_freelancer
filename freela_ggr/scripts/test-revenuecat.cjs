const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const id = "00000000-0000-0000-0000-000000000001";
const second = "00000000-0000-0000-0000-000000000002";
let callback,
  writes = [],
  fetched = [],
  responseBody,
  failFetch = false;
const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-only",
  REVENUECAT_SECRET_KEY: "test-only",
  REVENUECAT_WEBHOOK_AUTH: "Bearer test-webhook",
};
const client = {
  auth: {
    getUser: async (token) => ({
      data: { user: token === "valid-user" ? { id } : null },
      error: token !== "valid-user",
    }),
    admin: {
      getUserById: async (userId) => ({ data: { user: { id: userId } } }),
    },
  },
  rpc: async (name, row) => {
    assert.equal(name, "record_freela_subscription");
    writes.push(row);
    return { error: null };
  },
};
const source = ts.transpileModule(
  fs.readFileSync(
    path.join(__dirname, "../supabase/functions/revenuecat-sync/index.ts"),
    "utf8",
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
vm.runInNewContext(source, {
  exports: {},
  require: () => ({ createClient: () => client }),
  Deno: { env: { get: (key) => env[key] }, serve: (fn) => (callback = fn) },
  Response,
  Request,
  AbortSignal,
  Date,
  Set,
  fetch: async (url) => {
    fetched.push(url);
    return new Response(JSON.stringify(responseBody), {
      status: failFetch ? 503 : 200,
    });
  },
});
const request = (authorization, body = {}) =>
  callback(
    new Request("https://example.test", {
      method: "POST",
      headers: { authorization },
      body: JSON.stringify(body),
    }),
  );
(async () => {
  assert.equal((await request("Bearer invalid")).status, 401);
  assert.equal(writes.length, 0);
  const future = new Date(Date.now() + 86400000).toISOString();
  responseBody = {
    subscriber: {
      entitlements: {
        freela: { product_identifier: "monthly", expires_date: future },
      },
      subscriptions: { monthly: { is_sandbox: false } },
    },
  };
  assert.equal(
    (await request("Bearer valid-user", { user_id: second, active: true }))
      .status,
    200,
  );
  assert.equal(writes.at(-1).p_user_id, id); // ignora a conta e a permissão enviadas pelo cliente
  assert.equal(writes.at(-1).p_active, true);
  responseBody.subscriber.subscriptions.monthly.is_sandbox = true;
  await request("Bearer valid-user");
  assert.equal(writes.at(-1).p_active, false);
  env.REVENUECAT_ALLOW_SANDBOX = "true";
  await request("Bearer valid-user");
  assert.equal(writes.at(-1).p_active, true);
  responseBody = { subscriber: { entitlements: {}, subscriptions: {} } };
  await request(env.REVENUECAT_WEBHOOK_AUTH, {
    event: {
      type: "RENEWAL",
      app_user_id: id,
      entitlement_ids: ["freela"],
      expiration_at_ms: Date.now() + 86400000,
    },
  });
  assert.equal(writes.at(-1).p_active, false); // o conteúdo do evento não libera acesso sozinho
  fetched = [];
  await request(env.REVENUECAT_WEBHOOK_AUTH, {
    event: {
      type: "TRANSFER",
      transferred_from: [id],
      transferred_to: [second],
    },
  });
  assert.equal(fetched.length, 2);
  failFetch = true;
  const count = writes.length;
  assert.equal((await request("Bearer valid-user")).status, 503);
  assert.equal(writes.length, count); // uma falha de conexão não muda o acesso
  console.log(
    "PASS: verified identity, sandbox isolation, authoritative entitlements, transfers, retry-safe failure.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
