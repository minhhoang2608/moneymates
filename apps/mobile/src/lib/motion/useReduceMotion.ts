import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

import { isE2E } from "@/e2e/isE2E";

/**
 * True when the system "reduce motion" setting is on. Defaults to false until known.
 * The E2E build always returns true synchronously (no motion, deterministic first frame).
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(isE2E());
  useEffect(() => {
    if (isE2E()) return;
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      ?.then((v) => {
        if (active) setReduce(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      active = false;
      sub?.remove();
    };
  }, []);
  return reduce;
}
