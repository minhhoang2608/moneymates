import type { BillImageSource } from "@/lib/bill/imageSource";

import fixture from "../../e2e/fixtures/bill.json";

import { registerE2eApiFixture } from "./apiAdapter";

export const e2eBill = fixture;

/** E2E mode: no camera. Capturing returns a fixed fake uri and the API answers from the fixture. */
export function createE2eBillImageSource(): BillImageSource {
  registerE2eApiFixture("POST", "/ai/parse-bill", fixture.response);
  return { capture: async () => fixture.image, pick: async () => fixture.image };
}
