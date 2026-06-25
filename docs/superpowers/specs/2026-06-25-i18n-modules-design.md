# Traduction des modules EN/IT/ES — Design

**Date :** 2026-06-25
**Statut :** Validé. Plan à suivre.
**Branche :** `i18n-modules`

---

## 0. Contexte

`messages/en.json`/`it.json`/`es.json` sont des copies de `fr.json` dont seuls `app/auth/nav/shell/accueil`
sont traduits ; les **11 namespaces modules** (vins, gouts, recherche, restos, voyages, depenses,
abonnement, conciergerie, famille, agence, admin = 262 clés/langue) ont encore les **valeurs françaises**.
On les traduit. La **structure de clés est déjà identique** (parité fr↔en/it/es = 0 écart) → on ne touche
qu'aux **valeurs**, FR reste la source de vérité.

## 1. Décisions de cadrage (validées)

| Sujet | Décision |
|-------|----------|
| Périmètre | Traduire les 11 namespaces modules dans **en, it, es** (262 clés × 3). |
| Source | `fr.json` = vérité ; ne jamais changer les clés ni les placeholders ICU (`{n}`, …). |
| Registre | **Informel/amical** (« tu » → IT `tu`, ES `tú`), cohérent avec le ton grand public. |
| Garde-fou | Test de **parité** : en/it/es ont exactement le jeu de clés de fr **et** les mêmes placeholders ICU par clé. |

## 2. Test de parité (`src/lib/i18n/messages-parity.test.ts`)

Charge les 4 JSON et vérifie, pour chaque locale ∈ {en, it, es} :
- **jeu de clés feuilles identique** à fr (aucune manquante, aucune en trop) ;
- pour chaque clé, **mêmes placeholders ICU** (`{...}`) que la valeur fr (ordre indifférent).

Passe déjà aujourd'hui (structure identique) ; reste vert après traduction (on ne change que les valeurs).
C'est le filet qui empêche une dérive de clé ou un placeholder perdu pendant la traduction.

## 3. Traduction (en/it/es)

Pour chaque locale, traduire les **valeurs** des 11 namespaces modules depuis `fr.json` vers la langue
cible, en gardant clés et placeholders. Qualité : traduction naturelle, terminologie cohérente (ex.
« Comptes partagés » → EN « Shared accounts », IT « Conti condivisi », ES « Cuentas compartidas » ;
« Conciergerie » → « Concierge »/« Concierge »/« Conserjería »…). Registre informel.

## 4. Sécurité

- Aucune surface : modification de fichiers de traduction uniquement. Pas de code, pas de migration, pas
  de RLS.

## 5. Tests

- **Unit** : le test de parité (clés + placeholders) — vert avant et après.
- **e2e (Playwright)** : connecté, naviguer vers `/en/restos` → le titre de page est en anglais (ex.
  `restos.title` EN) ; la nav reste cohérente. Suite complète verte (les autres specs tournent en `/fr`,
  inchangés).
- Build/typecheck/lint verts (JSON valides).

## 6. Arbitrages / dette signalés

- Traductions générées par IA, registre informel ; une relecture humaine native pourra affiner.
- DE/autres langues : hors périmètre.
