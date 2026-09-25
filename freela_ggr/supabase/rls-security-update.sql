-- fecha as policies sem recriar tabela.
-- roda isso no sql editor depois do schema base existir.

alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.budgets enable row level security;
alter table public.completed_jobs enable row level security;

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

create policy "completed_jobs_select_own"
  on public.completed_jobs for select
  using (auth.uid() = user_id);

create policy "completed_jobs_update_own_rating"
  on public.completed_jobs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
