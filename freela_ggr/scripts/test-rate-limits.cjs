const { PGlite } = require('@electric-sql/pglite');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql as
      $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    insert into auth.users values ('00000000-0000-0000-0000-000000000001'),
      ('00000000-0000-0000-0000-000000000002');
    create table public.budgets (id serial primary key, value text);
    create table public.profiles (id serial primary key, value text);
    create table public.services (id serial primary key, value text);
    create table public.completed_jobs (id serial primary key, value text);
    grant usage on schema public, auth to authenticated;
    grant all on all tables in schema public to authenticated;
    grant usage on all sequences in schema public to authenticated;
  `);
  const migration = readFileSync(join(__dirname, '../supabase/rate-limits.sql'), 'utf8');
  await db.exec(migration);
  await db.exec(migration); // confere se rodar de novo não quebra os triggers
  const actor = async n => db.exec(`set test.uid = '00000000-0000-0000-0000-00000000000${n}'`);
  const denied = async (sql, code) => {
    await assert.rejects(db.exec(sql), e => {
      assert.equal(e.code, code);
      if (code === 'PT429') assert.ok(JSON.parse(e.detail).retry_after_seconds > 0);
      return true;
    });
  };
  await actor(1);
  await db.exec('set role authenticated');
  for (let i = 0; i < 5; i++) await db.exec("insert into public.budgets(value) values ('ok')");
  await denied("insert into public.budgets(value) values ('blocked')", 'PT429');
  await denied('select * from private.write_rate_limits', '42501');
  await denied('delete from private.write_rate_limits', '42501');
  await db.exec('reset role');
  assert.equal((await db.query('select count(*)::int as n from public.budgets')).rows[0].n, 5);
  await db.exec(migration);
  await denied("insert into public.budgets(value) values ('still blocked')", 'PT429');
  await actor(2);
  await db.exec("insert into public.budgets(value) values ('other user')");
  await denied("insert into public.budgets(value) select 'batch' from generate_series(1,5)", 'PT429');
  assert.equal((await db.query('select count(*)::int as n from public.budgets')).rows[0].n, 6);
  await actor(1);
  await db.exec("update private.write_rate_limits set started_at = now() - interval '11 minutes'");
  await db.exec("insert into public.budgets(value) values ('expired')");
  for (let i = 0; i < 30; i++) await db.exec("update public.budgets set value='updated' where id=1");
  await denied("update public.budgets set value='blocked' where id=1", 'PT429');
  await db.exec("insert into public.completed_jobs(value) values ('job')");
  for (let i = 0; i < 10; i++) await db.exec("update public.completed_jobs set value='rating' where id=1");
  await denied("update public.completed_jobs set value='blocked' where id=1", 'PT429');
  await db.exec("set test.uid = ''; insert into public.profiles(value) values ('auth trigger')");
  await db.close();
  console.log('PASS: cotas, isolamento, expiração, lotes, rollback, permissões, reaplicação e criação pelo Auth.');
})().catch(error => { console.error(error); process.exitCode = 1; });
