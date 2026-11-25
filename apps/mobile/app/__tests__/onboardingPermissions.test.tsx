import { fireEvent, renderRouter, screen } from "expo-router/testing-library";

import { setPermissionAdapter } from "@/lib/permissions";

// expo-router/testing-library registers an empty reanimated mock on import: override it afterwards.
Object.assign(require("react-native-reanimated"), require("../../jest.reanimated-mock"));
jest.mock("@/db/client", () => {
  const { openTestDb } = jest.requireActual("@/db/testing/testDb");
  return { db: openTestDb().db };
});
jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));

afterEach(() => setPermissionAdapter(null));

it("renders the permissions step route", async () => {
  setPermissionAdapter({
    get: async () => ({ status: "undetermined" }),
    request: async () => ({ status: "granted" }),
    openSettings: async () => undefined,
  });
  await renderRouter("./app", { initialUrl: "/onboarding/permissions" });
  expect(await screen.findByText("Cho phép những gì cần")).toBeTruthy();
});

it("next and skip lead to step 4", async () => {
  setPermissionAdapter({
    get: async () => ({ status: "undetermined" }),
    request: async () => ({ status: "granted" }),
    openSettings: async () => undefined,
  });
  await renderRouter("./app", { initialUrl: "/onboarding/permissions" });
  fireEvent.press(await screen.findByTestId("perm-next"));
  expect(await screen.findByText("Bước 4/4")).toBeTruthy();
});
