-- Tags des activités (design « Tous » : chips Sport / Musique / Samedi, et le
-- filtre « Tags ▾ »).
--
-- Oubli de la migration 00055 : le filtre existe dans la maquette, la table
-- n'existait pas. On RÉUTILISE le système de tags du carnet plutôt que d'en
-- ouvrir un second — même table, un scope de plus, comme l'avait fait la Cave.
alter table public.tags drop constraint if exists tags_scope_check;
alter table public.tags add constraint tags_scope_check
  check (scope in ('common', 'restaurant', 'hotel', 'vin', 'activite'));

create table public.activite_tags (
  activite_id uuid not null references public.activites (id) on delete cascade,
  tag_id      uuid not null references public.tags (id) on delete cascade,
  primary key (activite_id, tag_id)
);
create index activite_tags_tag_idx on public.activite_tags (tag_id);

alter table public.activite_tags enable row level security;
-- Même dérivation que les autres tables filles : l'appartenance vient de
-- l'activité, elle ne se recopie pas.
create policy "activite_tags_owner" on public.activite_tags for all to authenticated
  using (public.est_mon_activite(activite_id)) with check (public.est_mon_activite(activite_id));

revoke all on public.activite_tags from anon;
grant select, insert, update, delete on public.activite_tags to authenticated;

-- Deux tags système, ceux que la maquette montre. Le reste appartient à
-- l'utilisateur : les tags v2 (00031) le permettent déjà, et deviner une
-- taxonomie à sa place n'aiderait personne.
insert into public.tags (slug, label, categorie, scope, is_system) values
  ('sport',   'Sport',   'activite', 'activite', true),
  ('musique', 'Musique', 'activite', 'activite', true)
-- L'unicité des tags système passe par un index PARTIEL (`where user_id is
-- null`, cf. 00031) : c'est lui qu'il faut viser, pas la colonne.
on conflict (slug) where user_id is null do nothing;
