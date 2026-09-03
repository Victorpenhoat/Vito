-- Vins & Cave (Lot V-A) : note en verres (demi-crans), contexte de dégustation
-- (visite liée, lieu libre, prix à la bouteille ou au verre, « à retrouver »),
-- étiquette photographiée + analyse générée, tags de portée « vin ».
-- Tranchage : `vins` = l'objet identifié une fois (étiquette + analyse générée) ;
-- `degustations` = ce que J'AI vécu (note, prix, lieu, tags).

-- 1) Note en verres /5 par demi-verre (le design distingue le vin du resto /10).
--    La contrainte d'origine est anonyme (00006) : on la retrouve par
--    introspection plutôt que de parier sur son nom généré.
do $$
declare c text;
begin
  select conname into c
    from pg_constraint
   where conrelid = 'public.degustations'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%note%';
  if c is not null then
    execute format('alter table public.degustations drop constraint %I', c);
  end if;
end $$;

alter table public.degustations
  alter column note type numeric(2,1) using note::numeric(2,1);
alter table public.degustations
  add constraint degustations_note_check
  check (note is null or (note >= 0.5 and note <= 5));

-- 2) Contexte d'une dégustation : visite de restaurant OU lieu libre.
--    ⚠ La FK visites ne garantit pas l'accès (les FK ignorent la RLS) :
--    l'action vérifie l'appartenance par un SELECT sous RLS (pattern setOrigine).
alter table public.degustations
  add column visite_id uuid references public.visites (id) on delete set null,
  add column lieu_type text check (lieu_type in ('restaurant', 'maison', 'amis', 'caviste', 'autre')),
  add column lieu_nom text check (lieu_nom is null or char_length(lieu_nom) <= 120),
  add column prix_unite text check (prix_unite in ('bouteille', 'verre')),
  add column a_racheter boolean not null default false;
create index degustations_visite_idx on public.degustations (visite_id);
create index degustations_a_racheter_idx on public.degustations (user_id) where a_racheter;

-- 3) Le vin : champs d'étiquette + analyse GÉNÉRÉE (jamais présentée comme sûre).
--    L'étiquette est chiffrée en colonne (AES-256-GCM, base64) — même convention
--    que family_documents : aucun bucket, lecture par route protégée.
alter table public.vins
  add column appellation text check (appellation is null or char_length(appellation) <= 200),
  add column degre numeric(3,1) check (degre is null or (degre >= 0 and degre <= 25)),
  add column etiquette_chiffree text,
  add column etiquette_mime text check (etiquette_mime is null or etiquette_mime in ('image/jpeg', 'image/png', 'image/webp')),
  add column etiquette_taille integer check (etiquette_taille is null or etiquette_taille >= 0),
  -- ⚠ `analyse` seul est un mot réservé PostgreSQL (synonyme d'ANALYZE) : il
  -- faudrait le quoter partout. La colonne porte donc un nom explicite.
  add column analyse_contenu jsonb,
  add column analyse_confiance jsonb,
  add column analyse_at timestamptz,
  add column analyse_modele text;

-- 4) Tags : quatrième portée « vin » (l'admin des tags la liste déjà au design).
alter table public.tags drop constraint tags_scope_check;
alter table public.tags add constraint tags_scope_check
  check (scope in ('common', 'restaurant', 'hotel', 'vin'));

-- Les tags de verdict appartiennent à la DÉGUSTATION (brief : « une dégustation
-- porte ma note, mes tags, un commentaire, le prix payé »), pas au vin.
create table public.degustation_tags (
  degustation_id uuid not null references public.degustations (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (degustation_id, tag_id)
);
create index degustation_tags_tag_idx on public.degustation_tags (tag_id);

alter table public.degustation_tags enable row level security;
create policy "degustation_tags_all_owner" on public.degustation_tags
  for all to authenticated
  using (exists (select 1 from public.degustations d
                  where d.id = degustation_id and d.user_id = (select auth.uid())))
  with check (exists (select 1 from public.degustations d
                       where d.id = degustation_id and d.user_id = (select auth.uid())));
grant select, insert, update, delete on public.degustation_tags to authenticated;

-- Tags système de portée vin (ciblage de l'index partiel des slugs système, 00031)
insert into public.tags (slug, label, categorie, is_system, scope, color) values
  ('puissant',  'Puissant',    'ambiance', true, 'vin', '#7E3B4B'),
  ('leger',     'Léger',       'ambiance', true, 'vin', '#E9DFA8'),
  ('mineral',   'Minéral',     'ambiance', true, 'vin', '#60A5FA'),
  ('fruite',    'Fruité',      'ambiance', true, 'vin', '#C084FC'),
  ('pour_lete', 'Pour l''été', 'ambiance', true, 'vin', '#4ADE80')
on conflict (slug) where user_id is null do nothing;

-- 5) RLS des vins alignée sur le pattern initplan (00024) : (select auth.uid())
--    évalué une fois par requête, et policies explicitement `to authenticated`.
drop policy "vins_all_owner" on public.vins;
create policy "vins_all_owner" on public.vins
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy "degustations_all_owner" on public.degustations;
create policy "degustations_all_owner" on public.degustations
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
