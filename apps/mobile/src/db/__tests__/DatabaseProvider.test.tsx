import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { vi } from "@/i18n/vi";

import { DatabaseProvider } from "../DatabaseProvider";

const mockUseMigrations = jest.fn();
jest.mock("drizzle-orm/expo-sqlite/migrator", () => ({
  useMigrations: (...a: unknown[]) => mockUseMigrations(...a),
}));
jest.mock("../client", () => ({ db: {} }));
jest.mock("../migrations/migrations", () => ({ __esModule: true, default: {} }));

describe("DatabaseProvider", () => {
  it("renders children once migrations succeed", async () => {
    mockUseMigrations.mockReturnValue({ success: true, error: undefined });
    await render(
      <DatabaseProvider>
        <Text>child</Text>
      </DatabaseProvider>,
    );
    expect(screen.getByText("child")).toBeTruthy();
  });

  it("renders nothing while migrating", async () => {
    mockUseMigrations.mockReturnValue({ success: false, error: undefined });
    await render(
      <DatabaseProvider>
        <Text>child</Text>
      </DatabaseProvider>,
    );
    expect(screen.queryByText("child")).toBeNull();
  });

  it("shows a Vietnamese error on failure", async () => {
    mockUseMigrations.mockReturnValue({ success: false, error: new Error("boom") });
    await render(
      <DatabaseProvider>
        <Text>child</Text>
      </DatabaseProvider>,
    );
    expect(screen.getByText(vi.db.migrationError)).toBeTruthy();
    expect(screen.queryByText("child")).toBeNull();
  });
});
