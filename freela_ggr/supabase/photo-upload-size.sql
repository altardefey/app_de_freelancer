-- Repara o envio de fotos em bancos com as migrações de anúncios e perfil já aplicadas.
begin;

update storage.buckets
set file_size_limit = 2097152
where id = 'service-portfolio';

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

drop policy if exists freela_portfolio_upload on storage.objects;
create policy freela_portfolio_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'service-portfolio'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}(-([1-9]|10|[0-9a-f-]{36}))?\.jpg$'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select private.can_add_portfolio_image())
  and exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'profissional'
  )
);

drop policy if exists freela_profile_avatar_upload on storage.objects;
create policy freela_profile_avatar_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'service-portfolio'
  and name ~ '^[0-9a-f-]{36}/avatar-[0-9a-f-]{36}\.jpg$'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select private.can_add_portfolio_image())
  and exists (select 1 from public.profiles where id = (select auth.uid()))
);

commit;
