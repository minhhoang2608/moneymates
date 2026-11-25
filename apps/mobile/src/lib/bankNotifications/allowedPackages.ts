import { PAY_APPS, type PayApp } from "../payConfirm/apps";

/** Android packages of the enabled pay apps, de-duplicated. Apps without a known package are skipped. */
export function allowedPackagesFor(enabledIds: string[], apps: PayApp[] = PAY_APPS): string[] {
  const out = new Set<string>();
  for (const id of enabledIds) {
    const pkg = apps.find((a) => a.id === id)?.androidPackage;
    if (pkg) out.add(pkg);
  }
  return [...out];
}
