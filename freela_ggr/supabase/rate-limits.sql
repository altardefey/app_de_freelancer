-- roda depois do schema.sql. pode rodar de novo sem zerar os contadores
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.write_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  started_at timestamptz not null,
  used integer not null,
  primary key (user_id, action)
);
alter table private.write_rate_limits enable row level security;
revoke all on private.write_rate_limits from public, anon, authenticated;

create or replace function private.enforce_write_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  action_key text := tg_table_name || ':' || tg_op;
  max_writes integer := tg_argv[0]::integer;
  window_size interval := make_interval(secs => tg_argv[1]::integer);
  observed_at timestamptz := clock_timestamp();
  bucket private.write_rate_limits%rowtype;
  wait_seconds integer;
begin
  -- o auth cria perfis sem usuário logado, assim como as tarefas administrativas
  -- as policies rls continuam bloqueando gravações de quem não está logado
  if actor is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- o upsert põe na fila as gravações do mesmo usuário e ação pra não furar o limite
  insert into private.write_rate_limits as limits (user_id, action, started_at, used)
  values (actor, action_key, observed_at, 1)
  on conflict (user_id, action) do update set
    started_at = case when limits.started_at + window_size <= observed_at
      then observed_at else limits.started_at end,
    used = case when limits.started_at + window_size <= observed_at
      then 1 else limits.used + 1 end
  returning * into bucket;

  if bucket.used > max_writes then
    wait_seconds := greatest(1, ceil(extract(epoch from
      bucket.started_at + window_size - observed_at))::integer);
    raise sqlstate 'PT429' using
      message = 'Limite temporário de ações atingido.',
      detail = json_build_object('retry_after_seconds', wait_seconds)::text;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.enforce_write_rate_limit() from public, anon, authenticated;

-- o after conta só as linhas gravadas e evita contar o mesmo upsert duas vezes
-- se der erro, desfaz a operação inteira, inclusive quando vem um lote
drop trigger if exists budgets_rate_insert on public.budgets;
create trigger budgets_rate_insert after insert on public.budgets
  for each row execute function private.enforce_write_rate_limit('5', '600');
drop trigger if exists budgets_rate_update on public.budgets;
create trigger budgets_rate_update after update on public.budgets
  for each row execute function private.enforce_write_rate_limit('30', '60');
drop trigger if exists jobs_rate_update on public.completed_jobs;
create trigger jobs_rate_update after update on public.completed_jobs
  for each row execute function private.enforce_write_rate_limit('10', '60');
drop trigger if exists profiles_rate_write on public.profiles;
create trigger profiles_rate_write after insert or update on public.profiles
  for each row execute function private.enforce_write_rate_limit('10', '60');
drop trigger if exists services_rate_write on public.services;
create trigger services_rate_write after insert or update or delete on public.services
  for each row execute function private.enforce_write_rate_limit('10', '60');
commit;
