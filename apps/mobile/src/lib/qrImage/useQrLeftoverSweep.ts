import { useEffect } from "react";

import { useRepositories } from "@/db/RepositoriesProvider";

import { getQrMediaLibrary } from "./mediaLibrary";
import { runLeftoverSweepOnce } from "./sweepLeftovers";

/** Sweeps leftover temporary QR images once on app start, without blocking render. */
export function useQrLeftoverSweep() {
  const { handOffs, preferences } = useRepositories();
  useEffect(() => {
    runLeftoverSweepOnce({ media: getQrMediaLibrary(), handOffs, preferences }).catch((e) =>
      console.warn("could not sweep leftover QR images", e),
    );
  }, [handOffs, preferences]);
}
