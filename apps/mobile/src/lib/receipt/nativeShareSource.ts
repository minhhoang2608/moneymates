import { ShareIntentModule, getShareExtensionKey, parseShareIntent } from "expo-share-intent";

import type { ShareSource, SharedPayload } from "./incomingShare";

function parse(value: unknown): SharedPayload {
  try {
    return parseShareIntent(value as string, {});
  } catch {
    return null;
  }
}

/** Thin adapter over expo-share-intent. The only file that imports the library. */
export function createNativeShareSource(): ShareSource {
  return {
    async getInitial() {
      if (!ShareIntentModule) return null;
      try {
        const raw = ShareIntentModule.getShareIntent("") as unknown;
        return raw ? parse(raw) : null;
      } catch {
        return null;
      }
    },
    onShare(cb) {
      if (!ShareIntentModule) return () => undefined;
      const sub = ShareIntentModule.addListener("onChange", (e) => cb(parse(e.value)));
      // Android delivers warm-start intents when asked to refresh.
      try {
        ShareIntentModule.getShareIntent("");
      } catch {
        /* ignore */
      }
      return () => sub.remove();
    },
    reset() {
      try {
        void ShareIntentModule?.clearShareIntent(getShareExtensionKey({}));
      } catch {
        /* ignore */
      }
    },
  };
}
