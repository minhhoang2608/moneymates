import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** True when the system "reduce motion" setting is on. Defaults to false until known. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
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
