import { useRef, useState } from "react";
import { AnimatedSheet } from "@/components/AnimatedSheet";
import { Alert, StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/PressableScale";
import QRCode from "react-native-qrcode-svg";
import { QrImageTemplate } from "@/components/share/QrImageTemplate";

import { vi } from "@/i18n/vi";
import type { PaybackQr } from "@/lib/group/paybackQr";
import { formatVnd } from "@/lib/money";
import { saveQrToGallery, shareQr } from "@/lib/share/qrImage";
import { colors, fontFamily, fontSize } from "@/theme";

const t = vi.qrPopup;

export type QrMode = "member" | "group";

export function QrPopup({
  visible,
  memberName,
  memberQr,
  groupQr,
  initialMode,
  onClose,
  onAddAccount,
}: {
  visible: boolean;
  /** Set when opened from a member row; enables the "Theo người" tab. */
  memberName: string | null;
  memberQr: PaybackQr;
  groupQr: PaybackQr;
  initialMode: QrMode;
  onClose: () => void;
  onAddAccount: () => void;
}) {
  const [picked, setPicked] = useState<QrMode | null>(null);
  const mode: QrMode = memberName ? (picked ?? initialMode) : "group";
  const qr = mode === "member" ? memberQr : groupQr;
  const ref = useRef<{ toDataURL: (cb: (data: string) => void) => void } | null>(null);

  const close = () => {
    setPicked(null);
    onClose();
  };

  const getBase64 = () =>
    new Promise<string | null>((resolve) => {
      if (!ref.current) return resolve(null);
      ref.current.toDataURL((data) => resolve(data || null));
    });

  const run = async (action: (b64: string) => Promise<string>) => {
    try {
      const b64 = await getBase64();
      if (!b64) return Alert.alert(t.error);
      const result = await action(b64);
      if (result === "saved") Alert.alert(t.saved);
      else if (result === "denied") Alert.alert(t.denied);
      else if (result === "unavailable") Alert.alert(t.shareUnavailable);
    } catch {
      Alert.alert(t.error);
    }
  };

  const title = mode === "member" && memberName ? t.title(memberName) : t.titleGroup;

  return (
    <AnimatedSheet visible={visible} onClose={close} variant="popup" testID="qr-popup-modal" backdropLabel={t.close}>
      <>
        <View style={styles.card} testID="qr-popup" accessibilityLabel={t.a11y}>
          <View style={styles.head}>
            <Text style={styles.title}>{title}</Text>
            <PressableScale
              testID="qr-popup-close"
              accessibilityRole="button"
              accessibilityLabel={t.close}
              style={styles.closeBtn}
              onPress={close}
            >
              <Text style={styles.closeText}>✕</Text>
            </PressableScale>
          </View>

          {memberName ? (
            <View style={styles.segment} accessibilityRole="radiogroup">
              {(["member", "group"] as const).map((m) => (
                <PressableScale
                  key={m}
                  testID={m === "member" ? "qr-tab-member" : "qr-tab-group"}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: mode === m }}
                  style={[styles.segBtn, mode === m && styles.segActive]}
                  onPress={() => setPicked(m)}
                >
                  <Text style={[styles.segText, mode === m && styles.segTextActive]}>
                    {m === "member" ? t.byMember : t.byGroup}
                  </Text>
                </PressableScale>
              ))}
            </View>
          ) : null}

          {qr.kind === "no_account" ? (
            <>
              <Text style={styles.noAccount} testID="qr-no-account">
                {t.noAccount}
              </Text>
              <PressableScale
                testID="qr-add-account"
                accessibilityRole="button"
                style={[styles.btn, styles.primary, styles.full]}
                onPress={onAddAccount}
              >
                <Text style={styles.primaryText}>{t.addAccount}</Text>
              </PressableScale>
            </>
          ) : (
            <>
              <View testID="qr-popup-code" accessibilityLabel={qr.payload} style={styles.qrBox}>
                <QRCode value={qr.payload} size={200} quietZone={20} backgroundColor="white" />
              </View>
              <View style={styles.hiddenQr} pointerEvents="none" accessibilityElementsHidden>
                {/* Exported image: same 600x900 template as pay-confirm, without the temporary footer. */}
                <QrImageTemplate
                  temporary={false}
                  name={qr.holder}
                  bankBin={qr.bankBin}
                  bankName={qr.bankName}
                  account={qr.accountNo}
                  amount={qr.amount ?? undefined}
                  message={qr.message}
                  fallbackPayload={qr.payload}
                  getRef={(c) => {
                    ref.current = c;
                  }}
                />
              </View>
              <View style={styles.info}>
                {qr.amount !== null ? <Text style={styles.amount}>{formatVnd(qr.amount)}</Text> : null}
                <Text style={styles.holder}>{`${qr.holder} · ${qr.bankName}`}</Text>
                <Text style={styles.meta}>{t.account(qr.accountNo)}</Text>
                {qr.message ? <Text style={styles.meta}>{t.message(qr.message)}</Text> : null}
              </View>
              <View style={styles.buttons}>
                <PressableScale
                  testID="qr-download"
                  accessibilityRole="button"
                  style={[styles.btn, styles.outline]}
                  onPress={() => run(saveQrToGallery)}
                >
                  <Text style={styles.outlineText}>{t.download}</Text>
                </PressableScale>
                <PressableScale
                  testID="qr-share"
                  accessibilityRole="button"
                  style={[styles.btn, styles.primary]}
                  onPress={() => run(shareQr)}
                >
                  <Text style={styles.primaryText}>{t.share}</Text>
                </PressableScale>
              </View>
              <Text style={styles.hint}>{mode === "member" && memberName ? t.hint(memberName) : t.hintGroup}</Text>
            </>
          )}
        </View>
      </>
    </AnimatedSheet>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 24, padding: 20, alignItems: "center", gap: 16 },
  head: { width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: colors.text },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.segmentBg,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.text },
  segment: {
    width: "100%",
    flexDirection: "row",
    gap: 4,
    backgroundColor: colors.segmentBg,
    borderRadius: 12,
    padding: 4,
  },
  segBtn: { flex: 1, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  segActive: { backgroundColor: colors.surface },
  segText: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.textMuted },
  segTextActive: { fontFamily: fontFamily.semibold, color: colors.text },
  qrBox: { padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface },
  hiddenQr: { position: "absolute", left: -1000, top: -1000, opacity: 0 },
  info: { alignItems: "center", gap: 4 },
  amount: { fontFamily: fontFamily.bold, fontSize: 28, color: colors.text },
  holder: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.text },
  meta: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.textMuted },
  buttons: { width: "100%", flexDirection: "row", gap: 10 },
  btn: { flex: 1, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  full: { flex: 0, width: "100%" },
  outline: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  outlineText: { fontFamily: fontFamily.semibold, fontSize: fontSize.row, color: colors.text },
  primary: { backgroundColor: colors.primary },
  primaryText: { fontFamily: fontFamily.semibold, fontSize: fontSize.row, color: colors.surface },
  hint: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted, textAlign: "center" },
  noAccount: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textMuted, textAlign: "center" },
});
