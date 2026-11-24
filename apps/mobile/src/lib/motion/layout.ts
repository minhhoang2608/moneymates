import { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { durations } from "./durations";

/** Entering / exiting / layout animations for list rows and loaded content. */
export const listEntering = FadeIn.duration(durations.base);
export const listExiting = FadeOut.duration(durations.fast);
export const listLayout = LinearTransition.duration(durations.base);
export const fadeIn = FadeIn.duration(durations.slow);

type MotionProps = { entering?: typeof listEntering; exiting?: typeof listExiting; layout?: typeof listLayout };

/** Layout animation props for a list row; empty when the system "reduce motion" setting is on. */
export function motionProps(reduceMotion: boolean): MotionProps {
  return reduceMotion ? {} : { entering: listEntering, exiting: listExiting, layout: listLayout };
}

/** Fade-in prop for content that appears once data is loaded; empty with reduce motion. */
export function fadeInProps(reduceMotion: boolean): { entering?: typeof fadeIn } {
  return reduceMotion ? {} : { entering: fadeIn };
}
