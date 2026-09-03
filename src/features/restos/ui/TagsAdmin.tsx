"use client";
import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { MoreHorizontal, Plus } from "lucide-react";
import { creerTag, updateTag, fusionnerTags, supprimerTag } from "../data/tagActions";
import { TAG_SCOPES } from "../domain/schemas";
import { Button } from "@/features/shared/ui/Button";
import { Input } from "@/features/shared/ui/Input";
import { Select } from "@/features/shared/ui/Select";
import { Modal } from "@/features/shared/ui/Modal";

export type TagAdmin = {
  id: string; slug: string; label: string; color: string | null;
  scope: "common" | "restaurant" | "hotel" | "vin"; is_system: boolean; user_id: string | null; usages: number;
};

type ScopeFiltre = "tous" | "common" | "restaurant" | "hotel" | "vin";

// Administration des tags (design Onglet_Resto_v2, écran 10) : créer, renommer,
// couleur, portée, fusionner, supprimer. Les tags système sont en lecture seule.
export function TagsAdmin({ tags }: { tags: TagAdmin[] }) {
  const t = useTranslations("restos");
  const [scope, setScope] = useState<ScopeFiltre>("tous");
  const [creation, setCreation] = useState(false);
  const [edition, setEdition] = useState<TagAdmin | null>(null);

  const shown = tags.filter((tg) => scope === "tous" || tg.scope === scope);

  return (
    <div data-testid="tags-admin" className="flex flex-col gap-3.5">
      <div className="flex gap-1.5">
        {(["tous", "common", "restaurant", "hotel", "vin"] as const).map((s) => (
          <button key={s} type="button" aria-pressed={scope === s} onClick={() => setScope(s)}
            className={`rounded-full px-3 py-1.5 text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
              scope === s ? "bg-ink font-semibold text-app" : "border border-line bg-surface-hover text-muted"
            }`}>
            {t(`tags.scopes.${s}`)}
          </button>
        ))}
      </div>

      <ul className="divide-y divide-line-soft overflow-hidden rounded-[6px] border border-line bg-surface">
        {shown.map((tg) => (
          <li key={tg.id} data-testid="tag-row" className="flex items-center gap-3 px-3.5 py-3">
            <span className="h-3.5 w-3.5 shrink-0 rounded-[4px]" style={{ backgroundColor: tg.color ?? "var(--line)" }} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">{tg.label}</div>
              <div className="mt-0.5 text-[11px] text-faint">
                {t(`tags.scopes.${tg.scope}`)} · {t("tags.usages", { n: tg.usages })}
                {tg.is_system ? ` · ${t("tags.systeme")}` : ""}
              </div>
            </div>
            {!tg.is_system && (
              <button type="button" aria-label={t("tags.modifierTitre")} onClick={() => setEdition(tg)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-faint hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent">
                <MoreHorizontal size={16} aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>

      <button type="button" data-testid="tag-nouveau" onClick={() => setCreation(true)}
        className="inline-flex items-center gap-2 self-start rounded-control bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-accent">
        <Plus size={15} aria-hidden />
        {t("tags.nouveau")}
      </button>

      <Modal open={creation} onClose={() => setCreation(false)} title={t("tags.nouveau")}>
        <TagForm mode="create" onDone={() => setCreation(false)} t={t} />
      </Modal>
      <Modal open={edition !== null} onClose={() => setEdition(null)} title={t("tags.modifierTitre")}>
        {edition && <TagForm mode="edit" tag={edition} candidats={tags.filter((x) => x.id !== edition.id)} onDone={() => setEdition(null)} t={t} />}
      </Modal>
    </div>
  );
}

function TagForm({ mode, tag, candidats = [], onDone, t }: {
  mode: "create" | "edit"; tag?: TagAdmin; candidats?: TagAdmin[]; onDone: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [state, action, pending] = useActionState(mode === "create" ? creerTag : (updateTag as typeof creerTag), undefined);
  const [fusionState, fusionAction, fusionPending] = useActionState(fusionnerTags, undefined);
  const [supprState, supprAction, supprPending] = useActionState(supprimerTag, undefined);
  const [cible, setCible] = useState("");

  useEffect(() => {
    const done = [state, fusionState, supprState].some((s) => s && "ok" in s && s.ok);
    if (done) onDone();
  }, [state, fusionState, supprState, onDone]);

  return (
    <div className="flex flex-col gap-4">
      <form action={action} data-testid="tag-form" className="flex flex-col gap-3">
        {mode === "edit" && <input type="hidden" name="tagId" value={tag!.id} />}
        <Input label={t("tags.label")} name="label" required defaultValue={tag?.label ?? ""} />
        <div className="flex items-end gap-3">
          <Select label={t("tags.portee")} name="scope" defaultValue={tag?.scope ?? "restaurant"} className="flex-1">
            {TAG_SCOPES.map((s) => <option key={s} value={s}>{t(`tags.scopes.${s}`)}</option>)}
          </Select>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-muted">{t("tags.couleur")}</span>
            <input type="color" name="color" defaultValue={tag?.color ?? "#5B7F5B"}
              className="h-[38px] w-14 cursor-pointer rounded-control border border-line bg-surface p-1" />
          </label>
        </div>
        {state && "error" in state && state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
        <Button type="submit" pending={pending}>{t("tags.enregistrer")}</Button>
      </form>

      {mode === "edit" && tag && (
        <>
          <form action={fusionAction} className="flex flex-col gap-2 border-t border-line pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{t("tags.fusionnerTitre")}</span>
            <input type="hidden" name="sourceId" value={tag.id} />
            <Select name="cibleId" value={cible} onChange={(e) => setCible(e.target.value)} aria-label={t("tags.fusionnerVers")}>
              <option value="">{t("tags.fusionnerVers")}</option>
              {candidats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
            {cible && (
              <p className="text-xs text-muted">
                {t("tags.fusionnerInfo", { n: tag.usages, cible: candidats.find((c) => c.id === cible)?.label ?? "" })}
              </p>
            )}
            {fusionState && "error" in fusionState && fusionState.error && <p role="alert" className="text-sm text-danger">{fusionState.error}</p>}
            <Button type="submit" variant="ghost" pending={fusionPending} disabled={!cible} data-testid="tag-fusionner">
              {t("tags.fusionnerBtn")}
            </Button>
          </form>

          <form action={supprAction}
            onSubmit={(e) => { if (!confirm(t("tags.supprimerConfirm", { n: tag.usages, label: tag.label }))) e.preventDefault(); }}
            className="border-t border-line pt-3">
            <input type="hidden" name="tagId" value={tag.id} />
            {supprState && "error" in supprState && supprState.error && <p role="alert" className="mb-1 text-sm text-danger">{supprState.error}</p>}
            <Button type="submit" variant="ghost" pending={supprPending} className="text-danger" data-testid="tag-supprimer">
              {t("tags.supprimer")}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
