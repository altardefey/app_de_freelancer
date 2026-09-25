create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('cliente', 'profissional')),
  cep text,
  street text,
  neighborhood text,
  uf text,
  state_name text,
  city text,
  whatsapp text,
  services text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.profiles(id) on delete set null,
  title text not null,
  category text not null,
  provider text not null,
  price text not null,
  rating numeric default 4.8,
  description text not null,
  uf text not null,
  city text not null,
  neighborhood text not null,
  trending boolean default false,
  recent boolean default true,
  created_at timestamptz not null default now()
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  professional_id uuid references public.profiles(id) on delete set null,
  client text not null,
  service text not null,
  value text not null,
  whatsapp text,
  status text not null default 'solicitado'
    check (status in ('solicitado', 'pendente', 'realizado', 'recusado')),
  date text,
  created_at timestamptz not null default now()
);

create table if not exists public.completed_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  title text not null,
  provider text not null,
  date text,
  rating integer check (rating between 1 and 5),
  created_at timestamptz not null default now()
);

-- cria o perfil quando um usuário nasce no auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    role,
    cep,
    street,
    neighborhood,
    uf,
    state_name,
    city,
    whatsapp,
    services
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'cliente'),
    new.raw_user_meta_data->>'cep',
    new.raw_user_meta_data->>'street',
    new.raw_user_meta_data->>'neighborhood',
    new.raw_user_meta_data->>'uf',
    new.raw_user_meta_data->>'state_name',
    new.raw_user_meta_data->>'city',
    new.raw_user_meta_data->>'whatsapp',
    coalesce(
      array(
        select jsonb_array_elements_text(
          coalesce(new.raw_user_meta_data->'services', '[]'::jsonb)
        )
      ),
      '{}'
    )
  )
  on conflict (id) do update set
    role = excluded.role,
    cep = excluded.cep,
    street = excluded.street,
    neighborhood = excluded.neighborhood,
    uf = excluded.uf,
    state_name = excluded.state_name,
    city = excluded.city,
    whatsapp = excluded.whatsapp,
    services = excluded.services,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- liga a proteção por linha para cada tabela pública.
alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.budgets enable row level security;
alter table public.completed_jobs enable row level security;

-- remove policies antigas antes de criar as versões atuais.
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "services_read_all" on public.services;
drop policy if exists "services_insert_professional" on public.services;
drop policy if exists "services_insert_own_professional" on public.services;
drop policy if exists "services_update_own_professional" on public.services;
drop policy if exists "services_delete_own_professional" on public.services;
drop policy if exists "budgets_read_authenticated" on public.budgets;
drop policy if exists "budgets_insert_authenticated" on public.budgets;
drop policy if exists "budgets_update_authenticated" on public.budgets;
drop policy if exists "budgets_select_related_users" on public.budgets;
drop policy if exists "budgets_insert_own" on public.budgets;
drop policy if exists "budgets_update_related_professional" on public.budgets;
drop policy if exists "completed_jobs_read_own" on public.completed_jobs;
drop policy if exists "completed_jobs_update_own" on public.completed_jobs;
drop policy if exists "completed_jobs_select_own" on public.completed_jobs;
drop policy if exists "completed_jobs_update_own_rating" on public.completed_jobs;

-- cada usuário só lê e edita o próprio perfil.
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- serviços são públicos para leitura, mas só o dono altera.
create policy "services_read_all"
  on public.services for select
  using (true);

create policy "services_insert_own_professional"
  on public.services for insert
  with check (auth.uid() = provider_id);

create policy "services_update_own_professional"
  on public.services for update
  using (auth.uid() = provider_id)
  with check (auth.uid() = provider_id);

create policy "services_delete_own_professional"
  on public.services for delete
  using (auth.uid() = provider_id);

-- orçamentos ficam visíveis só para cliente e profissional ligados a eles.
create policy "budgets_select_related_users"
  on public.budgets for select
  using (
    auth.uid() = user_id
    or auth.uid() = professional_id
  );

create policy "budgets_insert_own"
  on public.budgets for insert
  with check (auth.uid() = user_id);

create policy "budgets_update_related_professional"
  on public.budgets for update
  using (auth.uid() = professional_id)
  with check (auth.uid() = professional_id);

-- avaliações só aparecem e mudam para o cliente do serviço concluído.
create policy "completed_jobs_select_own"
  on public.completed_jobs for select
  using (auth.uid() = user_id);

create policy "completed_jobs_update_own_rating"
  on public.completed_jobs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into public.services
  (title, category, provider, price, rating, description, uf, city, neighborhood, trending, recent)
values
  ('Pintura residencial', 'Pintura', 'Casa Nova Serviços', 'R$ 180', 4.9, 'Paredes, tetos e acabamento fino para renovar ambientes.', 'SP', 'São Paulo', 'Vila Mariana', true, true),
  ('Instalação elétrica', 'Elétrica', 'Voltagem Pro', 'R$ 120', 4.8, 'Instalações, reparos e revisão elétrica com checklist de segurança.', 'SP', 'São Paulo', 'Pinheiros', true, false),
  ('Limpeza pós-obra', 'Limpeza', 'Brilho Total', 'R$ 220', 4.7, 'Limpeza detalhada para deixar casa, loja ou escritório pronto para uso.', 'RJ', 'Rio de Janeiro', 'Copacabana', false, true),
  ('Reparo hidráulico', 'Hidráulica', 'Fluxo Assistência', 'R$ 95', 4.9, 'Vazamentos, torneiras, registros e tubulações com atendimento ágil.', 'SP', 'São Paulo', 'Vila Mariana', true, true)
on conflict do nothing;
