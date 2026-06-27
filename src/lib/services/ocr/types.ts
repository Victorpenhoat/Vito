export type OcrFields = {
  doc_number: string | null;
  country: string | null;
  holder_name: string | null;
  issue_date: string | null; // ISO YYYY-MM-DD ou null
  expiry_date: string | null; // ISO YYYY-MM-DD ou null
  issue_place: string | null;
};

export type OcrResult = { fields: OcrFields; raw: unknown };

export interface OcrProvider {
  read(bytes: Buffer, mimeType: string, docType: string): Promise<OcrResult>;
}

export const EMPTY_FIELDS: OcrFields = {
  doc_number: null,
  country: null,
  holder_name: null,
  issue_date: null,
  expiry_date: null,
  issue_place: null,
};
