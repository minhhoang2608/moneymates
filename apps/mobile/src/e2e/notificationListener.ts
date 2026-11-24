import type { IncomingNotification } from "../../modules/notification-listener/src/native";

type Sub = { handler: (e: IncomingNotification) => void; packages: string[] };

const subs = new Set<Sub>();
let granted = false;

export const e2eIsAccessGranted = async (): Promise<boolean> => granted;
export const e2eOpenAccessSettings = async (): Promise<void> => {};

export function setE2eAccessGranted(value: boolean): void {
  granted = value;
}

export function e2eSubscribe(handler: (e: IncomingNotification) => void, allowedPackages: string[]): () => void {
  const sub: Sub = { handler, packages: [...allowedPackages] };
  subs.add(sub);
  return () => {
    subs.delete(sub);
  };
}

export function emitE2eNotification(event: IncomingNotification): void {
  for (const s of [...subs]) if (s.packages.includes(event.packageName)) s.handler(event);
}
