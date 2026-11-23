import { BILL_MAX_LONG_SIDE } from "./constants";

export type ResizeAction = { width: number } | { height: number } | null;

/** Keeps the aspect ratio and only shrinks: the long side becomes `maxLongSide`. Null means no resize needed. */
export function resizeTarget(width: number, height: number, maxLongSide = BILL_MAX_LONG_SIDE): ResizeAction {
  if (!(width > 0) || !(height > 0)) return null;
  if (Math.max(width, height) <= maxLongSide) return null;
  return width >= height ? { width: maxLongSide } : { height: maxLongSide };
}
