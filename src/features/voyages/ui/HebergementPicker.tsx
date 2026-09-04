"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { searchPlaces } from "@/features/restos/data/actions";
import type { PlaceSummary } from "@/lib/services/places/types";
import { Button } from "@/features/shared/ui/Button";

// Désignation de l'hébergement réservé (lot H6). Le même fournisseur que
// l'onglet Hôtels : l'hôtel choisi rejoint le carnet à l'enregistrement de la
// réservation, avec l'origine « Ajouté via Voyages ».
//
// Rester en texte libre reste possible : toutes les réservations ne visent pas
// un lieu identifiable (une location entre particuliers, une chambre chez un
// ami). C'est pourquoi ce bloc ne remplace pas le champ « fournisseur ».
export function HebergementPicker({ choisi, onChoisir }: {
  choisi: { placeId: string; nom: string } | null;
  onChoisir: (v: { placeId: string; nom: string } | null) => void;
}) {
  const t = useTranslations("voyages");
  const [q, setQ] = useState("");
  const [resultats, setResultats] = useState<PlaceSummary[]>([]);
  const [cherche, setCherche] = useState(false);
  const [pending, start] = useTransition();

  const chercher = () => {
    const terme = q.trim();
    if (!terme) return;
    setCherche(true);
    start(async () => setResultats(await searchPlaces(terme, { includedType: "hotel" })));
  };

  if (choisi) {
    return (
      <div data-testid="hebergement-choisi"
        className="flex items-center gap-2 rounded-control border border-accent/30 bg-accent-50 px-3 py-2">
        <input type="hidden" name="placeId" value={choisi.placeId} />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-accent">{choisi.nom}</span>
        <span className="shrink-0 text-[10.5px] text-accent/80">{t("hebergement.rejoindra")}</span>
        <button type="button" aria-label={t("hebergement.retirer")} data-testid="hebergement-retirer"
          onClick={() => onChoisir(null)}
          className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/15 text-accent focus-visible:outline-2 focus-visible:outline-accent">
          <X size={11} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <label className="relative flex min-w-0 flex-1 items-center">
          <Search size={14} className="pointer-events-none absolute left-3 text-faint" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} data-testid="hebergement-recherche"
            placeholder={t("hebergement.chercher")} aria-label={t("hebergement.chercher")}
            // Entrée dans ce champ = chercher, surtout pas envoyer la réservation
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); chercher(); } }}
            className="w-full rounded-control border border-line bg-surface py-2 pl-8 pr-3 text-sm text-ink outline-none focus:outline-2 focus:outline-accent" />
        </label>
        <Button type="button" variant="ghost" data-testid="hebergement-chercher" pending={pending} onClick={chercher}>
          {t("hebergement.bouton")}
        </Button>
      </div>

      {cherche && resultats.length === 0 && !pending && (
        <p className="text-[11.5px] text-faint">{t("hebergement.aucun")}</p>
      )}
      {resultats.length > 0 && (
        <ul className="flex max-h-44 flex-col overflow-y-auto rounded-[5px] border border-line bg-surface">
          {resultats.map((r) => (
            <li key={r.placeId}>
              <button type="button" data-testid="hebergement-resultat"
                onClick={() => { onChoisir({ placeId: r.placeId, nom: r.nom }); setResultats([]); setQ(""); setCherche(false); }}
                className="flex w-full flex-col items-start gap-0.5 border-b border-line-soft px-3 py-2 text-left last:border-b-0 hover:bg-surface-hover">
                <span className="truncate text-[13px] text-ink">{r.nom}</span>
                {r.adresse && <span className="truncate text-[11px] text-muted">{r.adresse}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
