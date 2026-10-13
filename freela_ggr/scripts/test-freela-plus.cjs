const { PGlite } = require("@electric-sql/pglite");
const { readFileSync } = require("node:fs");
const assert = require("node:assert/strict");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    filename,
  );
const { parseAmount } = require("../src/security/quoteAmount.ts");
(async () => {
  for (const [text, expected] of [
    ["250,00", 25000],
    ["1.250,90", 125090],
    ["14,9", 1490],
    ["0,01", 1],
    ["R$ 99,99", 9999],
    ["1.5", null],
    ["-1", null],
    ["0", null],
    ["abc", null],
    ["10,001", null],
    ["99999999999", null],
  ])
    assert.equal(parseAmount(text), expected, text);
  const db = new PGlite();
  const sql = (name) => readFileSync("supabase/" + name, "utf8");
  await db.exec(
    "create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb); create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$; grant usage on schema public,auth to anon,authenticated;",
  );
  await db.exec(
    sql("schema.sql").replace('create extension if not exists "pgcrypto";', ""),
  );
  await db.exec(sql("security-hardening.sql"));
  await db.exec(sql("rate-limits.sql"));
  await db.exec(sql("freela-plus.sql"));
  await db.exec(sql("freela-plus.sql"));
  const a = "00000000-0000-0000-0000-000000000001";
  const b = "00000000-0000-0000-0000-000000000002";
  const c = "00000000-0000-0000-0000-000000000003";
  for (const [id, role] of [
    [a, "profissional"],
    [b, "profissional"],
    [c, "cliente"],
  ])
    await db.query("insert into auth.users values($1,$2)", [
      id,
      JSON.stringify({ role, services: [] }),
    ]);
  const act = async (id) =>
    db.exec(
      "reset role; set test.uid = '" +
        (id || "") +
        "'; set role " +
        (id ? "authenticated" : "anon"),
    );
  const input = (owner, n) =>
    "insert into public.professional_quotes(user_id,request_id,client,service,amount_cents) values('" +
    owner +
    "','10000000-0000-0000-0000-" +
    String(n).padStart(12, "0") +
    "','Cliente','Pintura',25000)";
  const denies = (statement, code) =>
    assert.rejects(db.exec(statement), (e) => {
      assert.equal(e.code, code);
      return true;
    });
  const usage = async () =>
    (await db.query("select public.freela_usage() as usage")).rows[0].usage;
  await act(a);
  for (let n = 1; n <= 5; n++) await db.exec(input(a, n));
  assert.equal((await usage()).used, 5);
  await denies(input(a, 6), "PT402");
  await denies(input(a, 1), "23505");
  assert.equal((await usage()).used, 5);
  await denies("update public.freela_subscriptions set active=true", "42501");
  await denies(
    "insert into public.freela_subscriptions(user_id,active) values('" +
      a +
      "',true)",
    "42501",
  );
  await denies("update private.quote_usage set used=0", "42501");
  await denies(
    "select public.record_freela_subscription('" +
      a +
      "', true, now()+interval '1 year', now())",
    "42501",
  );
  await denies("delete from public.professional_quotes", "42501");
  await denies(input(b, 7), "42501");
  await act(b);
  assert.equal(
    (await db.query("select * from public.professional_quotes")).rows.length,
    0,
  );
  assert.equal((await usage()).used, 0);
  await db.exec(input(b, 1)); // cada conta tem seus próprios identificadores de envio
  await act(c);
  await denies(input(c, 8), "42501");
  await db.exec("reset role");
  await db.query(
    "insert into public.freela_subscriptions(user_id,active,expires_at) values($1,true,now()+interval '1 month')",
    [a],
  );
  await act(a);
  for (let n = 6; n <= 12; n++) await db.exec(input(a, n));
  assert.equal((await usage()).premium, true);
  assert.equal((await usage()).used, 12);
  await db.exec(
    "reset role; update public.freela_subscriptions set expires_at=now()-interval '1 second'",
  );
  await act(a);
  assert.equal((await usage()).premium, false);
  await denies(input(a, 13), "PT402");
  // o mês novo renova a franquia sem apagar os orçamentos anteriores
  await db.exec(
    "reset role; update private.quote_usage set month=month-interval '1 month' where user_id='" +
      a +
      "'",
  );
  await act(a);
  assert.equal((await usage()).used, 0);
  await db.exec(input(a, 13));
  assert.equal((await usage()).used, 1);
  assert.equal(
    (await db.query("select * from public.professional_quotes")).rows.length,
    13,
  );
  await act(null);
  await denies("select public.freela_usage()", "42501");
  await denies("select * from public.professional_quotes", "42501");
  await db.exec("reset role");
  await db.query(
    "select public.record_freela_subscription($1,false,null,now()+interval '1 minute')",
    [a],
  );
  await db.query(
    "select public.record_freela_subscription($1,true,now()+interval '1 year',now())",
    [a],
  );
  assert.equal(
    (
      await db.query(
        "select active from public.freela_subscriptions where user_id=$1",
        [a],
      )
    ).rows[0].active,
    false,
  );
  await db.close();
  console.log(
    "PASS: 5/month, sixth blocked, retries, owner isolation, premium, expiry, month rollover, immutable usage, migration replay, currency parsing.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
