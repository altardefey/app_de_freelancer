-- executa no editor SQL do supabase para recuperar o perfil dessa conta
-- segue os padrões do schema.sql e mantém o perfil se ele já existir
begin;

insert into public.profiles (
  id, role, cep, street, neighborhood, uf, state_name, city, whatsapp, services
)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'role', 'cliente'),
  u.raw_user_meta_data->>'cep',
  u.raw_user_meta_data->>'street',
  u.raw_user_meta_data->>'neighborhood',
  u.raw_user_meta_data->>'uf',
  u.raw_user_meta_data->>'state_name',
  u.raw_user_meta_data->>'city',
  u.raw_user_meta_data->>'whatsapp',
  array(select jsonb_array_elements_text(
    case when jsonb_typeof(u.raw_user_meta_data->'services') = 'array'
      then u.raw_user_meta_data->'services' else '[]'::jsonb end
  ))
from auth.users u
where u.id = '259afeb4-7c16-47ca-ab14-4f04f45c1eea'::uuid
  and coalesce(u.raw_user_meta_data->>'role', 'cliente') in ('cliente', 'profissional')
on conflict (id) do nothing;

-- permite que cada usuário autenticado leia o próprio perfil com a proteção por linha ativa
alter table public.profiles enable row level security;
grant select on public.profiles to authenticated;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);

commit;

select u.id, p.role, (p.id is not null) as profile_exists
from auth.users u
left join public.profiles p on p.id = u.id
where u.id = '259afeb4-7c16-47ca-ab14-4f04f45c1eea'::uuid;
