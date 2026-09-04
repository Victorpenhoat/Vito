"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Paperclip } from "lucide-react";
import { useRouter } from "@/lib/i18n/routing";
import { ajouterDocument } from "../data/documents";
import { Button } from "@/features/shared/ui/Button";
import { FileField } from "@/features/shared/ui/FileField";

type Doc = { id: string; nom: string; taille: number };

// Vouchers d'une réservation (Lot C) : le billet se dépose et se relit là où on
// le cherche — sous sa réservation. Le fichier reste un document du voyage
// (chiffré en colonne, servi par la route protégée) : il survit d'ailleurs à la
// suppression de la réservation.
export function ReservationVouchers({ voyageId, reservationId, documents }: {
  voyageId: string; reservationId: string; documents: Doc[];
}) {
  const t = useTranslations("voyages.documents");
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [deposes, setDeposes] = useState<Doc[]>([]);

  const connus = new Set(documents.map((d) => d.id));
  const visibles = [...documents, ...deposes.filter((d) => !connus.has(d.id))];

  async function deposer(form: HTMLFormElement) {
    // FormData lue avant tout await (piège du lot V-C), et action appelée hors
    // transition : l'affichage optimiste prend le relais du rafraîchissement.
    const fd = new FormData(form);
    fd.set("voyageId", voyageId);
    fd.set("reservationId", reservationId);
    const fichier = fd.get("file");
    if (!(fichier instanceof File) || fichier.size === 0) return;

    setEnCours(true);
    setErreur(null);
    const res = await ajouterDocument(undefined, fd);
    setEnCours(false);
    if (!("id" in res) || !res.id) {
      setErreur(("error" in res && res.error) || t("echec"));
      return;
    }
    setDeposes((liste) => [...liste, { id: res.id, nom: fichier.name, taille: fichier.size }]);
    form.reset();
    setOuvert(false);
    router.refresh();
  }

  return (
    <span data-testid="reservation-vouchers" className="flex flex-col gap-1">
      {visibles.length > 0 && (
        <span className="flex flex-wrap gap-1.5">
          {visibles.map((d) => (
            <a key={d.id} href={`/api/voyages/documents/${d.id}`} download data-testid="voucher-lien"
              className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-hover px-2.5 py-1 text-[11px] text-ink hover:border-accent/30">
              <Paperclip size={10} className="text-accent" aria-hidden />
              <span className="max-w-[14rem] truncate">{d.nom}</span>
            </a>
          ))}
        </span>
      )}

      {erreur && <span role="alert" className="text-[11.5px] text-danger">{erreur}</span>}

      {!ouvert ? (
        <button type="button" data-testid="voucher-ajouter" onClick={() => setOuvert(true)}
          className="self-start text-[11.5px] font-semibold text-accent focus-visible:outline-2 focus-visible:outline-accent">
          + {t("voucherAjouter")}
        </button>
      ) : (
        <form data-testid="voucher-form" className="flex flex-col gap-2 rounded-card border border-line bg-surface p-2.5"
          onSubmit={(e) => { e.preventDefault(); void deposer(e.currentTarget); }}>
          <FileField name="file" required accept=".pdf,image/jpeg,image/png,image/webp"
            label={t("choisirFichier")} emptyLabel={t("aucunFichier")} />
          <span className="flex gap-2">
            <Button type="submit" data-testid="voucher-deposer" pending={enCours}>{t("deposer")}</Button>
            <Button type="button" variant="ghost" onClick={() => setOuvert(false)}>{t("annuler")}</Button>
          </span>
        </form>
      )}
    </span>
  );
}
