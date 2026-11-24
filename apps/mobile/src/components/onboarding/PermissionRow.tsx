import { StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/components/PressableScale";
import { CheckIcon } from "@/components/icons";
import { vi } from "@/i18n/vi";
import type { PermissionState } from "@/lib/permissions";
import { colors, fontFamily, fontSize } from "@/theme";

type Props = {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  /** Undefined while the status is still loading. */
  state: PermissionState | undefined;
  last?: boolean;
  onAsk: () => void;
  onOpenSettings: () => void;
};

export function PermissionRow({ id, icon, label, description, state, last, onAsk, onOpenSettings }: Props) {
  const t = vi.onboarding.permissions;
  return (
    <View style={[styles.row, !last && styles.divider]} testID={`perm-row-${id}`}>
      <View style={styles.icon}>{icon}</View>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.desc}>{description}</Text>
      </View>
      {state === "granted" ? (
        <View style={styles.granted} testID={`perm-granted-${id}`}>
          <CheckIcon color={colors.primary} size={16} />
          <Text style={styles.grantedText}>{t.granted}</Text>
        </View>
      ) : state === "denied" ? (
        <PressableScale
          testID={`perm-settings-${id}`}
          accessibilityRole="button"
          accessibilityLabel={`${t.openSettings}: ${label}`}
          style={styles.button}
          onPress={onOpenSettings}
        >
          <Text style={styles.buttonText}>{t.openSettings}</Text>
        </PressableScale>
      ) : (
        <PressableScale
          testID={`perm-ask-${id}`}
          accessibilityRole="button"
          accessibilityLabel={`${t.next}: ${label}`}
          style={styles.button}
          onPress={onAsk}
        >
          <Text style={styles.buttonText}>{t.next}</Text>
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: 3 },
  label: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.text },
  desc: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  granted: { flexDirection: "row", alignItems: "center", gap: 4 },
  grantedText: { fontFamily: fontFamily.semibold, fontSize: 13, color: colors.primary },
  button: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontFamily: fontFamily.semibold, fontSize: 13, color: colors.primary },
});
