-- Voyages, conformité maquette « Ajout d'une dépense » : le ticket.
--
-- Rien de neuf à inventer : un ticket est un document du voyage, comme un
-- voucher. Il rejoint donc `voyage_documents` — chiffré en colonne, servi par
-- la route protégée, et déjà emporté par le mode hors ligne. Une table dédiée
-- aurait dupliqué tout cela.
--
-- `on delete set null` comme pour les réservations (00043) : supprimer une
-- dépense ne doit pas effacer la preuve d'achat, qui reste un document du
-- voyage.
alter table public.voyage_documents
  add column depense_id uuid references public.voyage_depenses (id) on delete set null;
create index voyage_documents_depense_idx on public.voyage_documents (depense_id);
