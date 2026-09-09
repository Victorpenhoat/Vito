-- Limitation de débit (audit du 9 septembre : « zéro occurrence de rate limiting »).
--
-- Ce qu'on protège n'est pas la base — la RLS s'en charge — mais l'ARGENT et
-- les tiers : chaque recherche d'adresse appelle Google Places, chaque lecture
-- de pièce d'identité ou d'étiquette appelle Anthropic. Une boucle, un onglet
-- laissé ouvert, un jeton volé, et la facture court sans que rien ne casse.
--
-- Pourquoi Postgres et pas Redis : Vito n'a ni Upstash ni Vercel KV, et en
-- ajouter un ferait un service de plus à tenir, un secret de plus à faire
-- tourner, pour un compteur qui tient dans une table. Les appels limités
-- touchent DÉJÀ la base (garde d'auth), donc le compteur ne coûte pas un
-- aller-retour de plus dans le chemin critique — il coûte une écriture.

create table public.quotas (
  cle       text        not null,
  fenetre   timestamptz not null,
  compteur  integer     not null default 0,
  primary key (cle, fenetre)
);

-- Aucune policy : la table n'est touchée QUE par consommer_quota, en definer.
-- Sans policy et avec RLS active, authenticated ne peut ni lire son compteur
-- ni l'effacer — ce qui reviendrait à s'accorder un quota neuf.
alter table public.quotas enable row level security;

create index quotas_fenetre_idx on public.quotas (fenetre);

-- Consomme un jeton et dit si l'appel est permis.
--
-- L'identité vient du JETON, jamais d'un argument : un appelant ne peut ni
-- brûler le quota d'autrui, ni s'en inventer un neuf en changeant de clé.
-- L'appelant ne choisit que l'ACTION et son barème — et le barème vit dans le
-- code serveur, hors de portée du navigateur.
--
-- Fenêtre fixe plutôt que glissante : elle tient en une ligne et un index, là
-- où une fenêtre glissante demanderait de garder chaque appel. Le prix connu
-- est qu'on tolère jusqu'à deux fois la limite à cheval sur deux fenêtres ;
-- pour un garde-fou de coût, c'est sans conséquence.
create or replace function public.consommer_quota(
  p_action            text,
  p_limite            integer,
  p_fenetre_secondes  integer
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid;
  v_cle       text;
  v_fenetre   timestamptz;
  v_compteur  integer;
  v_nouvelle  boolean;
begin
  if p_limite <= 0 or p_fenetre_secondes <= 0 then
    raise exception 'quota invalide';
  end if;

  v_uid := (select auth.uid());
  if v_uid is null then
    -- Les appels limités sont tous authentifiés : sans identité, on refuse
    -- plutôt que de compter tout le monde ensemble sur une clé partagée.
    return false;
  end if;
  v_cle := v_uid::text || ':' || p_action;

  -- Début de la fenêtre courante : l'instant tronqué au pas demandé.
  v_fenetre := to_timestamp(
    floor(extract(epoch from now()) / p_fenetre_secondes) * p_fenetre_secondes
  );

  insert into public.quotas as q (cle, fenetre, compteur)
  values (v_cle, v_fenetre, 1)
  on conflict (cle, fenetre) do update set compteur = q.compteur + 1
  returning compteur, (xmax = 0) into v_compteur, v_nouvelle;

  -- Ménage : seulement quand une fenêtre neuve s'ouvre pour cette clé, donc
  -- rarement. Le faire à chaque appel ajouterait une écriture pour rien.
  if v_nouvelle then
    delete from public.quotas where fenetre < v_fenetre - interval '1 hour';
  end if;

  return v_compteur <= p_limite;
end;
$$;

revoke all on function public.consommer_quota(text, integer, integer) from public;
grant execute on function public.consommer_quota(text, integer, integer) to authenticated;
