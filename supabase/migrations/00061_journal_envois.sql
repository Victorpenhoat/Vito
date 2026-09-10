-- Journal des e-mails sortants (lot 1 « mails »).
--
-- Il existe pour répondre à une seule question : « je n'ai rien reçu » — est-ce
-- parti, est-ce arrivé, a-t-il rebondi. D'où ce qu'on garde, et ce qu'on ne
-- garde pas : le GENRE du message et son sort, jamais son contenu. Un journal
-- qui contiendrait le lien magique n'aurait fait que le déplacer, exactement
-- comme pour journal_acces (00055).

create table public.journal_envois (
  id             uuid primary key default gen_random_uuid(),
  -- Nullable : une invitation part vers quelqu'un qui n'a pas encore de compte.
  -- set null : un compte supprimé n'emporte pas la preuve qu'on lui a écrit.
  user_id        uuid references public.profiles (id) on delete set null,
  destinataire   text not null,
  genre          text not null check (genre in
                   ('lien_magique','invitation','rappel_activites','partage_voyage','depense')),
  fournisseur_id text,
  -- 'en_cours' est l'état INITIAL, écrit avant l'appel au fournisseur : à cet
  -- instant rien n'a été accepté. Une ligne restée 'en_cours' est un signal —
  -- l'appel n'est jamais revenu.
  statut         text not null default 'en_cours'
                   check (statut in ('en_cours','accepte','remis','rebond','plainte','echec')),
  detail         text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index journal_envois_user_date_idx on public.journal_envois (user_id, created_at desc);
-- Le webhook retrouve la ligne par cet identifiant : il doit être unique, et il
-- est absent tant que le fournisseur n'a pas répondu.
create unique index journal_envois_fournisseur_idx on public.journal_envois (fournisseur_id)
  where fournisseur_id is not null;

create trigger journal_envois_set_updated_at before update on public.journal_envois
  for each row execute function public.set_updated_at();

alter table public.journal_envois enable row level security;

-- On lit ses propres envois, rien d'autre. L'écriture appartient au serveur
-- (rôle de service, qui contourne la RLS) : un e-mail part souvent vers
-- quelqu'un qui n'est pas connecté, parfois qui n'a pas de compte.
create policy "journal_envois_select_self" on public.journal_envois
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.journal_envois from anon;
grant select on public.journal_envois to authenticated;
-- Explicite, et c'est le cœur du dispositif : sans ce revoke, un update
-- passerait la RLS sans erreur et ne toucherait aucune ligne — en silence.
revoke insert, update, delete on public.journal_envois from authenticated;

-- Purge : le journal répond au support (« la semaine dernière »), il ne
-- constitue pas un historique indéfini des adresses. 90 jours.
--
-- Écrite ici, DÉCLENCHÉE AU LOT 4 : la planification (Vercel Cron ou pg_cron)
-- est une décision qui déborde des e-mails — la purge des comptes l'attend
-- aussi (cf. commentaire de 00039).
create or replace function public.purger_journal_envois()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supprimes integer;
begin
  delete from public.journal_envois where created_at < now() - interval '90 days';
  get diagnostics v_supprimes = row_count;
  return v_supprimes;
end;
$$;

revoke all on function public.purger_journal_envois() from public;
