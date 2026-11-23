import type { SpeechRecognizer } from "@/voice/speech";

import fixture from "../../e2e/fixtures/voice.json";

let injected: string | null = null;

/** Tests (or a Maestro helper) can replace the canned sentence; null restores the fixture. */
export function setE2eVoiceText(text: string | null): void {
  injected = text;
}

/** E2E mode: no microphone. Holding the mic "hears" the fixture sentence. */
export function createE2eRecognizer(): SpeechRecognizer {
  let handlers: Parameters<SpeechRecognizer["start"]>[1] | null = null;
  return {
    requestPermission: async () => true,
    start(_lang, h) {
      handlers = h;
      h.onText(injected ?? fixture.text);
    },
    stop() {
      handlers?.onEnd();
      handlers = null;
    },
  };
}
