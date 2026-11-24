/**
 * expo-router would try to open the share-intent url (`<scheme>://dataUrl=…`) as a route.
 * Keep the current screen instead: images are delivered through subscribeIncomingImage.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (path.includes("dataUrl=")) return "/";
  return path;
}
