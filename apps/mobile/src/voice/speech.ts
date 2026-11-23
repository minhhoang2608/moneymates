import { isE2E } from "@/e2e/isE2E";
import { createE2eRecognizer } from "@/e2e/voice";

export type SpeechHandlers = {
  /** Latest transcript (interim or final); replaces the previous one. */
  onText: (text: string) => void;
  onEnd: () => void;
  onError: (message: string) => void;
};

export type SpeechRecognizer = {
  requestPermission(): Promise<boolean>;
  start(lang: string, handlers: SpeechHandlers): void;
  stop(): void;
};

export const VOICE_LANG = "vi-VN";

/** Live adapter on the native module (needs the dev build). Loaded lazily so Jest and E2E never touch it. */
export function createLiveRecognizer(): SpeechRecognizer {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ExpoSpeechRecognitionModule } = require("expo-speech-recognition");
  let subs: { remove: () => void }[] = [];
  const clear = () => {
    subs.forEach((s) => s.remove());
    subs = [];
  };
  return {
    async requestPermission() {
      const res = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      return !!res?.granted;
    },
    start(lang, h) {
      clear();
      subs = [
        ExpoSpeechRecognitionModule.addListener("result", (e: { results?: { transcript?: string }[] }) =>
          h.onText(e.results?.[0]?.transcript ?? ""),
        ),
        ExpoSpeechRecognitionModule.addListener("end", () => {
          clear();
          h.onEnd();
        }),
        ExpoSpeechRecognitionModule.addListener("error", (e: { message?: string }) => h.onError(e.message ?? "error")),
      ];
      ExpoSpeechRecognitionModule.start({ lang, interimResults: true });
    },
    stop() {
      ExpoSpeechRecognitionModule.stop();
    },
  };
}

let override: SpeechRecognizer | null = null;
let cached: SpeechRecognizer | null = null;

/** Replace the active recognizer (null restores the default). Tests use this. */
export function setSpeechRecognizer(r: SpeechRecognizer | null): void {
  override = r;
}

export function getSpeechRecognizer(): SpeechRecognizer {
  if (override) return override;
  cached ??= isE2E() ? createE2eRecognizer() : createLiveRecognizer();
  return cached;
}
