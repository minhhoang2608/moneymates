import { isE2E } from "@/e2e/isE2E";

import { createNativeTextRecognizer } from "./nativeTextRecognizer";

import type { TextRecognizer } from "./textRecognizer";

function defaultRecognizer(): TextRecognizer {
  if (isE2E()) {
    // Loaded lazily so production code paths never pull the E2E fake in.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@/e2e/receiptText").getE2eTextRecognizer() as TextRecognizer;
  }
  return createNativeTextRecognizer();
}

/**
 * Recognise the text of a receipt image fully on the device (no network).
 * Never throws: any failure or unreadable image gives `[]`.
 */
export async function recognizeText(uri: string, deps: { recognizer?: TextRecognizer } = {}): Promise<string[]> {
  if (typeof uri !== "string" || !uri.trim()) return [];
  try {
    const raw: unknown = await (deps.recognizer ?? defaultRecognizer()).recognize(uri);
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((s): s is string => typeof s === "string")
      .flatMap((s) => s.normalize("NFC").split(/\r?\n/))
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  } catch {
    return [];
  }
}
