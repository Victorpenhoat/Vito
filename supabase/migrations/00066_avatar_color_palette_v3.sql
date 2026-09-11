-- Rattrapage refonte v3 : `avatarColor()` est PERSISTÉ dans
-- `family_members.avatar_color` (écrit à la création d'un proche, jamais
-- réécrit ensuite). Changer la constante AVATAR_PALETTE de l'application ne
-- change rien à ce qui est déjà en base — l'ancien `#211E1A` (l'encre du
-- thème clair) y reste, invisible sur la surface nuit `#131A26` (1,05:1).
--
-- On ne remappe QUE les six valeurs exactes de l'ancien monde : cinq de
-- l'ancienne AVATAR_PALETTE, plus `#2563EB` (l'ancien accent, semé par
-- erreur dans le jeu de données de démonstration, qui n'appartenait à
-- aucune palette d'avatar). Une couleur choisie autrement par un tiers ne
-- nous appartient pas et n'est pas touchée.
update public.family_members
set avatar_color = case avatar_color
  when '#211E1A' then '#4A6BA3'
  when '#6B7A8F' then '#5C7A99'
  when '#8A7A64' then '#6E5C8C'
  when '#9A8466' then '#4A7A6B'
  when '#5E7163' then '#8C6A5C'
  when '#2563EB' then '#4A6BA3'
  end
where avatar_color in ('#211E1A', '#6B7A8F', '#8A7A64', '#9A8466', '#5E7163', '#2563EB');
