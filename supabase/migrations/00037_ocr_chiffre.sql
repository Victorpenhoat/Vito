-- Onboarding & Compte (Lot O-D bis) : le résultat brut de lecture des documents
-- est chiffré comme le reste.
--
-- Pourquoi : `ocr_raw` conserve la réponse complète du modèle de lecture, qui
-- contient le plus souvent le numéro de document en toutes lettres. Le chiffrer
-- au repos était le dernier endroit où ce numéro subsistait en clair, une fois
-- doc_number traité en 00036 — la promesse « documents chiffrés séparément,
-- jamais indexés » de l'écran Confidentialité n'était donc pas encore tenue.
--
-- Ce contenu n'est affiché nulle part : il n'est conservé que pour pouvoir
-- reprendre une lecture douteuse. Aucune fonctionnalité ne le relit aujourd'hui.

alter table public.family_documents
  add column ocr_raw_chiffre text;

-- Les seules valeurs existantes sont des données de démo (l'application n'a
-- jamais été déployée) : on les efface plutôt que de tenter une reprise, la clé
-- de chiffrement vivant côté application.
update public.family_documents set ocr_raw = null where ocr_raw is not null;

comment on column public.family_documents.ocr_raw is
  'DÉPRÉCIÉ (00037) : ne plus écrire ni lire. La lecture brute vit chiffrée dans ocr_raw_chiffre.';
comment on column public.family_documents.ocr_raw_chiffre is
  'Lecture brute chiffrée AES-256-GCM (base64 iv|tag|ct), même convention que contenu_chiffre.';
