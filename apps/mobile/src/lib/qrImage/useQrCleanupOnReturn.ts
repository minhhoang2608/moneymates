import { useEffect } from "react";
import { AppState } from "react-native";

import { useRepositories } from "@/db/RepositoriesProvider";
import { useHandOffDiag } from "@/stores/handOffDiag";
import { useToast } from "@/stores/toast";

import { createQrImageDeleter } from "./delete";
import { getQrMediaLibrary } from "./mediaLibrary";

/** On background → active, deletes the temporary QR images (silently). */
export function useQrCleanupOnReturn() {
  const { handOffs } = useRepositories();
  useEffect(() => {
    let sawBackground = false;
    const deleter = createQrImageDeleter({ media: getQrMediaLibrary(), handOffs });
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") sawBackground = true;
      else if (state === "active" && sawBackground) {
        sawBackground = false;
        const diag = useHandOffDiag.getState().take();
        if (diag) useToast.getState().show(`Chẩn đoán gửi ảnh: ${diag}`);
        deleter.deletePendingOnReturn().catch((e) => console.warn("could not delete QR images", e));
      }
    });
    return () => sub.remove();
  }, [handOffs]);
}
