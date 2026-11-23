import { e2eHandOffDeps } from "@/e2e/bankOpener";
import { isE2E } from "@/e2e/isE2E";

import { createHandOff, type HandOffDeps } from "./handOff";
import { createNativeDeps } from "./nativeDeps";

export function selectDeps(getQrBase64: () => Promise<string | null>): HandOffDeps {
  return isE2E() ? e2eHandOffDeps : createNativeDeps(getQrBase64);
}

export function makeHandOff(getQrBase64: () => Promise<string | null>) {
  return createHandOff(selectDeps(getQrBase64));
}
