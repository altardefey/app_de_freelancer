-- roda depois do service-and-legal.sql
begin;

create or replace function private.require_adult_signup() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.raw_user_meta_data->'adult' is distinct from 'true'::jsonb then
    raise exception 'Confirme que você tem 18 anos ou mais.';
  end if;
  return new;
end;
$$;

drop trigger if exists freela_signup_adult on auth.users;
create trigger freela_signup_adult before insert on auth.users
  for each row execute function private.require_adult_signup();

revoke all on function private.require_adult_signup() from public, anon, authenticated;

commit;
