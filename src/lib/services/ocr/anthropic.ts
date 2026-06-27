import Anthropic from "@anthropic-ai/sdk";
import type {
  DocumentBlockParam,
  ImageBlockParam,
} from "@anthropic-ai/sdk/resources/messages/messages";
import type { OcrProvider, OcrResult, OcrFields } from "./types";
import { EMPTY_FIELDS } from "./types";

const PROMPT =
  "Tu es un moteur d'extraction de pièces d'identité. À partir de l'image/PDF fourni, renvoie " +
  "UNIQUEMENT un objet JSON valide, sans texte autour, avec exactement ces clés : doc_number, " +
  "country, holder_name, issue_date, expiry_date, issue_place. Les dates au format ISO " +
  "YYYY-MM-DD. Mets null pour tout champ illisible ou absent. N'invente rien.";

function parseFields(text: string): OcrFields {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return { ...EMPTY_FIELDS };
    const o = JSON.parse(text.slice(start, end + 1)) as Partial<OcrFields>;
    const s = (v: unknown) =>
      typeof v === "string" && v.trim() !== "" ? v.trim() : null;
    return {
      doc_number: s(o.doc_number),
      country: s(o.country),
      holder_name: s(o.holder_name),
      issue_date: s(o.issue_date),
      expiry_date: s(o.expiry_date),
      issue_place: s(o.issue_place),
    };
  } catch {
    return { ...EMPTY_FIELDS };
  }
}

export class AnthropicOcrProvider implements OcrProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async read(bytes: Buffer, mimeType: string, _docType: string): Promise<OcrResult> {
    const b64 = bytes.toString("base64");

    const contentBlock: DocumentBlockParam | ImageBlockParam =
      mimeType === "application/pdf"
        ? {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: b64,
            },
          }
        : {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: b64,
            },
          };

    const resp = await this.client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [contentBlock, { type: "text", text: PROMPT }],
        },
      ],
    });

    const textBlock = resp.content.find((b) => b.type === "text");
    const fields = parseFields(
      textBlock && "text" in textBlock ? textBlock.text : ""
    );

    return { fields, raw: resp };
  }
}
