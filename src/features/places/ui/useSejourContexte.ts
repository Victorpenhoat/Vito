"use client";
import { useEffect, useState } from "react";
import {
  lireContexte, contextePerime, CONTEXTE_DEFAUT, type SejourContexte,
} from "../domain/sejourContexte";

// Le contexte de séjour vit dans le localStorage : c'est une intention de
// recherche, pas une donnée du carnet — rien à écrire en base, et il doit
// survivre au passage de la recherche à la fiche.
//
// Lecture après hydratation (le serveur ne connaît pas le localStorage) : même
// mécanique que les recherches récentes de CategoryDiscovery.

export const CLE_CONTEXTE_SEJOUR = "vito.sejour.contexte";

function lireStockage(): SejourContexte {
  try {
    const brut = localStorage.getItem(CLE_CONTEXTE_SEJOUR);
    return brut ? lireContexte(JSON.parse(brut)) : CONTEXTE_DEFAUT;
  } catch {
    // localStorage indisponible (navigation privée) ou JSON illisible
    return CONTEXTE_DEFAUT;
  }
}

/** Contexte modifiable, persistant. L'écriture horodate — c'est ce qui le périme. */
export function useSejourContexte(): {
  contexte: SejourContexte;
  enregistrer: (suivant: SejourContexte) => void;
} {
  const [contexte, setContexte] = useState<SejourContexte>(CONTEXTE_DEFAUT);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydratation localStorage SSR-safe (pattern recents)
    setContexte(lireStockage());
  }, []);

  const enregistrer = (suivant: SejourContexte) => {
    const horodate = { ...suivant, misAJourLe: new Date().toISOString().slice(0, 10) };
    setContexte(horodate);
    try { localStorage.setItem(CLE_CONTEXTE_SEJOUR, JSON.stringify(horodate)); } catch { /* ignore */ }
  };

  return { contexte, enregistrer };
}

/**
 * Contexte à REPRENDRE pour préremplir un formulaire : null s'il n'y en a pas,
 * ou s'il est trop vieux pour dire encore quelque chose de l'intention.
 */
export function useContexteRepris(): SejourContexte | null {
  const [repris, setRepris] = useState<SejourContexte | null>(null);

  useEffect(() => {
    const contexte = lireStockage();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydratation localStorage SSR-safe (pattern recents)
    setRepris(contextePerime(contexte, new Date()) ? null : contexte);
  }, []);

  return repris;
}
