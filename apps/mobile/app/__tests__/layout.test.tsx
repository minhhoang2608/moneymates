import { renderRouter, screen, waitFor } from "expo-router/testing-library";
import { Text } from "react-native";

import { DEFAULT_FEATURES, useFeatures } from "@/api/features";

jest.mock("@/db/client", () => {
  const { openTestDb } = jest.requireActual("@/db/testing/testDb");
  return { db: openTestDb().db };
});

jest.mock("@expo-google-fonts/inter", () => ({
  useFonts: () => [true, null],
}));

function MockProbe() {
  const features = useFeatures();
  return <Text testID="features-probe">{JSON.stringify(features)}</Text>;
}

// Replace only the DB provider; the real root layout (QueryProvider + Stack) still renders.
jest.mock("@/db/DatabaseProvider", () => {
  const { View } = jest.requireActual("react-native");
  return {
    DatabaseProvider: ({ children }: { children: React.ReactNode }) => (
      <View>
        <MockProbe />
        {children}
      </View>
    ),
  };
});

const originalFetch = global.fetch;
const originalUrl = process.env.EXPO_PUBLIC_API_URL;

afterEach(() => {
  global.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = originalUrl;
});

describe("root layout", () => {
  it("AC4: renders the app and serves default features when /me/features rejects", async () => {
    process.env.EXPO_PUBLIC_API_URL = "https://api.test";
    const fetchMock = jest.fn(async () => {
      throw new Error("offline");
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await renderRouter("./app", { initialUrl: "/" });

    expect(screen.getByTestId("screen-overview")).toBeTruthy();
    expect(JSON.parse(screen.getByTestId("features-probe").props.children)).toEqual(DEFAULT_FEATURES);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(screen.getByTestId("features-probe").props.children)).toEqual(DEFAULT_FEATURES);
    expect(screen.getByTestId("screen-overview")).toBeTruthy();
  });
});
