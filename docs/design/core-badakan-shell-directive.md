# Directive design — Shell & identité visuelle (façon Core.Badakan)

> Directive produit fournie par le PO le 2026-06-23. Source de vérité pour la refonte
> « identité Core.Badakan ». Remplace la direction « moderne épuré / clair / indigo / nav en haut »
> de la Slice 1 (PR #15) : thème sombre bleu-nuit + sidebar desktop / bottom-nav mobile.

## Objectif

Reproduire l'identité visuelle de l'ERP **Core.Badakan** : thème sombre bleu-nuit, menu latéral fixe
(desktop), cartes arrondies, tuiles KPI colorées, finition premium. Même famille visuelle.

**Contrainte clé :** app **mobile-first (PWA)**. Sidebar = nav desktop ; sur mobile → **barre d'onglets
en bas** + **drawer** pour le secondaire. Ne jamais sacrifier l'ergonomie mobile pour copier le desktop.

TypeScript strict + Tailwind, **kit UI partagé réutilisable** (équivalent `shared/` de Badakan : Button,
Badge, Card, Tile, NavItem, Modal, Toast). Pas de logique métier dans ces composants.

## Design tokens

**Couleurs**

| Rôle | Valeur |
|---|---|
| Fond app | `#0A0E17` |
| Fond sidebar | `#090C14` |
| Surface carte | `#141925` |
| Surface carte (hover/élevée) | `#1A2030` |
| Bordure | `rgba(255,255,255,0.06)` |
| Dégradé hero | diagonal `#1B2138` → `#2A2140` |
| Accent primaire | `#2563EB` (hover `#3B82F6`) |
| Texte principal | `#F5F7FA` |
| Texte secondaire | `#8A93A6` |
| Texte discret | `#5B6373` |

**Tuiles KPI** (fond teinté léger + texte vif)
- Vert : fond `rgba(34,197,94,0.08)`, valeur `#4ADE80`
- Bleu : fond `rgba(59,130,246,0.08)`, valeur `#60A5FA`
- Ambre : fond `rgba(245,158,11,0.08)`, valeur `#FBBF24`
- Violet : fond `rgba(168,85,247,0.08)`, valeur `#C084FC`

**Formes & typo**
- Rayons : cartes `rounded-2xl` (~16–20px), tuiles ~14px, FAB plein.
- Police : Inter (system-ui en fallback).
- Labels de section : MAJUSCULES, `text-xs`, `tracking-wide`, couleur secondaire, souvent un emoji.
- Titres : gras, blanc, beaucoup de respiration.
- Badges/compteurs : pastille `#1E2435`, chiffre clair.

**Thème** : sombre par défaut + toggle clair/sombre. i18n FR/EN/IT/ES dès le shell (sélecteur footer).

## Shell — Sidebar (desktop)

Sidebar fixe gauche ~264px, fond `#090C14`, pleine hauteur :
1. En-tête logo : badge carré arrondi + nom MAJUSCULES `tracking-wide`.
2. Navigation : items (chevron + icône `lucide-react` + libellé), hover `#141925`, actif (teinte accent +
   indicateur). **Pilotée par les permissions RBAC.**
   - `client` : Accueil, Mes restos, Mes vins, Recherche, Voyages, Famille.
   - `admin` : + Back-office (et sous-sections).
   - `agence` : Mes clients / Voyages déposés.
3. Footer (bas) : Paramétrage (engrenage) · séparateur · carte utilisateur (avatar initiales sur accent,
   nom + rôle) · sélecteur langue `FR · EN · IT · ES` + toggle thème (lune/soleil).

## Shell — Mobile

- Sidebar masquée. **Bottom-tab bar fixe** avec les 4–5 entrées principales (icône + label court), actif
  en accent.
- Secondaire (Paramétrage, langue, thème, profil) dans un **drawer** (depuis avatar/burger en header).
- Contenu pleine largeur, padding réduit, cartes en une colonne.

## Écran de référence — Accueil

- **Hero card** pleine largeur, dégradé navy→violet : salutation contextuelle (« Bonsoir {prénom} 🌙 »),
  date du jour, citation avec barre d'accent à gauche, et en haut à droite un élément discret
  (« X sorties ce mois » + étoiles).
- Lien d'action sous le hero (« + Ajouter un resto »).
- **Grille de 3 cartes** (→ 1 col mobile) :
  - À FAIRE : lignes (icône + libellé + badge compteur).
  - CE MOIS-CI : grille 2×2 de tuiles KPI colorées (label + grand chiffre).
  - DÉCOUVERTES : suggestions (titre + source).
- ACTIVITÉ RÉCENTE : carte pleine largeur, lignes (icône + titre + horodatage relatif).
- **FAB** bas-droite : cercle accent `#2563EB`, ombre portée, action rapide.

## Attendu (séquencement)

1. **D'abord** : thème Tailwind (tokens) + inventaire des composants partagés → validation.
2. **Shell responsive** (sidebar ↔ bottom-nav + drawer), nav RBAC, footer complet.
3. **Écran Accueil de référence** (données mockées) pour figer l'esthétique.
4. Tests : responsive desktop/mobile, états actif/hover, bascule thème, changement langue.

Respect : RLS/RBAC, types stricts, tests, zéro dette.
