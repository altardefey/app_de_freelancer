-- roda depois de rate-limits.sql, profile-settings.sql, order-quotes.sql e signup-adult.sql
begin;

alter table public.profiles add column if not exists birth_date date;
grant select (birth_date) on public.profiles to authenticated;
revoke update (whatsapp) on public.profiles from authenticated;

-- confere a idade pela data de nascimento de quem tá criando a conta
create or replace function private.require_adult_signup() returns trigger
language plpgsql set search_path = '' as $$
declare
  raw_date text := new.raw_user_meta_data->>'birth_date';
  signup_role text := new.raw_user_meta_data->>'role';
  born date;
  minimum_age integer;
begin
  if signup_role is null or signup_role not in ('cliente', 'profissional')
    or raw_date is null or raw_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'Informe uma data de nascimento válida.';
  end if;
  born := raw_date::date;
  minimum_age := case when signup_role = 'profissional' then 18 else 16 end;
  if born < date '1900-01-01'
    or extract(year from age((now() at time zone 'UTC')::date, born)) < minimum_age then
    raise exception 'Idade mínima: % anos.', minimum_age;
  end if;
  return new;
end;
$$;

drop trigger if exists freela_signup_adult on auth.users;
create trigger freela_signup_adult before insert on auth.users
  for each row execute function private.require_adult_signup();
revoke all on function private.require_adult_signup() from public, anon, authenticated;

create or replace function private.record_profile_birth_date() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select (u.raw_user_meta_data->>'birth_date')::date into new.birth_date
    from auth.users u where u.id = new.id;
  return new;
end;
$$;
drop trigger if exists freela_profile_birth_date on public.profiles;
create trigger freela_profile_birth_date before insert on public.profiles
  for each row execute function private.record_profile_birth_date();
revoke all on function private.record_profile_birth_date() from public, anon, authenticated;

create extension if not exists pgcrypto with schema extensions;

create or replace function public.change_account_phone(current_password text, new_phone text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  account_id uuid := auth.uid();
  current_time_stamp timestamptz := clock_timestamp();
  attempts integer;
  password_hash text;
begin
  if account_id is null or new_phone is null or new_phone !~ '^[0-9]{10,11}$'
    or current_password is null or octet_length(current_password) not between 1 and 32 then
    return 'invalid';
  end if;
  insert into private.write_rate_limits as limits (user_id, action, started_at, used)
    values (account_id, 'change_account_phone', current_time_stamp, 1)
    on conflict (user_id, action) do update set
      started_at = case when limits.started_at <= current_time_stamp - interval '10 minutes'
        then current_time_stamp else limits.started_at end,
      used = case when limits.started_at <= current_time_stamp - interval '10 minutes'
        then 1 else least(limits.used + 1, 6) end
    returning used into attempts;
  if attempts > 5 then return 'limited'; end if;

  select u.encrypted_password into password_hash from auth.users u where u.id = account_id;
  if coalesce(password_hash, '') = '' or extensions.crypt(current_password, password_hash) is distinct from password_hash then
    return 'incorrect';
  end if;
  update public.profiles set whatsapp = new_phone where id = account_id;
  if not found then return 'invalid'; end if;
  return 'updated';
end;
$$;
revoke all on function public.change_account_phone(text, text) from public, anon;
grant execute on function public.change_account_phone(text, text) to authenticated;
commit;
