import { getCurrentPath } from "@/lib/receipt/currentPath";

/**
 * expo-router would try to open the share-intent url (`<scheme>://dataUrl=…`) as a route.
 * Stay on the current screen instead (images are delivered through subscribeIncomingImage).
 * On cold start no route is known yet, so fall back to "/".
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (path.includes("dataUrl=")) return getCurrentPath() ?? "/";
  return path;
}
