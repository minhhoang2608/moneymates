import { defaultEnabled, normalizeAppId, type PayApp } from "./apps";

/** The saved list once the user has chosen, else the default for the detected installed apps (#305). */
export function resolveEnabled(input: { hasChosen: boolean; saved: string[]; installed: string[] }): string[] {
  return input.hasChosen ? input.saved : defaultEnabled(input.installed);
}

/** Enabled apps in saved order, plus the remaining banks and wallets (catalogue order). Unknown saved ids are dropped. */
export function partitionApps(
  apps: PayApp[],
  enabledIds: string[],
): { enabled: PayApp[]; banks: PayApp[]; wallets: PayApp[] } {
  const enabled = enabledIds
    .map((id) => apps.find((a) => a.id === normalizeAppId(id)))
    .filter((a, i, arr): a is PayApp => !!a && arr.indexOf(a) === i);
  const rest = apps.filter((a) => !enabled.includes(a));
  return {
    enabled,
    banks: rest.filter((a) => a.type === "bank"),
    wallets: rest.filter((a) => a.type === "wallet"),
  };
}
