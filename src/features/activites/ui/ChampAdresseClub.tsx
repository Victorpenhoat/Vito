"use client";
import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { searchPlaces } from "@/features/restos/data/actions";

type Suggestion = { placeId: string; nom: string; adresse: string | null; lat?: number | null; lng?: number | null };

/**
 * L'adresse du club, choisie plutôt que tapée.
 *
 * La maquette montre pourquoi : « 12 route du Cap, Le Teich » et « 12 route du
 * Cap-Ferret, Lège-Cap-Ferret » ne se départagent pas à la frappe. Choisir une
 * suggestion apporte en prime les COORDONNÉES — sans elles, un club n'apparaît
 * sur aucune carte et n'a pas de durée de trajet.
 *
 * La saisie libre reste possible : un club de village peut n'être dans aucune
 * base. On garde alors le texte, sans coordonnées, et on le dit par l'absence
 * de repère plutôt que par un message.
 */
export function ChampAdresseClub({ nomChamp = "adresse" }: { nomChamp?: string }) {
  const t = useTranslations("activites");
  const [saisie, setSaisie] = useState("");
  const [point, setPoint] = useState<{ lat: number; lng: number; placeId: string } | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [ouvert, setOuvert] = useState(false);
  // La dernière requête lancée : une réponse plus lente qu'une autre ne doit
  // pas écraser des suggestions plus récentes.
  const dernier = useRef(0);

  useEffect(() => {
    const requete = saisie.trim();
    // On ne VIDE pas la liste ici : effacer un état depuis un effet est un
    // rendu de plus pour rien. Les suggestions périmées restent en mémoire et
    // ne sont simplement pas affichées (cf. `afficher` plus bas).
    if (requete.length < 3 || point) return;
    const rang = ++dernier.current;
    // Report : la recherche d'adresses est un appel payant, on ne le déclenche
    // pas à chaque lettre.
    const pause = setTimeout(async () => {
      const res = await searchPlaces(requete, {});
      if (rang === dernier.current) { setSuggestions(res.slice(0, 5)); setOuvert(true); }
    }, 350);
    return () => clearTimeout(pause);
  }, [saisie, point]);

  // Ce qui s'affiche se DÉDUIT : trois lettres au moins, aucune adresse déjà
  // choisie, et une liste non vide.
  const afficher = ouvert && !point && saisie.trim().length >= 3 && suggestions.length > 0;

  const champ = "rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent";
  return (
    <div className="relative flex flex-col gap-1">
      <input
        name={nomChamp}
        value={saisie}
        onChange={(e) => { setSaisie(e.target.value); setPoint(null); }}
        data-testid="activite-adresse"
        placeholder={t("nouvelle.adresse")}
        aria-label={t("nouvelle.adresse")}
        autoComplete="off"
        className={champ}
      />
      {/* Les coordonnées voyagent avec le formulaire : c'est la suggestion
          choisie qui les apporte, pas une seconde requête au serveur. */}
      <input type="hidden" name="lat" value={point?.lat ?? ""} />
      <input type="hidden" name="lng" value={point?.lng ?? ""} />
      <input type="hidden" name="placeId" value={point?.placeId ?? ""} />

      {point && (
        <span data-testid="adresse-situee" className="inline-flex items-center gap-1 text-[11px] font-semibold text-kpi-green">
          <MapPin size={10} aria-hidden />
          {t("nouvelle.adresseSituee")}
        </span>
      )}

      {afficher && (
        <ul data-testid="adresse-suggestions"
          className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-control border border-line bg-surface shadow-[0_8px_24px_var(--color-shadow)]">
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button type="button" data-testid="adresse-suggestion"
                onClick={() => {
                  setSaisie([s.nom, s.adresse].filter(Boolean).join(", "));
                  if (s.lat != null && s.lng != null) {
                    setPoint({ lat: s.lat, lng: s.lng, placeId: s.placeId });
                  }
                  setOuvert(false);
                }}
                className="flex w-full flex-col items-start gap-0.5 border-b border-line-soft px-3 py-2 text-left last:border-b-0 hover:bg-surface-hover">
                <span className="text-[13px] text-ink">{s.nom}</span>
                {s.adresse && <span className="text-[11.5px] text-muted">{s.adresse}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
