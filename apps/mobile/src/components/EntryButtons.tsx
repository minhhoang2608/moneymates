import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";

import { CameraIcon, MicIcon, PlusIcon } from "@/components/icons";
import { PressableScale } from "@/components/PressableScale";
import { useEntryOptions } from "@/components/useEntryOptions";
import { vi } from "@/i18n/vi";
import { colors, fontFamily, fontSize, radii } from "@/theme";

/** Row of the three ways to add a transaction (Nhập tay / Voice / Chụp bill), same entry points as the "+" menu. */
export function EntryButtons() {
  const router = useRouter();
  const { refreshFeatures, billAvailable, billHint, voiceHint, wrapBill } = useEntryOptions();
  useFocusEffect(
    useCallback(() => {
      refreshFeatures();
    }, [refreshFeatures]),
  );
  const items = [
    {
      id: "overview-entry-manual",
      label: vi.entryMenu.manual,
      Icon: PlusIcon,
      dim: false,
      onPress: () => router.push("/transaction/new"),
    },
    {
      id: "overview-entry-voice",
      label: vi.entryMenu.voice,
      Icon: MicIcon,
      dim: false,
      onPress: () => router.push("/voice"),
    },
    {
      id: "overview-entry-bill",
      label: vi.entryMenu.bill,
      Icon: CameraIcon,
      dim: !billAvailable,
      onPress: wrapBill(() => router.push("/bill")),
    },
  ];
  return (
    <View style={styles.wrap} testID="overview-entry">
      <View style={styles.row}>
        {items.map(({ id, label, Icon, dim, onPress }) => (
          <PressableScale key={id} testID={id} accessibilityRole="button" onPress={onPress} style={styles.button}>
            <Icon color={dim ? colors.neutral : colors.text} size={16} />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              style={[styles.label, dim ? { color: colors.neutral } : null]}
            >
              {label}
            </Text>
          </PressableScale>
        ))}
      </View>
      {voiceHint ? (
        <Text testID="overview-entry-voice-hint" style={styles.hint}>
          {vi.entryMenu.voice}: {voiceHint}
        </Text>
      ) : null}
      {billHint ? (
        <Text testID="overview-entry-bill-hint" style={styles.hint}>
          {billHint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: "row", gap: 8 },
  button: {
    flex: 1,
    minWidth: 0,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 6,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  label: { flexShrink: 1, fontFamily: fontFamily.semibold, fontSize: 13, color: colors.text },
  hint: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
});
