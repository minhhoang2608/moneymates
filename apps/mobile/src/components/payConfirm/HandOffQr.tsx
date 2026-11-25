import { useMemo } from "react";
import QRCode from "react-native-qrcode-svg";
import { StyleSheet, View } from "react-native";

import { QrImageTemplate } from "@/components/share/QrImageTemplate";
import type { PayConfirmModel } from "@/lib/payConfirm/params";
import { buildConfirmedQrPayload } from "@/lib/payConfirm/qrPayload";

export type QrRef = { toDataURL: (cb: (data: string) => void) => void };

type Props = {
  model: PayConfirmModel;
  amount?: number;
  note: string;
  getRef: (r: QrRef | null) => void;
};

/** Off-screen QR image that bank apps decode from the gallery: large, white background, 4-module quiet zone. */
export function HandOffQr({ model, amount, note, getRef }: Props) {
  const qrPayload = useMemo(() => buildConfirmedQrPayload(model, amount, note), [model, amount, note]);
  return (
    <View style={styles.hidden} pointerEvents="none" accessibilityElementsHidden>
      {model.kind === "vietqr" ? (
        <QrImageTemplate
          name={model.name}
          bankBin={model.bankBin}
          bankName={model.bankName}
          account={model.account}
          amount={amount}
          message={note}
          fallbackPayload={model.payload}
          getRef={getRef}
        />
      ) : (
        <QRCode
          value={qrPayload || " "}
          size={640}
          quietZone={64}
          ecl="M"
          color="black"
          backgroundColor="white"
          getRef={getRef}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { position: "absolute", left: -1000, top: -1000, opacity: 0 },
});
