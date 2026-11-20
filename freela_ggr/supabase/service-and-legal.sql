begin;
alter table public.professional_quotes add column if not exists remote boolean not null default false;
grant insert (remote) on public.professional_quotes to authenticated;

create table if not exists private.legal_releases (
  version text primary key,
  published_at timestamptz not null default now(),
  required boolean not null default false
);
create unique index if not exists one_required_legal_release on private.legal_releases (required) where required;
insert into private.legal_releases(version, required) values ('2026-11-09.1', true) on conflict (version) do nothing;

create table if not exists private.legal_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null references private.legal_releases(version),
  accepted_at timestamptz not null default now(),
  primary key (user_id, version)
);
alter table private.legal_releases enable row level security;
alter table private.legal_acceptances enable row level security;

create or replace function private.record_signup_legal() returns trigger
language plpgsql security definer set search_path = '' as $$
declare active_version text;
begin
  select version into strict active_version from private.legal_releases where required;
  if new.raw_user_meta_data->>'legal_version' is distinct from active_version then
    raise exception 'Aceite os Termos de Uso e confirme a ciência da Política de Privacidade.';
  end if;
  insert into private.legal_acceptances(user_id, version) values(new.id, active_version);
  return new;
end;
$$;
drop trigger if exists freela_signup_legal on auth.users;
create trigger freela_signup_legal after insert on auth.users
  for each row execute function private.record_signup_legal();

create or replace function public.legal_status() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('version', r.version, 'accepted', exists (
    select 1 from private.legal_acceptances a where a.user_id = auth.uid() and a.version = r.version
  )) from private.legal_releases r where r.required;
$$;
create or replace function public.accept_legal(document_version text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from private.legal_releases where required and version = document_version
  ) then raise exception 'Versão dos documentos indisponível.'; end if;
  insert into private.legal_acceptances(user_id, version) values(auth.uid(), document_version)
  on conflict do nothing;
end;
$$;
revoke all on function private.record_signup_legal() from public, anon, authenticated;
revoke all on function public.legal_status(), public.accept_legal(text) from public, anon;
grant execute on function public.legal_status(), public.accept_legal(text) to authenticated;
alter table public.services add column if not exists remote boolean not null default false;
alter table public.services add column if not exists portfolio_path text;
alter table public.services drop constraint if exists services_input_bounds;
alter table public.services add constraint services_input_bounds check (
  length(btrim(title)) between 1 and 200 and length(btrim(category)) between 1 and 100 and
  length(btrim(provider)) between 1 and 120 and length(price) between 1 and 40 and
  length(description) between 1 and 5000 and (
    (remote and uf = '' and city = '' and neighborhood = '') or
    (not remote and length(city) between 1 and 120 and length(neighborhood) between 1 and 120 and length(uf) = 2)
  )
) not valid;
alter table public.services drop constraint if exists services_portfolio_owner;
alter table public.services add constraint services_portfolio_owner check (
  portfolio_path is null or provider_id is null or portfolio_path = provider_id::text || '/' || id::text || '.jpg'
);
grant select (remote, portfolio_path) on public.services to anon, authenticated;
grant insert (id, remote, portfolio_path) on public.services to authenticated;
grant update (remote, portfolio_path) on public.services to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('service-portfolio', 'service-portfolio', false, 2097152, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists freela_portfolio_read on storage.objects;
create policy freela_portfolio_read on storage.objects for select to authenticated using (
  bucket_id = 'service-portfolio' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (select 1 from public.services s where s.portfolio_path = name and s.provider_id is not null)
  )
);
create or replace function private.can_add_portfolio_image() returns boolean
language plpgsql security definer set search_path = '' as $$
declare uploading_user_id uuid := auth.uid();
begin
  if uploading_user_id is null then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('portfolio:' || uploading_user_id::text, 0));
  return (select count(*) < 100 from storage.objects
    where bucket_id = 'service-portfolio' and name like uploading_user_id::text || '/%');
end;
$$;
revoke all on function private.can_add_portfolio_image() from public, anon;
grant execute on function private.can_add_portfolio_image() to authenticated;

drop policy if exists freela_portfolio_upload on storage.objects;
create policy freela_portfolio_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'service-portfolio'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select private.can_add_portfolio_image())
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'profissional')
);
drop policy if exists freela_portfolio_delete on storage.objects;
create policy freela_portfolio_delete on storage.objects for delete to authenticated using (
  bucket_id = 'service-portfolio' and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (select 1 from public.services s where s.portfolio_path = name)
);
alter table public.budgets add column if not exists remote boolean not null default false;
update public.budgets b set remote = s.remote
from public.services s where b.service_id = s.id and b.remote is distinct from s.remote;
grant select (remote) on public.budgets to authenticated;
create or replace function private.snapshot_budget_modality() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.remote := coalesce((select remote from public.services where id = new.service_id), false);
  return new;
end;
$$;
drop trigger if exists freela_budget_modality on public.budgets;
create trigger freela_budget_modality before insert on public.budgets
  for each row execute function private.snapshot_budget_modality();

commit;
