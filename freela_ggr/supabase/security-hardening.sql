-- roda depois de criar as tabelas (query data no painel) e antes do rate-limit
begin;
revoke create on schema public from public, anon, authenticated;

-- garante a criação do perfil mesmo se o banco antigo estiver sem essa função
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id, role, cep, street, neighborhood, uf, state_name, city, whatsapp, services
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'cliente'),
    new.raw_user_meta_data->>'cep',
    new.raw_user_meta_data->>'street',
    new.raw_user_meta_data->>'neighborhood',
    new.raw_user_meta_data->>'uf',
    new.raw_user_meta_data->>'state_name',
    new.raw_user_meta_data->>'city',
    new.raw_user_meta_data->>'whatsapp',
    array(select jsonb_array_elements_text(
      coalesce(new.raw_user_meta_data->'services', '[]'::jsonb)
    ))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- recria só esse trigger, sem mexer nos perfis que já existem
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- tira as permissões amplas antes de liberar só o que o app precisa
revoke all on public.profiles, public.services, public.budgets, public.completed_jobs from public, anon, authenticated;
-- limpa também permissões de coluna que possam ter sobrado de versões antigas
do $$
declare item record;
begin
  for item in select table_name, column_name from information_schema.columns
    where table_schema = 'public' and table_name in ('profiles', 'services', 'budgets', 'completed_jobs')
  loop
    execute format('revoke all (%I) on public.%I from public, anon, authenticated', item.column_name, item.table_name);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.budgets enable row level security;
alter table public.completed_jobs enable row level security;

-- substitui as policies dessas quatro tabelas pra não sobrar uma regra permissiva
do $$
declare item record;
begin
  for item in select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('profiles', 'services', 'budgets', 'completed_jobs')
  loop
    execute format('drop policy %I on public.%I', item.policyname, item.tablename);
  end loop;
end $$;

grant select on public.profiles to authenticated;
grant update (cep, street, neighborhood, uf, state_name, city, whatsapp, services) on public.profiles to authenticated;
create policy profiles_own_read on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_own_update on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
-- só o trigger do auth cria perfis, e o app não consegue trocar role ou id
revoke all on function public.handle_new_user() from public, anon, authenticated;

grant select (id, provider_id, title, category, provider, price, rating, description, uf, city, neighborhood, trending, recent, created_at) on public.services to anon, authenticated;
grant insert (provider_id, title, category, provider, price, description, uf, city, neighborhood) on public.services to authenticated;
grant update (title, category, provider, price, description, uf, city, neighborhood) on public.services to authenticated;
grant delete on public.services to authenticated;
create policy services_public_read on public.services for select to anon, authenticated using (true);
create policy services_professional_insert on public.services for insert to authenticated
  with check (provider_id = (select auth.uid()) and exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'profissional'));
create policy services_owner_update on public.services for update to authenticated
  using (provider_id = (select auth.uid())) with check (provider_id = (select auth.uid()));
create policy services_owner_delete on public.services for delete to authenticated using (provider_id = (select auth.uid()));

grant select (id, user_id, professional_id, client, service, value, date, status, created_at) on public.budgets to authenticated;
grant insert (user_id, professional_id, client, service, value, whatsapp, status) on public.budgets to authenticated;
grant update (status) on public.budgets to authenticated;
create policy budgets_related_read on public.budgets for select to authenticated
  using ((select auth.uid()) = user_id or (select auth.uid()) = professional_id);
create policy budgets_client_insert on public.budgets for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'solicitado' and
    exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'cliente'));
create policy budgets_professional_update on public.budgets for update to authenticated
  using ((select auth.uid()) = professional_id)
  with check ((select auth.uid()) = professional_id and status in ('pendente', 'realizado', 'recusado'));

grant select (id, user_id, title, provider, date, rating, created_at) on public.completed_jobs to authenticated;
grant update (rating) on public.completed_jobs to authenticated;
create policy jobs_own_read on public.completed_jobs for select to authenticated using ((select auth.uid()) = user_id);
create policy jobs_own_rating on public.completed_jobs for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- confere os dados no banco também, mesmo se alguém pular a validação da tela
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create or replace function private.valid_service_labels(labels text[]) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(cardinality(labels) <= 30 and not exists (
    select 1 from unnest(labels) label where label is null or length(btrim(label)) not between 1 and 100
  ), false)
$$;
-- a função só valida texto; o schema continua fora da api
grant usage on schema private to authenticated;
grant execute on function private.valid_service_labels(text[]) to authenticated;
revoke all on function private.valid_service_labels(text[]) from public, anon;

alter table public.profiles drop constraint if exists profiles_input_bounds;
alter table public.profiles add constraint profiles_input_bounds check (
  length(coalesce(street, '')) <= 200 and length(coalesce(city, '')) <= 120 and
  length(coalesce(neighborhood, '')) <= 120 and length(coalesce(state_name, '')) <= 60 and
  (cep is null or cep = '' or cep ~ '^\d{5}-?\d{3}$') and
  (whatsapp is null or whatsapp = '' or whatsapp ~ '^\d{10,11}$') and
  (uf is null or uf = '' or uf ~ '^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$') and
  private.valid_service_labels(services)
) not valid;
alter table public.services drop constraint if exists services_input_bounds;
alter table public.services add constraint services_input_bounds check (
  length(btrim(title)) between 1 and 200 and length(btrim(category)) between 1 and 100 and
  length(btrim(provider)) between 1 and 120 and length(price) between 1 and 40 and
  length(description) between 1 and 5000 and length(city) between 1 and 120 and
  length(neighborhood) between 1 and 120 and length(uf) = 2
) not valid;
alter table public.budgets drop constraint if exists budgets_input_bounds;
alter table public.budgets add constraint budgets_input_bounds check (
  length(btrim(client)) between 1 and 120 and length(btrim(service)) between 1 and 200 and
  length(btrim(value)) between 1 and 40 and length(coalesce(date, '')) <= 80 and
  (whatsapp is null or whatsapp ~ '^\d{10,11}$')
) not valid;
alter table public.completed_jobs drop constraint if exists jobs_input_bounds;
alter table public.completed_jobs add constraint jobs_input_bounds check (
  length(btrim(title)) between 1 and 200 and length(btrim(provider)) between 1 and 120 and length(coalesce(date, '')) <= 80
) not valid;
commit;
