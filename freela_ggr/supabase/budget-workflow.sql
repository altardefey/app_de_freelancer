-- Apply after security-hardening.sql and rate-limits.sql.
begin;

alter table public.budgets
  add column if not exists service_id uuid references public.services(id) on delete set null,
  add column if not exists details text,
  add column if not exists quote_amount numeric(10, 2),
  add column if not exists quote_message text;

alter table public.completed_jobs
  add column if not exists service_id uuid references public.services(id) on delete set null,
  add column if not exists source_budget_id uuid references public.budgets(id) on delete set null;

alter table public.completed_jobs
  drop constraint if exists completed_jobs_source_budget_id_key;
alter table public.completed_jobs
  add constraint completed_jobs_source_budget_id_key unique (source_budget_id);

alter table public.budgets drop constraint if exists budgets_status_check;
alter table public.budgets drop constraint if exists budgets_quote_amount_check;
alter table public.budgets drop constraint if exists budgets_details_length_check;
alter table public.budgets drop constraint if exists budgets_quote_message_length_check;
-- Existing "pendente" records had already been accepted by the professional.
update public.budgets set status = 'em_andamento' where status = 'pendente';
alter table public.budgets add constraint budgets_status_check
  check (status in ('solicitado', 'cotado', 'aceito', 'em_andamento', 'realizado', 'recusado', 'cancelado')) not valid;
alter table public.budgets add constraint budgets_quote_amount_check
  check (quote_amount is null or quote_amount between 0.01 and 10000000) not valid;
alter table public.budgets add constraint budgets_details_length_check
  check (details is null or length(details) <= 2000) not valid;
alter table public.budgets add constraint budgets_quote_message_length_check
  check (quote_message is null or length(quote_message) <= 2000) not valid;

grant select (details, quote_amount, quote_message) on public.budgets to authenticated;
grant insert (service_id, details) on public.budgets to authenticated;
grant update (quote_amount, quote_message) on public.budgets to authenticated;

drop policy if exists budgets_client_insert on public.budgets;
create policy budgets_client_insert on public.budgets for insert to authenticated
  with check (
    (select auth.uid()) = user_id and status = 'solicitado'
    and (select role from public.profiles where id = (select auth.uid())) = 'cliente'
    and service_id is not null and professional_id is not null
    and exists (
      select 1 from public.services s
      where s.id = budgets.service_id and s.provider_id = budgets.professional_id
    )
  );

drop policy if exists budgets_professional_update on public.budgets;
drop policy if exists budgets_participant_update on public.budgets;
create policy budgets_participant_update on public.budgets for update to authenticated
  using ((select auth.uid()) = professional_id or (select auth.uid()) = user_id)
  with check ((select auth.uid()) = professional_id or (select auth.uid()) = user_id);

create or replace function public.enforce_budget_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_role text;
begin
  if actor is null then return new; end if;

  if new.user_id is distinct from old.user_id
    or new.professional_id is distinct from old.professional_id
    or new.service_id is distinct from old.service_id
    or new.client is distinct from old.client
    or new.service is distinct from old.service
    or new.value is distinct from old.value
    or new.details is distinct from old.details
    or new.whatsapp is distinct from old.whatsapp
    or new.date is distinct from old.date
    or new.created_at is distinct from old.created_at then
    raise exception 'Campos do pedido não podem ser alterados.' using errcode = '42501';
  end if;

  select p.role into actor_role from public.profiles p where p.id = actor;

  if actor = old.professional_id and actor_role = 'profissional' then
    if old.status = 'solicitado' and new.status = 'cotado'
      and new.quote_amount is not null and new.quote_amount > 0 then
      return new;
    elsif old.status = 'solicitado' and new.status = 'recusado'
      and new.quote_amount is not distinct from old.quote_amount
      and new.quote_message is not distinct from old.quote_message then
      return new;
    elsif old.status = 'aceito' and new.status = 'em_andamento'
      and new.quote_amount is not distinct from old.quote_amount
      and new.quote_message is not distinct from old.quote_message then
      return new;
    elsif old.status = 'em_andamento' and new.status = 'realizado'
      and new.quote_amount is not distinct from old.quote_amount
      and new.quote_message is not distinct from old.quote_message then
      return new;
    end if;
  elsif actor = old.user_id and actor_role = 'cliente' then
    if old.status = 'cotado' and new.status in ('aceito', 'recusado')
      and new.quote_amount is not distinct from old.quote_amount
      and new.quote_message is not distinct from old.quote_message then
      return new;
    elsif old.status in ('solicitado', 'cotado', 'aceito') and new.status = 'cancelado'
      and new.quote_amount is not distinct from old.quote_amount
      and new.quote_message is not distinct from old.quote_message then
      return new;
    end if;
  end if;

  raise exception 'Transição de orçamento não permitida.' using errcode = '42501';
end;
$$;
revoke all on function public.enforce_budget_transition() from public, anon, authenticated;

drop trigger if exists budgets_enforce_transition on public.budgets;
create trigger budgets_enforce_transition before update on public.budgets
  for each row execute function public.enforce_budget_transition();

create or replace function public.create_completed_job_for_budget()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status <> 'realizado' and new.status = 'realizado' then
    insert into public.completed_jobs (user_id, title, provider, date, service_id, source_budget_id)
    select new.user_id, new.service, coalesce(s.provider, 'Profissional'),
      to_char(clock_timestamp(), 'YYYY-MM-DD'), new.service_id, new.id
    from (select 1) seed left join public.services s on s.id = new.service_id
    on conflict (source_budget_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.create_completed_job_for_budget() from public, anon, authenticated;

drop trigger if exists budgets_create_completed_job on public.budgets;
create trigger budgets_create_completed_job after update on public.budgets
  for each row execute function public.create_completed_job_for_budget();

commit;