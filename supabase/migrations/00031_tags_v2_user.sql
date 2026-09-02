-- Restos v2 (Lot R-B) : tags personnels administrables.
-- user_id NULL = tag système (intouchable) ; sinon tag perso de l'utilisateur.

alter table public.tags
  add column user_id uuid references public.profiles (id) on delete cascade;

-- Unicité : slug global pour les tags système, par utilisateur pour les persos.
-- ATTENTION futurs seeds système : cibler l'index partiel —
--   on conflict (slug) where user_id is null
alter table public.tags drop constraint tags_slug_key;
create unique index tags_slug_system_unique on public.tags (slug) where user_id is null;
create unique index tags_slug_user_unique   on public.tags (user_id, slug) where user_id is not null;
create index tags_user_idx on public.tags (user_id);

-- RLS : visible = système OU à soi ; écriture = ses tags uniquement, jamais les système.
drop policy "tags_select_authenticated" on public.tags;
create policy "tags_select_visible" on public.tags
  for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy "tags_insert_owner" on public.tags
  for insert to authenticated
  with check (user_id = (select auth.uid()) and is_system = false);
create policy "tags_update_owner" on public.tags
  for update to authenticated
  using (user_id = (select auth.uid()) and is_system = false)
  with check (user_id = (select auth.uid()) and is_system = false);
create policy "tags_delete_owner" on public.tags
  for delete to authenticated
  using (user_id = (select auth.uid()) and is_system = false);
grant insert, update, delete on public.tags to authenticated;

-- Fusion transactionnelle : re-tague les items puis supprime le tag source.
-- SECURITY INVOKER volontaire : la RLS s'applique (liste_item_tags via parent,
-- tags owner) — fusionner VERS un tag système est permis (on n'écrit que dans
-- liste_item_tags, dont la RLS dérive de l'item).
create function public.fusionner_tags(p_source uuid, p_cible uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_source = p_cible then raise exception 'source = cible'; end if;
  -- source : tag perso de l'utilisateur uniquement (jamais système)
  if not exists (select 1 from public.tags
                 where id = p_source and user_id = auth.uid() and is_system = false) then
    raise exception 'tag source introuvable ou non modifiable';
  end if;
  -- cible : visible (système ou à soi) — le SELECT passe par la RLS
  if not exists (select 1 from public.tags where id = p_cible) then
    raise exception 'tag cible introuvable';
  end if;
  insert into public.liste_item_tags (liste_item_id, tag_id)
    select liste_item_id, p_cible from public.liste_item_tags where tag_id = p_source
  on conflict do nothing;
  delete from public.liste_item_tags where tag_id = p_source;
  delete from public.tags where id = p_source;
end $$;
revoke execute on function public.fusionner_tags(uuid, uuid) from anon, public;
grant execute on function public.fusionner_tags(uuid, uuid) to authenticated;
