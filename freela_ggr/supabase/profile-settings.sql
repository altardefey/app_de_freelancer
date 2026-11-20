-- roda depois do account-portfolio-contact.sql
begin;
alter table public.profiles
  add column if not exists bio text,
  add column if not exists instagram_url text,
  add column if not exists website_url text,
  add column if not exists whatsapp_business text,
  add column if not exists avatar_path text;

alter table public.profiles drop constraint if exists freela_public_profile_fields;
alter table public.profiles add constraint freela_public_profile_fields check (
  (role = 'profissional' or num_nonnulls(bio,instagram_url,website_url,whatsapp_business,avatar_path) = 0)
  and (bio is null or char_length(bio) <= 500)
  and (instagram_url is null or (char_length(instagram_url) <= 300 and instagram_url ~ '^https://(www\.)?instagram\.com/[A-Za-z0-9._]+/?$'))
  and (website_url is null or (char_length(website_url) <= 300 and website_url ~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?([/?#][^[:space:]\\]*)?$'))
  and (whatsapp_business is null or whatsapp_business ~ '^[0-9]{10,11}$')
  and (avatar_path is null or avatar_path ~ ('^' || id::text || '/avatar-[0-9a-f-]{36}\.jpg$'))
);

grant update (bio, instagram_url, website_url, whatsapp_business, avatar_path) on public.profiles to authenticated;

create or replace function public.professional_card(provider uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('bio',p.bio,'instagram_url',p.instagram_url,'website_url',p.website_url,
    'whatsapp_business',p.whatsapp_business,'avatar_path',p.avatar_path,'services',p.services)
  from public.profiles p where p.id = provider and p.role = 'profissional' and auth.uid() is not null
    and (p.id = auth.uid() or exists (select 1 from public.services s where s.provider_id = p.id));
$$;
revoke all on function public.professional_card(uuid) from public, anon;
grant execute on function public.professional_card(uuid) to authenticated;

create or replace function private.published_profile_avatar(image_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.role = 'profissional' and p.avatar_path = image_path
    and exists (select 1 from public.services s where s.provider_id = p.id));
$$;
revoke all on function private.published_profile_avatar(text) from public, anon;
grant execute on function private.published_profile_avatar(text) to authenticated;

drop policy if exists freela_profile_avatar_read on storage.objects;
create policy freela_profile_avatar_read on storage.objects for select to authenticated using (
  bucket_id = 'service-portfolio' and private.published_profile_avatar(name)
);
drop policy if exists freela_profile_avatar_upload on storage.objects;
create policy freela_profile_avatar_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'service-portfolio'
  and name ~ '^[0-9a-f-]{36}/avatar-[0-9a-f-]{36}\.jpg$'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select private.can_add_portfolio_image())
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'profissional')
);
-- protege a foto em uso e mantém a remoção de fotos antigas
drop policy if exists freela_keep_profile_avatar on storage.objects;
create policy freela_keep_profile_avatar on storage.objects as restrictive for delete to authenticated using (
  bucket_id <> 'service-portfolio' or name !~ '/avatar-' or not exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.avatar_path = name
  )
);
commit;
