import { useEffect } from "react";
import { AppState } from "react-native";

import { useRepositories } from "@/db/RepositoriesProvider";
import { useQrCleanupOnReturn } from "@/lib/qrImage/useQrCleanupOnReturn";
import { usePendingHandOff } from "@/stores/pendingHandOff";

/**
 * Shows nothing. When the user comes back from the bank app it stamps the hand-off's return time (paid rule)
 * and deletes the temporary QR photos. Deleting a payment is done from Lịch sử.
 */
export function HandOffReturnWatcher() {
  const { handOffs } = useRepositories();
  useQrCleanupOnReturn();

  useEffect(() => {
    let sawBackground = false;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") sawBackground = true;
      else if (state === "active" && sawBackground) {
        sawBackground = false;
        const handOffId = usePendingHandOff.getState().pending?.handOffId;
        if (handOffId) {
          handOffs.recordReturn(handOffId, new Date()).catch((e) => console.warn("could not record return", e));
        }
        usePendingHandOff.getState().clear();
      }
    });
    return () => sub.remove();
  }, [handOffs]);

  return null;
}
