import fixture from "../../e2e/fixtures/share.json";

import type { ShareSource, SharedPayload } from "@/lib/receipt/incomingShare";

const listeners = new Set<(p: SharedPayload) => void>();
let source: ShareSource | null = null;

/** E2E mode: no native share intent. Tests push a shared image through `emitE2eSharedImage`. */
export function getE2eShareSource(): ShareSource {
  return (source ??= {
    getInitial: async () => null,
    onShare(cb) {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    reset: () => undefined,
  });
}

export function emitE2eSharedImage(uri: string = fixture.imageUri): void {
  const payload = { files: [{ path: uri, mimeType: "image/jpeg" }] };
  listeners.forEach((cb) => cb(payload));
}
