import { useRouter } from "expo-router";
import type { BottomTabBarProps } from "expo-router/build/layouts/Tabs";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/PressableScale";

import { vi } from "@/i18n/vi";
import { colors, fontFamily, fontSize, layout } from "@/theme";

import { EntryMenu } from "./EntryMenu";
import { HomeIcon, ListIcon, QrIcon, UserIcon, UsersIcon } from "./icons";

type TabDef = {
  route: string;
  label: string;
  testID: string;
  Icon: (p: { color: string; size?: number }) => React.JSX.Element;
};

const LEFT: TabDef[] = [
  { route: "index", label: vi.tabs.overview, testID: "tab-overview", Icon: HomeIcon },
  { route: "history", label: vi.tabs.history, testID: "tab-history", Icon: ListIcon },
];
const RIGHT: TabDef[] = [
  { route: "groups", label: vi.tabs.groups, testID: "tab-groups", Icon: UsersIcon },
  { route: "profile", label: vi.tabs.profile, testID: "tab-profile", Icon: UserIcon },
];

export function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const activeRoute = state.routes[state.index]?.name;

  const renderTab = (t: TabDef) => {
    const active = activeRoute === t.route;
    const color = active ? colors.primary : colors.textMuted;
    return (
      <PressableScale
        key={t.route}
        testID={t.testID}
        accessibilityRole="button"
        accessibilityLabel={t.label}
        accessibilityState={{ selected: active }}
        onPress={() => {
          const target = state.routes.find((r) => r.name === t.route);
          if (target) navigateToTab(target.key);
        }}
        style={styles.tab}
      >
        <t.Icon color={color} />
        <Text style={[styles.label, { color, fontFamily: active ? fontFamily.semibold : fontFamily.medium }]}>
          {t.label}
        </Text>
      </PressableScale>
    );
  };

  return (
    <View style={styles.bar}>
      {LEFT.map(renderTab)}
      <PressableScale
        testID="tab-qr"
        accessibilityRole="button"
        accessibilityLabel={vi.scan.title}
        onPress={() => router.push("/scan")}
        onLongPress={() => setMenuOpen(true)}
        style={styles.qr}
      >
        <QrIcon color={colors.onPrimary} size={26} />
      </PressableScale>
      {RIGHT.map(renderTab)}
      <EntryMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onManual={() => {
          setMenuOpen(false);
          router.push("/transaction/new");
        }}
        onVoice={() => {
          setMenuOpen(false);
          router.push("/voice");
        }}
        onBill={() => {
          setMenuOpen(false);
          router.push("/bill");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: layout.tabBarHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingBottom: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tab: { width: 64, minHeight: 44, alignItems: "center", gap: 4 },
  label: { fontSize: fontSize.tab },
  qr: {
    width: layout.qrButtonSize,
    height: layout.qrButtonSize,
    marginTop: -26,
    borderRadius: layout.qrButtonSize / 2,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
});
