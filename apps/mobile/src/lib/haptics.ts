import * as Haptics from "expo-haptics";

let enabled = true;

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

function run(fn: () => Promise<unknown>): void {
  if (!enabled) return;
  try {
    fn().catch(() => {});
  } catch {
    // Missing native module or unsupported platform: no-op.
  }
}

export const haptics = {
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  selection: () => run(() => Haptics.selectionAsync()),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
