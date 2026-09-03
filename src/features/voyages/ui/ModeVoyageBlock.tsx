"use client";
import { useCallback, useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Plane, Check, X, Download, Trash2 } from "lucide-react";
import { enregistrerCarnet, etatCarnet, retirerCarnet } from "../data/horsLigneClient";
import { tailleLisible, type MetaCarnet } from "../domain/horsLigne";

// Mode voyage (design Onboarding_Compte écran 12) : emporter UN voyage sur cet
// appareil. Le poids et la date de téléchargement sont affichés — en itinérance,
// on ne lance pas un téléchargement à l'aveugle.
export function ModeVoyageBlock({ voyageId, locale, documentIds, enCours, destination }: {
  voyageId: string;
  locale: string;
  documentIds: string[];
  enCours: boolean;
  destination: string | null;
}) {
  const t = useTranslations("voyages");
  const format = useFormatter();
  const [meta, setMeta] = useState<MetaCarnet | null>(null);
  const [phase, setPhase] = useState<"repos" | "travail" | "echec">("repos");

  const relire = useCallback(() => { void etatCarnet().then(setMeta); }, []);

  // Ce qui est stocké sur l'appareil ne peut être lu qu'au montage, côté client.
  useEffect(() => { relire(); }, [relire]);

  const telecharger = async () => {
    setPhase("travail");
    try {
      setMeta(await enregistrerCarnet(locale, voyageId, documentIds));
      setPhase("repos");
    } catch {
      setPhase("echec");
    }
  };

  const retirer = async () => {
    await retirerCarnet();
    setMeta(null);
    setPhase("repos");
  };

  const emporte = meta?.voyageId === voyageId;
  const autreVoyage = meta !== null && !emporte;

  return (
    <div data-testid="mode-voyage" className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <Plane size={17} className="shrink-0 text-accent" aria-hidden />
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-ink">{t("horsLigne.titre")}</div>
          <div className="text-[11px] text-faint">
            {enCours && destination
              ? t("horsLigne.actifPendant", { destination })
              : t("horsLigne.emporterExplication")}
          </div>
        </div>
      </div>

      <ul className="flex flex-col gap-1.5">
        <li className="flex gap-2 text-[12px] leading-snug text-ink">
          <Check size={14} className="mt-0.5 shrink-0 text-kpi-green" aria-hidden />
          <span>{t("horsLigne.promesseVouchers")}</span>
        </li>
        <li className="flex gap-2 text-[12px] leading-snug text-ink">
          <X size={14} className="mt-0.5 shrink-0 text-danger" aria-hidden />
          <span>{t("horsLigne.identiteProtegee")}</span>
        </li>
      </ul>

      {emporte && meta && (
        <p data-testid="mode-voyage-etat" className="text-[11.5px] text-muted">
          {t("horsLigne.disponible", { documents: meta.documents, taille: tailleLisible(meta.octets) })}
          {" · "}
          {t("horsLigne.telechargeLe", { date: format.dateTime(new Date(meta.enregistreLe), { dateStyle: "medium" }) })}
        </p>
      )}
      {autreVoyage && (
        <p className="text-[11.5px] text-muted">{t("horsLigne.autreVoyageEmporte")}</p>
      )}
      {phase === "echec" && (
        <p role="alert" className="text-[11.5px] text-danger">{t("horsLigne.echec")}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {emporte ? (
          <>
            <a href={`/${locale}/carnet-hors-ligne/${voyageId}`} data-testid="mode-voyage-ouvrir"
              className="rounded-control border border-line bg-surface-hover px-3 py-1.5 text-[11.5px] font-semibold text-ink hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent">
              {t("horsLigne.ouvrirCarnet")}
            </a>
            <button type="button" onClick={retirer} data-testid="mode-voyage-retirer"
              className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-muted hover:text-ink">
              <Trash2 size={13} aria-hidden /> {t("horsLigne.retirer")}
            </button>
          </>
        ) : (
          <button type="button" onClick={telecharger} disabled={phase === "travail"}
            data-testid="mode-voyage-telecharger"
            className="inline-flex items-center gap-1.5 rounded-control bg-accent px-3 py-1.5 text-[11.5px] font-semibold text-white hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60">
            <Download size={13} aria-hidden />
            {phase === "travail" ? t("horsLigne.enCours") : t("horsLigne.telecharger")}
          </button>
        )}
      </div>
    </div>
  );
}
