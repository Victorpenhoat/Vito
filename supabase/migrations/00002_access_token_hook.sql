-- Injecte le rôle du profil dans le JWT (claim user_role)
create function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  v_role public.app_role;
begin
  select role into v_role from public.profiles where id = (event ->> 'user_id')::uuid limit 1;
  -- coalesce : si l'évènement n'a pas de clé 'claims', on repart d'un objet vide
  -- (sinon jsonb_set sur null renverrait null et casserait l'émission du token).
  claims := coalesce(event -> 'claims', '{}'::jsonb);
  if v_role is not null then
    claims := jsonb_set(claims, '{user_role}', to_jsonb(v_role::text));
  else
    claims := jsonb_set(claims, '{user_role}', '"client"');
  end if;
  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- L'auth admin doit pouvoir exécuter le hook et lire les profils
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
grant select on public.profiles to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

-- Policy permettant à l'auth admin de lire les profils pour le hook
create policy "profiles_select_auth_admin" on public.profiles
  for select to supabase_auth_admin using (true);
