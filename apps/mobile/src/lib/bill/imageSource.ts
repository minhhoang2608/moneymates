import { isE2E } from "@/e2e/isE2E";
import { createE2eBillImageSource } from "@/e2e/bill";

import { BILL_JPEG_QUALITY } from "./constants";
import { resizeTarget } from "./resizeTarget";

export interface BillImageSource {
  /** Compressed JPEG uri, or null on cancel / denied permission. */
  capture(): Promise<string | null>;
  pick(): Promise<string | null>;
}

type Picked = { uri: string; width: number; height: number };

/** Shrinks to the max long side and recompresses as JPEG. */
export async function compressBill(asset: Picked): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const M = require("expo-image-manipulator");
  const target = resizeTarget(asset.width, asset.height);
  const res = await M.manipulateAsync(asset.uri, target ? [{ resize: target }] : [], {
    compress: BILL_JPEG_QUALITY,
    format: M.SaveFormat.JPEG,
  });
  return res.uri as string;
}

export function createNativeBillImageSource(): BillImageSource {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const P = require("expo-image-picker");
  const run = async (launch: () => Promise<{ canceled: boolean; assets?: Picked[] | null }>) => {
    const r = await launch();
    const a = r.canceled ? null : r.assets?.[0];
    return a ? compressBill(a) : null;
  };
  return {
    async capture() {
      if (!(await P.requestCameraPermissionsAsync()).granted) return null;
      return run(() => P.launchCameraAsync({ mediaTypes: ["images"], quality: 1 }));
    },
    async pick() {
      if (!(await P.requestMediaLibraryPermissionsAsync()).granted) return null;
      return run(() => P.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 }));
    },
  };
}

let override: BillImageSource | null = null;
let cached: BillImageSource | null = null;

export function setBillImageSource(s: BillImageSource | null): void {
  override = s;
}

export function getBillImageSource(): BillImageSource {
  if (override) return override;
  cached ??= isE2E() ? createE2eBillImageSource() : createNativeBillImageSource();
  return cached;
}
