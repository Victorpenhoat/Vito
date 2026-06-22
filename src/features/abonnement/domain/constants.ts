// Limite de voyages en formule Free. DOIT rester synchronisé avec le trigger SQL
// enforce_voyage_limit (supabase/migrations/00011_abonnements.sql), où la valeur 2 est codée en dur.
export const FREE_VOYAGE_LIMIT = 2;
