import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

import { isAccessGranted, openAccessSettings } from "../../modules/notification-listener";
import { useRepositories } from "@/db/RepositoriesProvider";

/**
 * Opt-in flow for notification access. `start()` opens the Android settings page once; when the app
 * returns to the foreground the granted state is read back, persisted and passed to `onDone`.
 */
export function useNotifAccessOptIn(onDone: (granted: boolean) => void) {
  const { preferences } = useRepositories();
  const awaiting = useRef(false);
  const opening = useRef(false);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !awaiting.current) return;
      awaiting.current = false;
      void (async () => {
        const granted = await isAccessGranted().catch(() => false);
        await preferences.setAutoDetectTransfers(granted);
        doneRef.current(granted);
      })();
    });
    return () => sub.remove();
  }, [preferences]);

  const start = useCallback(async () => {
    if (opening.current || awaiting.current) return;
    opening.current = true;
    awaiting.current = true;
    try {
      await openAccessSettings();
    } catch {
      awaiting.current = false;
    } finally {
      opening.current = false;
    }
  }, []);

  const later = useCallback(async () => {
    awaiting.current = false;
    await preferences.setAutoDetectTransfers(false);
  }, [preferences]);

  return { start, later };
}
