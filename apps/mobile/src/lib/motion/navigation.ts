import { FadeOut, SlideInDown } from "react-native-reanimated";
import { durations } from "./durations";

/** Screen options shared by the root stack; no transition with the system "reduce motion" setting. */
export function stackScreenOptions(reduceMotion: boolean) {
  return { headerShown: false, animation: reduceMotion ? ("none" as const) : ("slide_from_right" as const) };
}

const toastEntering = SlideInDown.duration(durations.base);
const toastExiting = FadeOut.duration(durations.base);

/** Entering / exiting animation props for toasts and snackbars; empty with reduce motion. */
export function toastMotionProps(reduceMotion: boolean): {
  entering?: typeof toastEntering;
  exiting?: typeof toastExiting;
} {
  return reduceMotion ? {} : { entering: toastEntering, exiting: toastExiting };
}
