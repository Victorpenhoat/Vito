"use client";
import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { Modal } from "@/features/shared/ui/Modal";
import { ExperienceForm } from "./ExperienceForm";
import {
  basculeProposee, etatReservation,
  type ReservationHebergement, type SejourEnregistre,
} from "../domain/sejourAVenir";
import type { VoyageLite } from "../domain/voyageCouvrant";

type TagLite = { id: string; slug: string; label: string; color: string | null };

// Séjours réservés (design Hôtels v2 écran 6 : « 12 → 15 octobre 2026 · à
// venir »). Ces lignes viennent des RÉSERVATIONS de voyage, pas des visites :
// une réservation s'annule, un séjour se vit. Quand la date est passée, la
// bascule est PROPOSÉE — jamais faite dans le dos.
export function SejoursAVenirBlock({
  reservations, sejours, listeItemId, nom, tags, voyages, aujourdhui,
}: {
  reservations: ReservationHebergement[];
  sejours: SejourEnregistre[];
  /** null quand l'hôtel n'est pas (ou plus) dans le carnet : rien à enregistrer. */
  listeItemId: string | null;
  nom: string;
  tags: TagLite[];
  voyages: VoyageLite[];
  /** « YYYY-MM-DD » calculé au rendu serveur : le domaine ne lit pas l'horloge. */
  aujourdhui: string;
}) {
  const t = useTranslations("hotels");
  const format = useFormatter();
  const [bascule, setBascule] = useState<ReservationHebergement | null>(null);

  if (reservations.length === 0) return null;

  const jour = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00Z`), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div data-testid="sejours-reserves" className="flex flex-col gap-1.5">
      <ul className="divide-y divide-line-soft overflow-hidden rounded-[5px] border border-line bg-surface">
        {reservations.map((r) => {
          const etat = etatReservation(r, aujourdhui);
          const aProposer = basculeProposee(r, sejours, aujourdhui) && listeItemId != null;
          return (
            <li key={r.id} data-testid="sejour-reserve" className="flex flex-wrap items-center gap-2 px-3.5 py-2.5">
              <span className="min-w-0 flex-1 text-[12.5px] text-ink">
                <span className="font-medium">
                  {r.dateDebut ? jour(r.dateDebut) : t("reservation.sansDates")}
                  {r.dateFin && r.dateDebut ? ` → ${jour(r.dateFin)}` : ""}
                </span>
                <span className="text-faint"> · {t(`reservation.etats.${etat}`)}</span>
              </span>
              <Link href={`/voyages/${r.voyageId}`} data-testid="sejour-reserve-voyage"
                className="shrink-0 rounded-full border border-accent/25 bg-accent-50 px-2 py-0.5 text-[10px] font-semibold text-accent hover:underline">
                {t("visite.voyageLien", { titre: r.voyageTitre ?? "" })} →
              </Link>
              {aProposer && (
                <button type="button" data-testid="bascule-sejour" onClick={() => setBascule(r)}
                  className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-[11px] font-semibold text-app focus-visible:outline-2 focus-visible:outline-accent">
                  {t("reservation.bascule")}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {bascule && listeItemId && bascule.dateDebut && (
        <Modal open onClose={() => setBascule(null)} title={t("visite.titre", { nom })}>
          <p className="mb-2 text-[12px] text-muted">{t("reservation.basculeAide")}</p>
          <ExperienceForm listeItemId={listeItemId} tags={tags} categorie="hotel" voyages={voyages}
            sejourInitial={{ arrivee: bascule.dateDebut, depart: bascule.dateFin }}
            onDone={() => setBascule(null)} />
        </Modal>
      )}
    </div>
  );
}
