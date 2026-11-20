-- roda depois do service-and-legal.sql
begin;

alter table public.services add column if not exists portfolio_paths text[] not null default '{}';
grant select (portfolio_paths) on public.services to anon, authenticated;
grant insert (portfolio_paths), update (portfolio_paths) on public.services to authenticated;

create or replace function private.check_service_portfolio() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  max_photos integer;
  image_path text;
  prefix text;
begin
  if new.provider_id is null or cardinality(new.portfolio_paths) = 0 then return new; end if;
  if tg_op = 'UPDATE' and new.portfolio_paths = old.portfolio_paths
    and new.portfolio_path is not distinct from old.portfolio_path then return new; end if;
  select case when exists (
    select 1 from public.freela_subscriptions where user_id = new.provider_id
      and active and (expires_at is null or expires_at > now())
  ) then 10 else 3 end into max_photos;
  if new.portfolio_path is not null or cardinality(new.portfolio_paths) > max_photos
    or (select count(distinct path) from unnest(new.portfolio_paths) as files(path)) <> cardinality(new.portfolio_paths)
  then raise exception 'Limite de fotos do portfólio excedido.' using errcode = '23514'; end if;
  prefix := new.provider_id::text || '/' || new.id::text;
  foreach image_path in array new.portfolio_paths loop
    if image_path !~ ('^' || prefix || '(-([1-9]|10|[0-9a-f-]{36}))?\.jpg$')
      or not exists (select 1 from storage.objects where bucket_id = 'service-portfolio' and name = image_path)
    then raise exception 'Foto de portfólio inválida.' using errcode = '23514'; end if;
  end loop;
  return new;
end;
$$;
revoke all on function private.check_service_portfolio() from public, anon, authenticated;
drop trigger if exists freela_check_service_portfolio on public.services;
create trigger freela_check_service_portfolio before insert or update on public.services
  for each row execute function private.check_service_portfolio();

drop policy if exists freela_portfolio_read on storage.objects;
create policy freela_portfolio_read on storage.objects for select to authenticated using (
  bucket_id = 'service-portfolio' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (select 1 from public.services s where s.provider_id is not null
      and (s.portfolio_path = name or name = any(s.portfolio_paths)))
  )
);
drop policy if exists freela_portfolio_upload on storage.objects;
create policy freela_portfolio_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'service-portfolio'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}(-([1-9]|10|[0-9a-f-]{36}))?\.jpg$'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select private.can_add_portfolio_image())
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'profissional')
);
drop policy if exists freela_portfolio_delete on storage.objects;
create policy freela_portfolio_delete on storage.objects for delete to authenticated using (
  bucket_id = 'service-portfolio' and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (select 1 from public.services s where s.portfolio_path = name or name = any(s.portfolio_paths))
);

create or replace function public.catalog_premium_providers(provider_ids uuid[]) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select f.user_id from public.freela_subscriptions f
  where auth.uid() is not null and cardinality(provider_ids) <= 100 and f.user_id = any(provider_ids)
    and f.active and (f.expires_at is null or f.expires_at > now())
    and exists (select 1 from public.services s where s.provider_id = f.user_id);
$$;

create or replace function public.professional_reviews()
returns table(id uuid, title text, provider text, date text, rating numeric)
language sql stable security definer set search_path = '' as $$
  select coalesce(j.id, b.id), coalesce(j.title, b.service), coalesce(j.provider, 'Profissional'),
    coalesce(j.date, b.date), j.rating::numeric
  from public.budgets b
  left join public.completed_jobs j on b.id = j.source_budget_id
  where b.professional_id = auth.uid() and b.status = 'realizado'
  order by coalesce(j.created_at, b.created_at) desc
  limit 100;
$$;

alter table public.budgets add column if not exists share_contact boolean not null default false;
grant insert (share_contact) on public.budgets to authenticated;

create or replace function private.snapshot_budget_contact() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return new; end if;
  new.whatsapp := null;
  if new.share_contact and new.user_id = auth.uid() then
    select p.whatsapp into new.whatsapp from public.profiles p
    where p.id = auth.uid() and p.whatsapp ~ '^[0-9]{10,11}$';
  end if;
  return new;
end;
$$;
revoke all on function private.snapshot_budget_contact() from public, anon, authenticated;
drop trigger if exists freela_budget_contact on public.budgets;
create trigger freela_budget_contact before insert on public.budgets
  for each row execute function private.snapshot_budget_contact();

create or replace function public.budget_contact(budget_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select b.whatsapp from public.budgets b where b.id = budget_id
    and b.professional_id = auth.uid() and b.share_contact
    and b.status in ('cotado', 'aceito', 'em_andamento', 'realizado');
$$;

revoke all on function public.catalog_premium_providers(uuid[]), public.professional_reviews(), public.budget_contact(uuid) from public, anon;
grant execute on function public.catalog_premium_providers(uuid[]), public.professional_reviews(), public.budget_contact(uuid) to authenticated;

commit;
