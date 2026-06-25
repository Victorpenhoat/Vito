alter table public.tags
  add column scope text not null default 'common' check (scope in ('common','restaurant','hotel')),
  add column color text;

-- Les tags d'ambiance existants s'appliquent aux deux catégories
update public.tags set scope = 'common' where is_system = true;

-- Couleurs sur les tags common existants (optionnel, lisible)
update public.tags set color = '#60A5FA' where slug in ('en_amoureux','entre_amis','avec_vue','en_famille','business','terrasse');

-- Nouveaux tags système scopés (idempotent), avec couleur
insert into public.tags (slug, label, categorie, is_system, scope, color) values
  ('gastronomique', 'Gastronomique', 'cuisine', true, 'restaurant', '#C084FC'),
  ('cuisine_marche', 'Cuisine du marché', 'cuisine', true, 'restaurant', '#4ADE80'),
  ('cave_a_vins', 'Cave à vins', 'cuisine', true, 'restaurant', '#FBBF24'),
  ('spa', 'Spa', 'equipement', true, 'hotel', '#C084FC'),
  ('piscine', 'Piscine', 'equipement', true, 'hotel', '#60A5FA'),
  ('petit_dej_inclus', 'Petit-déjeuner inclus', 'equipement', true, 'hotel', '#4ADE80'),
  ('vue_mer', 'Vue mer', 'ambiance', true, 'common', '#60A5FA')
on conflict (slug) do nothing;
