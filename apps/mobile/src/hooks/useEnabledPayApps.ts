import { useCallback, useEffect, useState } from "react";

import { useRepositories } from "@/db/RepositoriesProvider";
import { resolveEnabled } from "@/lib/payConfirm/enabledApps";
import { getInstalledPayApps } from "@/lib/payConfirm/getInstalledPayApps";

/** Enabled pay-app ids in order. First use detects installed apps and persists the default so every screen agrees. */
export function useEnabledPayApps() {
  const { paymentAppPrefs } = useRepositories();
  const [enabled, setEnabled] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  const fetchEnabled = useCallback(async () => {
    const hasChosen = await paymentAppPrefs.hasChosen();
    let saved: string[] = [];
    let installed: string[] = [];
    if (hasChosen) saved = await paymentAppPrefs.getEnabledApps();
    else {
      installed = await getInstalledPayApps();
    }
    const ids = resolveEnabled({ hasChosen, saved, installed });
    if (!hasChosen) await paymentAppPrefs.setEnabledOrder(ids);
    return ids;
  }, [paymentAppPrefs]);

  const reload = useCallback(async () => {
    setEnabled(await fetchEnabled());
    setReady(true);
  }, [fetchEnabled]);

  useEffect(() => {
    let alive = true;
    fetchEnabled()
      .then((ids) => {
        if (!alive) return;
        setEnabled(ids);
        setReady(true);
      })
      .catch(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [fetchEnabled]);

  const toggle = useCallback(
    async (id: string, on: boolean) => {
      await paymentAppPrefs.setEnabled(id, on);
      setEnabled(await paymentAppPrefs.getEnabledApps());
    },
    [paymentAppPrefs],
  );
  const reorder = useCallback(
    async (keys: string[]) => {
      setEnabled(keys);
      await paymentAppPrefs.setEnabledOrder(keys);
    },
    [paymentAppPrefs],
  );

  return { enabled, ready, toggle, reorder, reload };
}
