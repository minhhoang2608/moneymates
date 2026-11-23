import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { AppState, StyleSheet, View } from "react-native";

import { useRepositories } from "@/db/RepositoriesProvider";
import { getAppLockAuth } from "@/lib/appLock/auth";
import { useAppLock } from "@/stores/appLock";
import { LockScreen } from "./LockScreen";

/**
 * Keeps the children mounted at all times (navigation state survives) and covers them with an opaque lock
 * screen while locked. Fails closed: the overlay shows until the preference has loaded.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const { preferences } = useRepositories();
  const status = useAppLock((s) => s.status);
  const wasBackground = useRef(false);

  const attempt = useCallback(() => useAppLock.getState().unlockAttempt(() => getAppLockAuth().authenticate()), []);

  useEffect(() => {
    let cancelled = false;
    preferences
      .getAppLockEnabled()
      .catch(() => true)
      .then((enabled) => {
        if (cancelled) return;
        useAppLock.getState().init(enabled);
        if (enabled) void attempt();
      });
    return () => {
      cancelled = true;
    };
  }, [preferences, attempt]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const s = useAppLock.getState();
      if (s.prompting) return;
      if (next === "background") {
        wasBackground.current = true;
      } else if (next === "active" && wasBackground.current) {
        wasBackground.current = false;
        if (s.enabled) {
          s.lock();
          void attempt();
        }
      }
    });
    return () => sub.remove();
  }, [attempt]);

  const unlocked = status === "unlocked";
  return (
    <View style={styles.fill}>
      <View
        style={[styles.fill, !unlocked && styles.hidden]}
        accessibilityElementsHidden={!unlocked}
        importantForAccessibility={unlocked ? "auto" : "no-hide-descendants"}
      >
        {children}
      </View>
      {!unlocked ? <LockScreen onRetry={attempt} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { opacity: 0 },
});
