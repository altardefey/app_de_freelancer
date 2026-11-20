-- roda depois do profile-settings.sql e do signup-adult.sql
begin;
alter table public.profiles add column if not exists first_name text;
alter table public.profiles drop constraint if exists freela_first_name;
alter table public.profiles add constraint freela_first_name check (
  first_name is null or char_length(btrim(first_name)) between 1 and 60
);
grant update (first_name) on public.profiles to authenticated;

-- a foto do cliente fica privada
alter table public.profiles drop constraint if exists freela_public_profile_fields;
alter table public.profiles add constraint freela_public_profile_fields check (
  (role = 'profissional' or num_nonnulls(bio,instagram_url,website_url,whatsapp_business) = 0)
  and (bio is null or char_length(bio) <= 500)
  and (instagram_url is null or (char_length(instagram_url) <= 300 and instagram_url ~ '^https://(www\.)?instagram\.com/[A-Za-z0-9._]+/?$'))
  and (website_url is null or (char_length(website_url) <= 300 and website_url ~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?([/?#][^[:space:]\\]*)?$'))
  and (whatsapp_business is null or whatsapp_business ~ '^[0-9]{10,11}$')
  and (avatar_path is null or avatar_path ~ ('^' || id::text || '/avatar-[0-9a-f-]{36}\.jpg$'))
);
drop policy if exists freela_profile_avatar_upload on storage.objects;
create policy freela_profile_avatar_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'service-portfolio'
  and name ~ '^[0-9a-f-]{36}/avatar-[0-9a-f-]{36}\.jpg$'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select private.can_add_portfolio_image())
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()))
);

create or replace function private.save_signup_first_name() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  name text := btrim(new.raw_user_meta_data->>'first_name');
  phone text := new.raw_user_meta_data->>'whatsapp';
begin
  if name is null or char_length(name) not between 1 and 60 then
    raise exception 'Informe o primeiro nome.';
  end if;
  if phone is null or phone !~ '^[0-9]{10,11}$' then
    raise exception 'Informe o WhatsApp com DDD.';
  end if;
  update public.profiles set first_name = name where id = new.id;
  return new;
end;
$$;
revoke all on function private.save_signup_first_name() from public, anon, authenticated;
drop trigger if exists z_freela_signup_first_name on auth.users;
create trigger z_freela_signup_first_name after insert on auth.users
  for each row execute function private.save_signup_first_name();

alter table public.services add column if not exists fixed_price_cents integer;
alter table public.services add column if not exists price_negotiable boolean not null default false;
alter table public.services drop constraint if exists freela_service_price;
alter table public.services add constraint freela_service_price check (
  fixed_price_cents is null or (not price_negotiable and fixed_price_cents between 1 and 999999999)
);
grant select (fixed_price_cents,price_negotiable), insert (fixed_price_cents,price_negotiable),
  update (fixed_price_cents,price_negotiable) on public.services to authenticated;

create or replace function private.require_service_price() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.price is not distinct from old.price
    and new.fixed_price_cents is not distinct from old.fixed_price_cents
    and new.price_negotiable = old.price_negotiable then return new; end if;
  if not new.price_negotiable and new.fixed_price_cents is null then
    raise sqlstate 'PT400' using message = 'Informe o preço fixo ou marque A combinar.';
  end if;
  if new.price_negotiable then
    new.price := 'A combinar';
  else
    new.price := 'R$ ' || replace((new.fixed_price_cents::numeric / 100)::numeric(12,2)::text, '.', ',');
  end if;
  return new;
end;
$$;
revoke all on function private.require_service_price() from public, anon, authenticated;
drop trigger if exists freela_require_service_price on public.services;
create trigger freela_require_service_price before insert or update on public.services
  for each row execute function private.require_service_price();

alter table public.budgets add column if not exists agreed_price_cents integer;
alter table public.budgets add column if not exists delivery text;
grant select (agreed_price_cents,delivery), update (delivery) on public.budgets to authenticated;
alter table public.budgets drop constraint if exists freela_delivery_length;
alter table public.budgets add constraint freela_delivery_length check (delivery is null or char_length(btrim(delivery)) between 1 and 200);

create or replace function private.snapshot_budget_contact() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  customer public.profiles%rowtype;
  listing public.services%rowtype;
begin
  if auth.uid() is null then return new; end if;
  select * into customer from public.profiles where id = auth.uid();
  select * into listing from public.services where id = new.service_id;
  if customer.whatsapp is null or customer.whatsapp !~ '^[0-9]{10,11}$' then
    raise sqlstate 'PT400' using message = 'Informe seu WhatsApp com DDD na Conta antes de enviar o pedido.';
  end if;
  if nullif(btrim(new.details), '') is null then
    raise sqlstate 'PT400' using message = 'Descreva o serviço de que você precisa.';
  end if;
  new.whatsapp := customer.whatsapp;
  new.share_contact := true;
  new.client := coalesce(customer.first_name, 'Cliente do Freela');
  new.service := listing.title;
  new.value := listing.price;
  new.agreed_price_cents := listing.fixed_price_cents;
  return new;
end;
$$;
revoke all on function private.snapshot_budget_contact() from public, anon, authenticated;

alter table public.professional_quotes add column if not exists source_budget_id uuid references public.budgets(id) on delete set null;

create or replace function private.record_budget_proposal() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'cotado' and old.status = 'solicitado' then
    if new.delivery is null then
      raise sqlstate 'PT400' using message = 'Informe o prazo ou os dias disponíveis.';
    end if;
    if old.agreed_price_cents is not null and new.quote_amount * 100 is distinct from old.agreed_price_cents::numeric then
      raise sqlstate 'PT400' using message = 'O orçamento deve usar o valor fixo do anúncio.';
    end if;
    -- usa a mesma franquia dos orçamentos anteriores
    insert into public.professional_quotes(user_id, request_id, client, service, amount_cents, whatsapp, remote, source_budget_id)
    values(new.professional_id, new.id, new.client, new.service, (new.quote_amount * 100)::integer, case when new.share_contact then new.whatsapp end, new.remote, new.id);
  elsif new.delivery is distinct from old.delivery then
    raise insufficient_privilege using message = 'O prazo só pode ser informado ao criar a proposta.';
  end if;
  return new;
end;
$$;
revoke all on function private.record_budget_proposal() from public, anon, authenticated;
drop trigger if exists freela_record_budget_proposal on public.budgets;
create trigger freela_record_budget_proposal after update on public.budgets
  for each row execute function private.record_budget_proposal();
commit;
