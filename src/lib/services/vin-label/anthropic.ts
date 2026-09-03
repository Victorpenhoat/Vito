import Anthropic from "@anthropic-ai/sdk";
import type { ImageBlockParam } from "@anthropic-ai/sdk/resources";
import type { Confiance, LabelAnalyse, LabelConfiance, LabelFields, LabelResult, VinLabelProvider } from "./types";
import { CONFIANCES, EMPTY_LABEL_FIELDS, VIN_COULEURS_LABEL } from "./types";

export const VIN_LABEL_MODEL = "claude-sonnet-5";

const PROMPT =
  "Tu es un sommelier qui lit une étiquette de bouteille de vin. Renvoie UNIQUEMENT un objet JSON " +
  "valide, sans texte autour, avec exactement ces clés :\n" +
  '{"fields":{"domaine","cuvee","appellation","millesime","couleur","cepages","degre","region"},' +
  '"confiance":{"domaine","cuvee","appellation","millesime","couleur","cepages","degre","region"},' +
  '"analyse":{"profil":{"corps","tanins","acidite","sucre"},"aromes","accords",' +
  '"service":{"temperature","carafage","garde"},"prixEstime","presentation"},"illisible"}\n' +
  "Règles : `couleur` vaut rouge, blanc, rose, petillant ou autre. `millesime` et `degre` sont des " +
  "nombres, `cepages`, `aromes` et `accords` des tableaux de chaînes. Les valeurs de `confiance` " +
  "valent sur, probable ou a_verifier — mets a_verifier dès qu'un caractère est ambigu. " +
  "`profil` note de 0 à 5 le corps, les tanins, l'acidité et le sucre. `prixEstime` est le prix " +
  "caviste indicatif en euros. `presentation` fait 4 à 6 lignes sur le domaine et l'appellation. " +
  "Mets null pour tout champ illisible ou absent : n'invente JAMAIS une valeur. Si l'étiquette est " +
  "globalement illisible (photo trop sombre ou floue), mets illisible à true et tous les champs à null.";

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.flatMap((x) => (typeof x === "string" && x.trim() ? [x.trim()] : [])) : [];
const conf = (v: unknown): Confiance | undefined =>
  typeof v === "string" && (CONFIANCES as readonly string[]).includes(v) ? (v as Confiance) : undefined;

function parseResult(text: string): { fields: LabelFields; confiance: LabelConfiance; analyse: LabelAnalyse | null; illisible: boolean } {
  const vide = { fields: { ...EMPTY_LABEL_FIELDS }, confiance: {}, analyse: null, illisible: true };
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return vide;
    const o = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    const f = (o.fields ?? {}) as Record<string, unknown>;
    const couleurBrute = str(f.couleur)?.toLowerCase();
    const couleur = couleurBrute && (VIN_COULEURS_LABEL as readonly string[]).includes(couleurBrute)
      ? (couleurBrute as LabelFields["couleur"])
      : null;
    const fields: LabelFields = {
      domaine: str(f.domaine),
      cuvee: str(f.cuvee),
      appellation: str(f.appellation),
      millesime: num(f.millesime),
      couleur,
      cepages: strArr(f.cepages),
      degre: num(f.degre),
      region: str(f.region),
    };
    const c = (o.confiance ?? {}) as Record<string, unknown>;
    const confiance: LabelConfiance = {};
    for (const cle of Object.keys(fields) as (keyof LabelFields)[]) {
      const niveau = conf(c[cle]);
      if (niveau) confiance[cle] = niveau;
    }
    let analyse: LabelAnalyse | null = null;
    const a = o.analyse as Record<string, unknown> | undefined;
    if (a && typeof a === "object") {
      const p = (a.profil ?? {}) as Record<string, unknown>;
      const s = (a.service ?? {}) as Record<string, unknown>;
      analyse = {
        profil: { corps: num(p.corps), tanins: num(p.tanins), acidite: num(p.acidite), sucre: num(p.sucre) },
        aromes: strArr(a.aromes),
        accords: strArr(a.accords),
        service: { temperature: str(s.temperature), carafage: str(s.carafage), garde: str(s.garde) },
        prixEstime: num(a.prixEstime),
        presentation: str(a.presentation),
      };
    }
    // « illisible » explicite, ou aucun champ identifiant reconnu
    const rienDeLu = !fields.domaine && !fields.cuvee && !fields.appellation;
    return { fields, confiance, analyse, illisible: o.illisible === true || rienDeLu };
  } catch {
    return vide;
  }
}

export class AnthropicVinLabelProvider implements VinLabelProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async read(bytes: Buffer | null, mimeType: string | null, hint?: string): Promise<LabelResult> {
    const contenu: Anthropic.MessageParam["content"] = [];
    if (bytes && mimeType) {
      const bloc: ImageBlockParam = {
        type: "image",
        source: {
          type: "base64",
          media_type: mimeType as "image/jpeg" | "image/png" | "image/webp",
          data: bytes.toString("base64"),
        },
      };
      contenu.push(bloc);
    }
    contenu.push({
      type: "text",
      text: hint?.trim()
        ? `${PROMPT}\nAucune photo : appuie-toi sur cette description saisie par l'utilisateur — « ${hint.trim()} ».`
        : PROMPT,
    });

    const resp = await this.client.messages.create({
      model: VIN_LABEL_MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: contenu }],
    });

    const textBlock = resp.content.find((b) => b.type === "text");
    const parsed = parseResult(textBlock && "text" in textBlock ? textBlock.text : "");
    return { ...parsed, modele: VIN_LABEL_MODEL, raw: resp };
  }
}
