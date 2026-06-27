import type { OcrProvider, OcrResult } from "./types";

export class MockOcrProvider implements OcrProvider {
  async read(_bytes: Buffer, _mimeType: string, docType: string): Promise<OcrResult> {
    return {
      fields: {
        doc_number: "12AB34567",
        country: "France",
        holder_name: "Camille Penhoat",
        issue_date: "2021-03-12",
        expiry_date: "2031-03-11",
        issue_place: "Paris",
      },
      raw: { mock: true, docType },
    };
  }
}
