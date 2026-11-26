import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { router } from "expo-router";
import * as safeArea from "react-native-safe-area-context";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { pickAvatar } from "@/components/AvatarPicker";
import { createProfileRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { vi } from "@/i18n/vi";

jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/components/AvatarPicker", () => ({ pickAvatar: jest.fn() }));
// The real client opens a native SQLite database at import time; the tests use a file-backed db.
jest.mock("@/db/client", () => {
  // Delegates to the db that freshFile() opens for the current test.
  const db = new Proxy({}, { get: (_t, key) => (global.__PROFILE_TEST_DB__ as never)[key] });
  return { db };
});

declare global {
  var __PROFILE_TEST_DB__: object;
}

const pick = pickAvatar as jest.Mock;
let file: string;

beforeEach(() => {
  pick.mockReset();
});

function freshFile() {
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-profile-")), "test.db");
  global.__PROFILE_TEST_DB__ = openTestDb(file).db;
}

async function renderProfile() {
  const view = await renderRouter("./app", { initialUrl: "/profile" });
  await screen.findByTestId("profile-name");
  return view;
}

function dbRow() {
  const { db } = openTestDb(file);
  return createProfileRepository(db as unknown as AnyDb).getProfile();
}

async function rename(value: string) {
  await fireEvent.press(screen.getByTestId("profile-edit-name"));
  await fireEvent.changeText(screen.getByTestId("profile-name-input"), value);
  await fireEvent.press(screen.getByTestId("profile-name-save"));
}

describe("Hồ sơ screen", () => {
  afterEach(() => jest.restoreAllMocks());

  it("keeps the screen below the status bar", async () => {
    jest.spyOn(safeArea, "useSafeAreaInsets").mockReturnValue({ top: 30, bottom: 0, left: 0, right: 0 });
    freshFile();
    await renderProfile();
    expect(screen.getByTestId("screen-profile")).toHaveStyle({ paddingTop: 30 });
  });

  it("AC1: persists the name Hoàng and the avatar across remount", async () => {
    freshFile();
    pick.mockResolvedValue("file:///a.jpg");
    const first = await renderProfile();
    await rename("Hoàng");
    await waitFor(() => expect(screen.getByTestId("profile-name").props.children).toBe("Hoàng"));
    await fireEvent.press(screen.getByTestId("profile-avatar"));
    await waitFor(() =>
      expect(screen.getByTestId("profile-avatar-image").props.source).toEqual({ uri: "file:///a.jpg" }),
    );
    first.unmount();

    const row = await dbRow();
    expect(row.display_name).toBe("Hoàng");
    expect(row.avatar_uri).toBe("file:///a.jpg");

    await renderProfile();
    expect(screen.getByTestId("profile-name").props.children).toBe("Hoàng");
    await waitFor(() =>
      expect(screen.getByTestId("profile-avatar-image").props.source).toEqual({ uri: "file:///a.jpg" }),
    );
  });

  it("AC1b: cancelling the picker keeps the avatar", async () => {
    freshFile();
    pick.mockResolvedValue(null);
    await renderProfile();
    await fireEvent.press(screen.getByTestId("profile-avatar"));
    await act(async () => {});
    expect(screen.queryByTestId("profile-avatar-image")).toBeNull();
    expect((await dbRow()).avatar_uri).toBeNull();
  });

  it("AC2: an empty name is rejected and not saved", async () => {
    freshFile();
    await renderProfile();
    await rename("Hoàng");
    await waitFor(() => expect(screen.getByTestId("profile-name").props.children).toBe("Hoàng"));

    await rename("   ");
    expect(screen.getByTestId("profile-name-error").props.children).toBe(vi.profile.nameRequired);
    expect((await dbRow()).display_name).toBe("Hoàng");
  });

  it("AC3: the three rows navigate", async () => {
    freshFile();
    await renderProfile();
    for (const [row, pathname, screenId] of [
      ["row-bank-accounts", "/bank-accounts", "screen-bank-accounts"],
      ["row-categories", "/categories", "screen-categories"],
      ["row-settings", "/settings", "screen-settings"],
    ]) {
      await fireEvent.press(screen.getByTestId(row));
      expect(screen).toHavePathname(pathname);
      expect(screen.getByTestId(screenId)).toBeTruthy();
      await act(async () => {
        router.back();
      });
      await screen.findByTestId("screen-profile");
    }
  });

  it("AC4: works offline", async () => {
    freshFile();
    pick.mockResolvedValue("file:///b.jpg");
    const fetchMock = jest.fn(() => {
      throw new Error("network disabled");
    });
    const original = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      await renderProfile();
      await rename("Lan");
      await fireEvent.press(screen.getByTestId("profile-avatar"));
      await fireEvent.press(screen.getByTestId("row-settings"));
      expect(screen).toHavePathname("/settings");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      global.fetch = original;
    }
  });
});
