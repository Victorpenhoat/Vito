create table public.voyage_documents (
  id uuid primary key default gen_random_uuid(),
  voyage_id uuid not null references public.voyages (id) on delete cascade,
  nom text not null check (char_length(nom) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  taille integer not null check (taille > 0 and taille <= 5242880),
  contenu_chiffre text not null,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index voyage_documents_voyage_idx on public.voyage_documents (voyage_id);

alter table public.voyage_documents enable row level security;
create policy "voyage_documents_all" on public.voyage_documents for all
  using (public.can_access_voyage(voyage_id))
  with check (public.can_access_voyage(voyage_id));

grant select, insert, update, delete on public.voyage_documents to authenticated;
