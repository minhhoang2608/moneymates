import { extractTextFromImage, isSupported } from "expo-text-extractor";

import type { TextRecognizer } from "./textRecognizer";

/** Thin adapter over expo-text-extractor (ML Kit on Android, Vision on iOS). The only file that imports it. */
export function createNativeTextRecognizer(): TextRecognizer {
  return {
    async recognize(uri) {
      if (!isSupported) return [];
      return extractTextFromImage(uri);
    },
  };
}
