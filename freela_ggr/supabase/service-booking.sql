-- roda depois do order-quotes.sql
begin;

-- tira a reserva do anúncio e deixa os pedidos que já existem como estão
drop index if exists public.freela_one_active_booking_per_service;
drop policy if exists services_public_read on public.services;
create policy services_public_read on public.services for select to anon, authenticated using (true);

create or replace function public.catalog_unavailable_providers(provider_ids uuid[]) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select q.user_id from private.quote_usage q
  where auth.uid() is not null and cardinality(provider_ids) <= 100
    and q.user_id = any(provider_ids)
    and q.month = date_trunc('month', now() at time zone 'America/Sao_Paulo')::date
    and q.used >= 10
    and exists (select 1 from public.services s where s.provider_id = q.user_id);
$$;
revoke all on function public.catalog_unavailable_providers(uuid[]) from public, anon;
grant execute on function public.catalog_unavailable_providers(uuid[]) to authenticated;

create or replace function private.require_available_service() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.services s
    join private.quote_usage q on q.user_id = s.provider_id
    where s.id = new.service_id
      and q.month = date_trunc('month', now() at time zone 'America/Sao_Paulo')::date
      and q.used >= 10
  ) then
    raise sqlstate 'PT409' using message = 'Serviço indisponível no momento. Tente novamente no próximo mês.';
  end if;
  return new;
end;
$$;
revoke all on function private.require_available_service() from public, anon, authenticated;
drop trigger if exists freela_require_available_service on public.budgets;
create trigger freela_require_available_service before insert on public.budgets
  for each row execute function private.require_available_service();

create or replace function private.use_registered_provider_name() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  registered_name text;
begin
  if new.provider_id is null or auth.uid() is null then return new; end if;
  select p.first_name into registered_name from public.profiles p where p.id = new.provider_id;
  if registered_name is null then
    raise sqlstate 'PT400' using message = 'Preencha seu primeiro nome na Conta antes de publicar.';
  end if;
  new.provider := registered_name;
  return new;
end;
$$;
revoke all on function private.use_registered_provider_name() from public, anon, authenticated;
drop trigger if exists freela_use_registered_provider_name on public.services;
create trigger freela_use_registered_provider_name before insert or update of provider on public.services
  for each row execute function private.use_registered_provider_name();

create or replace function public.catalog_provider_names(provider_ids uuid[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(p.id, p.first_name), '{}'::jsonb)
  from public.profiles p
  where auth.uid() is not null and cardinality(provider_ids) <= 100
    and p.id = any(provider_ids) and p.role = 'profissional' and p.first_name is not null
    and exists (select 1 from public.services s where s.provider_id = p.id);
$$;
revoke all on function public.catalog_provider_names(uuid[]) from public, anon;
grant execute on function public.catalog_provider_names(uuid[]) to authenticated;

drop function if exists private.can_view_service(uuid,uuid);

commit;
