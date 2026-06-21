create function public.find_or_create_vin(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentification requise'; end if;
  insert into public.vins (user_id, nom, domaine, millesime, region, couleur, cepages)
  values (
    auth.uid(),
    p ->> 'nom',
    nullif(p ->> 'domaine', ''),
    nullif(p ->> 'millesime', '')::smallint,
    nullif(p ->> 'region', ''),
    (p ->> 'couleur')::public.vin_couleur,
    coalesce((select array_agg(value) from jsonb_array_elements_text(p -> 'cepages')), '{}')
  )
  on conflict (user_id, lower(nom), coalesce(millesime, 0), lower(coalesce(domaine, '')))
  do update set region = excluded.region, couleur = excluded.couleur, cepages = excluded.cepages
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.find_or_create_vin(jsonb) from anon, public;
grant execute on function public.find_or_create_vin(jsonb) to authenticated;
