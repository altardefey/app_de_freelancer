-- roda depois de schema.sql, security-hardening.sql e rate-limits.sql
begin;
create table if not exists public.freela_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default false,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.freela_subscriptions enable row level security;
revoke all on public.freela_subscriptions from public, anon, authenticated;
grant select on public.freela_subscriptions to authenticated;
drop policy if exists subscription_own_read on public.freela_subscriptions;
create policy subscription_own_read on public.freela_subscriptions for select to authenticated using (user_id = (select auth.uid()));

create table if not exists public.professional_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  client text not null check (length(btrim(client)) between 1 and 120),
  service text not null check (length(btrim(service)) between 1 and 2000),
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 999999999),
  whatsapp text check (whatsapp is null or whatsapp ~ '^\d{10,11}$'),
  created_at timestamptz not null default now(),
  unique(user_id, request_id)
);
create index if not exists quotes_owner_date on public.professional_quotes(user_id, created_at desc);
alter table public.professional_quotes enable row level security;
revoke all on public.professional_quotes from public, anon, authenticated;
grant select on public.professional_quotes to authenticated;
grant insert (user_id,request_id,client,service,amount_cents,whatsapp) on public.professional_quotes to authenticated;
drop policy if exists quotes_read on public.professional_quotes;
create policy quotes_read on public.professional_quotes for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists quotes_insert on public.professional_quotes;
create policy quotes_insert on public.professional_quotes for insert to authenticated
with check (user_id = (select auth.uid()) and exists(select 1 from public.profiles where id = (select auth.uid()) and role = 'profissional'));

create schema if not exists private;
create table if not exists private.quote_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null,
  used integer not null default 0,
  primary key(user_id,month)
);
revoke all on private.quote_usage from public, anon, authenticated;

create or replace function private.enforce_quote_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  period date := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
  consumed integer;
  premium boolean;
begin
  if auth.uid() is null or auth.uid() <> new.user_id then
    raise insufficient_privilege using message = 'Quote owner must match authenticated user';
  end if;
  -- trava o contador pra dois envios juntos não passarem do limite mensal
  insert into private.quote_usage(user_id, month) values(new.user_id,period) on conflict do nothing;
  select used into consumed from private.quote_usage where user_id=new.user_id and month=period for update;
  if exists(select 1 from public.professional_quotes where user_id=new.user_id and request_id=new.request_id) then
    raise unique_violation using message = 'Quote already created';
  end if;
  select exists(select 1 from public.freela_subscriptions where user_id=new.user_id and active and (expires_at is null or expires_at > now())) into premium;
  if not premium and consumed >= 5 then
    raise sqlstate 'PT402' using message = 'Monthly quote limit reached';
  end if;
  update private.quote_usage set used=used+1 where user_id=new.user_id and month=period;
  new.created_at := now();
  return new;
end $$;
revoke all on function private.enforce_quote_quota() from public, anon, authenticated;
drop trigger if exists enforce_quote_quota on public.professional_quotes;
create trigger enforce_quote_quota before insert on public.professional_quotes for each row execute function private.enforce_quote_quota();

create or replace function public.freela_usage() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  owner uuid := auth.uid();
  period date := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
begin
  if owner is null then raise insufficient_privilege; end if;
  return jsonb_build_object(
    'used', coalesce((select used from private.quote_usage where user_id=owner and month=period),0),
    'limit',5,
    'premium',exists(select 1 from public.freela_subscriptions where user_id=owner and active and (expires_at is null or expires_at > now())),
    'resetsAt', ((period + interval '1 month')::timestamp at time zone 'America/Sao_Paulo')
  );
end $$;
revoke all on function public.freela_usage() from public, anon;
grant execute on function public.freela_usage() to authenticated;
-- só o servidor usa service_role pra atualizar a assinatura
grant select, insert, update on public.freela_subscriptions to service_role;
-- uma consulta antiga não pode sobrescrever uma confirmação mais recente
create or replace function public.record_freela_subscription(p_user_id uuid, p_active boolean, p_expires_at timestamptz, p_checked_at timestamptz)
returns void language sql security definer set search_path = '' as $$
  insert into public.freela_subscriptions as current (user_id, active, expires_at, updated_at)
  values (p_user_id, p_active, p_expires_at, p_checked_at)
  on conflict (user_id) do update set active=excluded.active, expires_at=excluded.expires_at, updated_at=excluded.updated_at
  where current.updated_at <= excluded.updated_at;
$$;
revoke all on function public.record_freela_subscription(uuid,boolean,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.record_freela_subscription(uuid,boolean,timestamptz,timestamptz) to service_role;
commit;
-- guarda os detalhes que o cliente escreveu no pedido
alter table public.budgets add column if not exists details text not null default '' check (length(details) <= 2000);
grant select (details), insert (details) on public.budgets to authenticated;
