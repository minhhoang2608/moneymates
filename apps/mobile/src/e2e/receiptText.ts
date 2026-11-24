import shareFixture from "../../e2e/fixtures/share.json";
import fixture from "../../e2e/fixtures/receipt-text.json";

import type { TextRecognizer } from "@/lib/receipt/textRecognizer";

/** E2E mode: no native OCR. The fixture image yields fixed receipt lines, anything else is blank. */
export function getE2eTextRecognizer(): TextRecognizer {
  return {
    recognize: async (uri) => (uri === shareFixture.imageUri ? [...fixture.lines] : []),
  };
}
