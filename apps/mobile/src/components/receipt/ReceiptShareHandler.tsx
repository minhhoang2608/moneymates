import { useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { StyleSheet } from "react-native";

import { PressableScale } from "@/components/PressableScale";
import { ReceiptSheet } from "@/components/receipt/ReceiptSheet";
import { useRepositories } from "@/db/RepositoriesProvider";
import { emitE2eSharedImage } from "@/e2e/incomingShare";
import { isE2E } from "@/e2e/isE2E";
import { vi } from "@/i18n/vi";
import { subscribeIncomingImage } from "@/lib/receipt/incomingShare";
import { handleSharedReceipt, type SharedReceiptDeps } from "@/lib/receipt/handleSharedReceipt";
import { undoReceipt, type ReceiptDraft } from "@/lib/receipt/apply";
import { recognizeText } from "@/lib/receipt/recognizeText";
import { createQrImageDeleter } from "@/lib/qrImage/delete";
import { getQrMediaLibrary } from "@/lib/qrImage/mediaLibrary";
import { useReceiptSheet } from "@/stores/receiptSheet";
import { useToast } from "@/stores/toast";

/**
 * Root-level: listens for images shared from other apps and shows the match toast or the
 * "Biên lai chuyển khoản" sheet over the current screen. It never navigates on its own.
 */
export function ReceiptShareHandler({ deps }: { deps?: Partial<SharedReceiptDeps> } = {}) {
  const router = useRouter();
  const { transactions, handOffs, categories } = useRepositories();
  const injected = deps;

  const resolved = useMemo<SharedReceiptDeps>(() => {
    const deleter = createQrImageDeleter({ media: getQrMediaLibrary(), handOffs });
    const receipt = { handOffs, transactions, categories } as SharedReceiptDeps["receipt"];
    return {
      receipt: injected?.receipt ?? receipt,
      recognize: injected?.recognize ?? ((uri) => recognizeText(uri)),
      deleteQrImages: injected?.deleteQrImages ?? ((ids) => deleter.deleteQrImages(ids)),
    };
  }, [handOffs, transactions, categories, injected]);

  useEffect(() => {
    return subscribeIncomingImage((uri) => {
      handleSharedReceipt(resolved, uri)
        .then((out) => {
          if (out.kind === "matched") {
            useToast.getState().show(vi.receipt.attached(out.recipient), {
              label: vi.receipt.undo,
              onPress: () => void undoReceipt(resolved.receipt, out.undo).catch((e) => console.warn(e)),
            });
          } else {
            useReceiptSheet.getState().open({ draft: out.draft, parsed: out.parsed });
          }
        })
        .catch((e) => console.warn("could not handle shared receipt", e));
    });
  }, [resolved]);

  const edit = (d: ReceiptDraft) =>
    router.push({
      pathname: "/transaction/new",
      params: {
        source: "receipt",
        amount: d.amount === null ? "" : String(d.amount),
        note: d.note,
        categoryId: d.categoryId ?? "",
        date: d.occurredAt,
        attachmentUri: d.uri,
      },
    });

  return (
    <>
      <ReceiptSheet onEdit={edit} />
      {isE2E() ? (
        <PressableScale
          testID="e2e-share-receipt"
          accessibilityLabel="e2e-share-receipt"
          style={E2E_SHARE_TRIGGER_STYLE}
          onPress={() => emitE2eSharedImage()}
        />
      ) : null}
    </>
  );
}

/**
 * E2E-only trigger: 1x1 dp on the vertical middle of the right edge, clear of headers, status bar,
 * tab bar and FABs, so it can never take taps from app UI.
 */
export const E2E_SHARE_TRIGGER_STYLE = StyleSheet.create({
  hidden: { position: "absolute", right: 0, top: "50%", width: 1, height: 1, opacity: 0.02 },
}).hidden;
