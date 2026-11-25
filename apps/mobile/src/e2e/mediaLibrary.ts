import type { QrMediaLibrary } from "@/lib/qrImage/delete";

/** E2E mode: deleting always succeeds and permission is full. */
export function createE2eMediaLibrary(): QrMediaLibrary {
  return {
    deleteAssets: async () => true,
    getPermission: async () => ({ platform: "android", access: "read-write" }),
  };
}
