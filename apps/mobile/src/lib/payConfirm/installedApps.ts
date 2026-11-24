import type { PayApp } from "./apps";

/** Ids of the apps whose URL scheme can be opened. A probe that throws counts as "not installed". Pure: the probe is injected. */
export async function detectInstalledApps(
  apps: PayApp[],
  canOpen: (url: string) => Promise<boolean>,
): Promise<string[]> {
  const found = await Promise.all(
    apps.map(async (a) => {
      if (!a.scheme) return null;
      try {
        return (await canOpen(`${a.scheme}://`)) ? a.id : null;
      } catch {
        return null;
      }
    }),
  );
  return found.filter((id): id is string => id !== null);
}
