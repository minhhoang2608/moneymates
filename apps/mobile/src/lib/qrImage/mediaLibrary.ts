import * as ML from "expo-media-library/legacy";
import { Platform } from "react-native";

import { createE2eMediaLibrary } from "@/e2e/mediaLibrary";
import { isE2E } from "@/e2e/isE2E";

import type { PhotoPermission } from "./decide";
import type { QrMediaLibrary } from "./delete";

export function mapPermission(
  platform: PhotoPermission["platform"],
  perm: { granted: boolean; accessPrivileges?: string },
): PhotoPermission {
  if (!perm.granted) return { platform, access: "add-only" };
  return { platform, access: perm.accessPrivileges === "limited" ? "limited" : "read-write" };
}

export function createLiveMediaLibrary(): QrMediaLibrary {
  const platform = Platform.OS === "android" ? "android" : "ios";
  return {
    deleteAssets: async (ids) => {
      return ML.deleteAssetsAsync(ids);
    },
    getPermission: async () => {
      return mapPermission(platform, await ML.getPermissionsAsync(false));
    },
  };
}

let cached: QrMediaLibrary | undefined;
export function getQrMediaLibrary(): QrMediaLibrary {
  cached ??= isE2E() ? createE2eMediaLibrary() : createLiveMediaLibrary();
  return cached;
}
