import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView } from "expo-camera";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/PressableScale";

import { pickAndDecodeQr } from "@/components/scanner/decodeImage";
import { ScanFrame } from "@/components/scanner/ScanFrame";
import { e2eQr } from "@/e2e/fixtures";
import { isE2E } from "@/e2e/isE2E";
import { vi } from "@/i18n/vi";
import { getPermissionInfo, openAppSettings, requestPermissionInfo, type PermissionInfo } from "@/lib/permissions";
import { scanResultToRoute } from "@/lib/vietqr/scanRoute";
import { colors, fontFamily, fontSize, layout } from "@/theme";

const ERROR_MS = 3000;

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const e2e = isE2E();
  const [permission, setPermission] = useState<PermissionInfo | null>(null);
  const [torch, setTorch] = useState(false);
  const [error, setError] = useState(false);
  const [detected, setDetected] = useState(false);
  const handling = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    let alive = true;
    void getPermissionInfo("camera").then((i) => alive && setPermission(i));
    return () => {
      alive = false;
    };
  }, []);

  async function onGrant() {
    setPermission(await requestPermissionInfo("camera"));
  }

  function showError() {
    setError(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setError(false);
      handling.current = false;
    }, ERROR_MS);
  }

  function handle(text: string) {
    if (handling.current) return;
    handling.current = true;
    const route = scanResultToRoute(text);
    if (route.ok) {
      setDetected(true);
      router.replace(route.href);
    } else showError();
  }

  async function onGallery() {
    if (handling.current) return;
    handling.current = true;
    const res = await pickAndDecodeQr();
    handling.current = false;
    if (res.cancelled) return;
    if (res.text === null) {
      handling.current = true;
      showError();
      return;
    }
    handle(res.text);
  }

  const showCamera = !e2e && permission?.state === "granted";
  const denied = !e2e && permission !== null && permission.state !== "granted";

  return (
    <View style={[styles.root, { paddingTop: 20 + insets.top }]} testID="screen-scan">
      {showCamera ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={({ data }) => handle(data)}
        />
      ) : null}

      <View style={styles.header}>
        <PressableScale
          testID="scan-close-button"
          accessibilityRole="button"
          accessibilityLabel={vi.scan.close}
          style={styles.round}
          onPress={() => router.back()}
        >
          <Text style={styles.roundText}>✕</Text>
        </PressableScale>
        <Text style={styles.title}>{vi.scan.heading}</Text>
        <PressableScale
          testID="scan-flash-button"
          accessibilityRole="button"
          accessibilityLabel={torch ? vi.scan.flashOff : vi.scan.flashOn}
          accessibilityState={{ selected: torch }}
          style={[styles.round, torch && styles.roundOn]}
          onPress={() => setTorch((t) => !t)}
        >
          <Text style={styles.roundText}>⚡</Text>
        </PressableScale>
      </View>

      <View style={styles.frameWrap}>
        <ScanFrame detected={detected} />
        {/* bare-pressable-ok: invisible E2E-only feed target */}
        {e2e ? <Pressable testID="scan-e2e-feed" style={styles.feed} onPress={() => handle(e2eQr.dynamic)} /> : null}
      </View>

      {denied ? (
        <View style={styles.denied}>
          <Text style={styles.hint}>{vi.scan.permissionDenied}</Text>
          {permission?.canAskAgain ? (
            <PressableScale testID="scan-grant" accessibilityRole="button" onPress={onGrant}>
              <Text style={styles.link}>{vi.scan.grant}</Text>
            </PressableScale>
          ) : null}
          <PressableScale testID="scan-open-settings" accessibilityRole="button" onPress={() => void openAppSettings()}>
            <Text style={styles.link}>{vi.scan.openSettings}</Text>
          </PressableScale>
        </View>
      ) : (
        <Text style={styles.hint}>{vi.scan.hint}</Text>
      )}

      {error ? (
        <Text testID="scan-error" style={styles.error} accessibilityRole="alert">
          {vi.scan.error}
        </Text>
      ) : null}

      <View style={styles.bottom}>
        <PressableScale
          testID="scan-gallery-button"
          accessibilityRole="button"
          style={styles.gallery}
          onPress={onGallery}
        >
          <Text style={styles.galleryText}>{vi.scan.gallery}</Text>
        </PressableScale>
        <PressableScale testID="scan-manual-link" accessibilityRole="link" onPress={() => router.back()}>
          <Text style={styles.link}>{vi.scan.manual}</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.scannerBg, paddingTop: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: layout.screenPadding,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  roundOn: { backgroundColor: colors.accent },
  roundText: { color: colors.onPrimary, fontSize: fontSize.title },
  title: { fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: colors.onPrimary },
  frameWrap: { alignItems: "center", marginTop: 120 },
  feed: { position: "absolute", width: 60, height: 60, top: 110 },
  hint: {
    marginTop: 24,
    paddingHorizontal: 40,
    textAlign: "center",
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: "#D5D9DF",
  },
  denied: { alignItems: "center", gap: 12 },
  error: {
    alignSelf: "center",
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: colors.expense,
    color: colors.onPrimary,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.secondary,
  },
  bottom: { position: "absolute", left: 20, right: 20, bottom: 40, gap: 12, alignItems: "center" },
  gallery: {
    alignSelf: "stretch",
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  galleryText: { color: colors.onPrimary, fontFamily: fontFamily.semibold, fontSize: fontSize.row },
  link: {
    color: colors.onPrimary,
    textDecorationLine: "underline",
    fontFamily: fontFamily.medium,
    fontSize: fontSize.body,
    padding: 10,
  },
});
