-- Tags système d'ambiance : données de RÉFÉRENCE (is_system=true) livrées avec le
-- schéma — et non via le seed de dev — afin qu'elles existent aussi dans les
-- environnements déployés (supabase db push). Idempotent : rejouable sans conflit.
insert into public.tags (slug, label, categorie, is_system) values
  ('en_amoureux', 'En amoureux', 'ambiance', true),
  ('entre_amis', 'Entre amis', 'ambiance', true),
  ('terrasse', 'Terrasse', 'ambiance', true),
  ('avec_vue', 'Avec vue', 'ambiance', true),
  ('en_famille', 'En famille', 'ambiance', true),
  ('business', 'Business', 'ambiance', true)
on conflict (slug) do nothing;
