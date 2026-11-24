import type { ReactNode } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";

import { vi } from "@/i18n/vi";
import { badgeKind, type PayApp } from "@/lib/payConfirm/apps";
import { colors, fontFamily, fontSize, radii, tileColors } from "@/theme";

export const ROW_HEIGHT = 56;

const initials = (app: PayApp) => app.short.slice(0, 4).toUpperCase();
const tileFor = (app: PayApp) => {
  let h = 0;
  for (const c of app.id) h = (h * 31 + c.charCodeAt(0)) % tileColors.length;
  return tileColors[h];
};

type Props = {
  app: PayApp;
  on: boolean;
  last: boolean;
  onToggle: (on: boolean) => void;
  /** Drag handle (enabled section only). */
  handle?: ReactNode;
};

export function PaymentAppRow({ app, on, last, onToggle, handle }: Props) {
  const tile = tileFor(app);
  const auto = badgeKind(app) === "autofill";
  return (
    <View testID={`payment-app-row-${app.id}`} style={[styles.row, !last && styles.border]}>
      {handle}
      <View style={[styles.tile, { backgroundColor: tile.bg }]}>
        <Text style={[styles.tileText, { color: tile.fg }]}>{initials(app)}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.name}>{app.name}</Text>
        <Text style={[styles.badge, auto && styles.badgeAuto]}>
          {auto ? vi.paymentApps.autofill : vi.paymentApps.scanQr}
        </Text>
      </View>
      <Switch
        testID={`payment-app-switch-${app.id}`}
        accessibilityLabel={app.name}
        value={on}
        trackColor={{ true: colors.primary, false: colors.switchOff }}
        onValueChange={onToggle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface },
  border: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  tile: { width: 36, height: 36, borderRadius: radii.sm, alignItems: "center", justifyContent: "center" },
  tileText: { fontFamily: fontFamily.bold, fontSize: 11 },
  flex: { flex: 1, gap: 2 },
  name: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.text },
  badge: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
  badgeAuto: { fontFamily: fontFamily.semibold, color: colors.primaryDark },
});
