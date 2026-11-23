import { Text, View } from "react-native";

import { vi } from "@/i18n/vi";

export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text testID="home-placeholder">{vi.placeholder}</Text>
    </View>
  );
}
