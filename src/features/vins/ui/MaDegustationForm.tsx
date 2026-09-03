"use client";
import { useState } from "react";
import { useRouter } from "@/lib/i18n/routing";
import { useTranslations } from "next-intl";
import { Check, Plus, X } from "lucide-react";
import { enregistrerDegustation } from "../data/actions";
import { LIEUX_DEGUSTATION, PRIX_UNITES } from "../domain/schemas";
import { NoteVerres } from "./NoteVerres";
import { Button } from "@/features/shared/ui/Button";
import { DateField } from "@/features/shared/ui/DateField";
import { Input, fieldClass } from "@/features/shared/ui/Input";

type TagLite = { id: string; slug: string; label: string; color: string | null };

// Ma dégustation (design Vins & Cave écran 3), étape 2/2 de la capture : ce que
// J'AI vécu, à distinguer de la fiche du vin, qui est générée.
export function MaDegustationForm({ vinId, resume, tags, etablissementId, etablissementNom, visiteId, onEnregistre }: {
  vinId: string;
  resume?: string;
  tags: TagLite[];
  etablissementId?: string;
  etablissementNom?: string;
  visiteId?: string;
  onEnregistre?: () => void;
}) {
  const t = useTranslations("vins");
  const router = useRouter();
  // Appel direct de l'action, hors transition React : sous charge, une
  // transition peut rester non commitée (course routeur Next, PR #71) et le
  // bouton resterait « en cours » alors que la dégustation est enregistrée.
  // C'est nous qui rafraîchissons la Cave, une fois la réponse en main.
  const [state, setState] = useState<{ error?: string; ok?: true } | undefined>();
  const [pending, setPending] = useState(false);
  const [choisis, setChoisis] = useState<Set<string>>(new Set());
  const [nouveaux, setNouveaux] = useState<string[]>([]);
  const [saisie, setSaisie] = useState("");
  const [ajout, setAjout] = useState(false);
  const [lieu, setLieu] = useState<string>(etablissementId ? "restaurant" : "maison");

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const reponse = await enregistrerDegustation(undefined, new FormData(e.currentTarget))
      .catch(() => ({ error: t("echecDegustation") }));
    setPending(false);
    setState(reponse);
    if (reponse && "ok" in reponse && reponse.ok) {
      onEnregistre?.();
      router.refresh();
    }
  }

  const basculer = (id: string) =>
    setChoisis((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const ajouterTag = () => {
    const label = saisie.trim();
    if (label && !nouveaux.includes(label)) setNouveaux((n) => [...n, label]);
    setSaisie("");
    setAjout(false);
  };

  return (
    <form onSubmit={envoyer} data-testid="ma-degustation" className="flex flex-col gap-4">
      <input type="hidden" name="vinId" value={vinId} />
      {etablissementId && <input type="hidden" name="etablissementId" value={etablissementId} />}
      {visiteId && <input type="hidden" name="visiteId" value={visiteId} />}
      {resume && <p className="text-[12.5px] text-muted">{resume}</p>}

      <section className="flex flex-col gap-1.5">
        <Label>{t("maNote")}</Label>
        <NoteVerres name="note" />
      </section>

      <section className="flex flex-col gap-1.5">
        <Label>{t("tagsVerdict")}</Label>
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((tag) => {
            const actif = choisis.has(tag.id);
            return (
              <button key={tag.id} type="button" onClick={() => basculer(tag.id)}
                data-testid={`tag-${tag.slug}`} aria-pressed={actif}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition ${
                  actif ? "border-accent/30 bg-accent-50 text-accent" : "border-line bg-surface-hover text-muted hover:text-ink"
                }`}>
                {actif && <Check size={11} aria-hidden />}{tag.label}
              </button>
            );
          })}
          {nouveaux.map((label) => (
            <span key={label} data-testid="tag-nouveau"
              className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent-50 px-2.5 py-1 text-[11.5px] font-semibold text-accent">
              {label}
              <button type="button" aria-label={t("retirerTag", { tag: label })}
                onClick={() => setNouveaux((n) => n.filter((x) => x !== label))}>
                <X size={11} aria-hidden />
              </button>
            </span>
          ))}
          {ajout ? (
            <span className="inline-flex items-center gap-1">
              <input autoFocus value={saisie} onChange={(e) => setSaisie(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ajouterTag(); } }}
                data-testid="tag-saisie" placeholder={t("nouveauTag")}
                className="w-32 rounded-full border border-line bg-surface px-2.5 py-1 text-[11.5px] text-ink outline-none focus:outline-2 focus:outline-accent" />
              <button type="button" onClick={ajouterTag} data-testid="tag-valider"
                className="text-[11.5px] font-semibold text-accent">{t("ajouterTag")}</button>
            </span>
          ) : (
            <button type="button" onClick={() => setAjout(true)} data-testid="tag-ouvrir"
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2.5 py-1 text-[11.5px] font-semibold text-muted hover:text-ink">
              <Plus size={11} aria-hidden />{t("nouveau")}
            </button>
          )}
        </div>
        {/* Les tags voyagent en champs cachés : le formulaire reste une vraie
            soumission, utilisable même si le JavaScript de la page a échoué. */}
        {[...choisis].map((id) => <input key={id} type="hidden" name="tagIds" value={id} />)}
        {nouveaux.map((label) => <input key={label} type="hidden" name="nouveauxTags" value={label} />)}
      </section>

      <textarea name="commentaire" rows={2} placeholder={t("commentaire")} className={fieldClass} />

      <section className="flex flex-col gap-1.5">
        <Label>{t("prixPaye")}</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input name="prixPaye" type="number" min={0} step="0.01" placeholder="—" className="w-24" aria-label={t("prixPaye")} />
          <div className="flex overflow-hidden rounded-control border border-line">
            {PRIX_UNITES.map((u) => (
              <label key={u} className="cursor-pointer">
                <input type="radio" name="prixUnite" value={u} defaultChecked={u === "bouteille"} className="peer sr-only" />
                <span className="block px-2.5 py-1.5 text-[11.5px] font-semibold text-muted peer-checked:bg-accent-50 peer-checked:text-accent">
                  {t(`unites.${u}`)}
                </span>
              </label>
            ))}
          </div>
          <DateField name="degusteLe" aria-label={t("date")} title={t("date")} />
        </div>
      </section>

      <section className="flex flex-col gap-1.5">
        <Label>{t("lieu")}</Label>
        {etablissementId ? (
          // Le lieu est déjà connu : le redemander inviterait à le contredire.
          <p data-testid="lieu-visite" className="text-[12.5px] text-ink">
            {t("lieVisite", { lieu: etablissementNom ?? "" })}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {LIEUX_DEGUSTATION.filter((l) => l !== "restaurant").map((l) => (
                <label key={l} className="cursor-pointer">
                  <input type="radio" name="lieuType" value={l} checked={lieu === l}
                    onChange={() => setLieu(l)} className="peer sr-only" />
                  <span className={`block rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${
                    lieu === l ? "border-accent/30 bg-accent-50 text-accent" : "border-line bg-surface-hover text-muted"
                  }`}>
                    {t(`lieux.${l}`)}
                  </span>
                </label>
              ))}
            </div>
            {lieu === "autre" && <Input name="lieuNom" placeholder={t("lieuNom")} />}
          </>
        )}
      </section>

      <label className="flex items-center gap-2 text-[12.5px] text-ink">
        <input type="checkbox" name="aRacheter" data-testid="a-racheter" className="size-4 accent-[var(--accent)]" />
        <span>
          {t("envieRetrouver")}
          <span className="ml-1 text-[11px] text-faint">{t("envieRetrouverAide")}</span>
        </span>
      </label>

      {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <Button type="submit" pending={pending} data-testid="enregistrer-degustation">{t("enregistrerDegustation")}</Button>
    </form>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{children}</span>;
}
