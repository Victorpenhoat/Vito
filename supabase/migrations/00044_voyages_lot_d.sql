-- Refonte Voyages (Lot D) : les dépenses du voyage, entre VOYAGEURS.
--
-- L'onglet Dépenses global partage entre COMPTES (00010) et ne bouge pas : les
-- deux coexistent (décision PO). Ici, on partage entre participants — c'est
-- tout l'intérêt du lot B : un enfant ou un ami sans compte peut devoir sa
-- part, et la doit à quelqu'un qui, lui, a peut-être un compte.

create table public.voyage_depenses (
  id uuid primary key default gen_random_uuid(),
  voyage_id uuid not null references public.voyages (id) on delete cascade,
  -- `restrict` et non `cascade` : on ne retire pas silencieusement un voyageur
  -- qui a payé. Le retrait échoue, l'écran l'explique — plutôt qu'un solde
  -- faussé sans que personne ne l'ait demandé.
  paye_par uuid not null references public.voyage_participants (id) on delete restrict,
  libelle text not null check (char_length(libelle) between 1 and 200),
  montant_cents bigint not null check (montant_cents > 0),
  date date,
  mode public.depense_mode not null default 'egal',
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index voyage_depenses_voyage_idx on public.voyage_depenses (voyage_id);

create table public.voyage_depense_parts (
  depense_id uuid not null references public.voyage_depenses (id) on delete cascade,
  participant_id uuid not null references public.voyage_participants (id) on delete restrict,
  part_cents bigint not null check (part_cents >= 0),
  primary key (depense_id, participant_id)
);

create table public.voyage_remboursements (
  id uuid primary key default gen_random_uuid(),
  voyage_id uuid not null references public.voyages (id) on delete cascade,
  de_participant_id uuid not null references public.voyage_participants (id) on delete restrict,
  vers_participant_id uuid not null references public.voyage_participants (id) on delete restrict,
  montant_cents bigint not null check (montant_cents > 0),
  date date,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Se rembourser soi-même ne veut rien dire et fausserait les soldes.
  constraint voyage_remboursements_distincts check (de_participant_id <> vers_participant_id)
);
create index voyage_remboursements_voyage_idx on public.voyage_remboursements (voyage_id);

-- RLS : collaboratif, comme le programme et les voyageurs.
alter table public.voyage_depenses enable row level security;
create policy "voyage_depenses_all" on public.voyage_depenses for all to authenticated
  using (public.can_access_voyage(voyage_id)) with check (public.can_access_voyage(voyage_id));

alter table public.voyage_depense_parts enable row level security;
create policy "voyage_depense_parts_all" on public.voyage_depense_parts for all to authenticated
  using (exists (select 1 from public.voyage_depenses d
                  where d.id = depense_id and public.can_access_voyage(d.voyage_id)))
  with check (exists (select 1 from public.voyage_depenses d
                       where d.id = depense_id and public.can_access_voyage(d.voyage_id)));

alter table public.voyage_remboursements enable row level security;
create policy "voyage_remboursements_all" on public.voyage_remboursements for all to authenticated
  using (public.can_access_voyage(voyage_id)) with check (public.can_access_voyage(voyage_id));

grant select, insert, update, delete on public.voyage_depenses to authenticated;
grant select, insert, update, delete on public.voyage_depense_parts to authenticated;
grant select, insert, update, delete on public.voyage_remboursements to authenticated;
