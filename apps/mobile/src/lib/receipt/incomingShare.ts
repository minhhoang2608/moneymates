import { isE2E } from "@/e2e/isE2E";

import { createNativeShareSource } from "./nativeShareSource";

/** A shared payload as the native layer reports it (already normalised to file entries). */
export type SharedFile = { path: string | null; mimeType: string | null };
export type SharedPayload = { files?: SharedFile[] | null } | null | undefined;

export type ShareSource = {
  /** Share that cold-started the app, if any. */
  getInitial(): Promise<SharedPayload>;
  /** Shares received while the app is running. Returns an unsubscribe function. */
  onShare(cb: (payload: SharedPayload) => void): () => void;
  /** Tell the native side the share was consumed. */
  reset(): void;
};

/** First `image/*` file uri in a payload, or null (text, video, empty payloads are ignored). */
export function firstImageUri(payload: SharedPayload): string | null {
  const file = payload?.files?.find((f) => f.path && f.mimeType?.startsWith("image/"));
  return file?.path ?? null;
}

/** Cold-start read and warm-start event of the same share arrive within this window. */
export const DUPLICATE_WINDOW_MS = 2000;

let e2eSource: ShareSource | null = null;

function defaultSource(): ShareSource {
  if (isE2E()) {
    // Loaded lazily so production code paths never pull the E2E fake in.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (e2eSource ??= require("@/e2e/incomingShare").getE2eShareSource() as ShareSource);
  }
  return createNativeShareSource();
}

/**
 * Subscribe to images shared into the app from another app (bank, wallet, gallery).
 * Delivers the uri to `cb` only. It never navigates: this module must not import expo-router.
 */
export function subscribeIncomingImage(
  cb: (uri: string) => void,
  deps: { source?: ShareSource; now?: () => number } = {},
): () => void {
  const source = deps.source ?? defaultSource();
  const now = deps.now ?? Date.now;
  let active = true;
  let last: { uri: string; at: number } | null = null;

  const deliver = (payload: SharedPayload) => {
    if (!active) return;
    const uri = firstImageUri(payload);
    if (!uri) return;
    source.reset();
    // Dedupe only the cold/warm double delivery of one share. Re-sharing the same file later
    // (Android and iOS often reuse the same cache path) must deliver again.
    const at = now();
    if (last && last.uri === uri && at - last.at < DUPLICATE_WINDOW_MS) return;
    last = { uri, at };
    cb(uri);
  };

  const off = source.onShare(deliver);
  source
    .getInitial()
    .then(deliver)
    .catch(() => undefined);

  return () => {
    active = false;
    off();
  };
}
