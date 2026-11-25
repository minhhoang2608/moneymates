import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { pickAvatar } from "@/components/AvatarPicker";
import { createProfileRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { queryClient } from "@/api/QueryProvider";
import { resetOnboardingOverrideForTests, setLaunchUrlReader } from "@/e2e/onboardingOverride";
import { setPermissionAdapter } from "@/lib/permissions";

// The gate is mocked away globally in jest.setup.js: these tests exercise the real one.
jest.unmock("@/components/onboarding/OnboardingGate");
jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/components/AvatarPicker", () => ({ pickAvatar: jest.fn() }));
jest.mock("@/db/client", () => {
  const db = new Proxy({}, { get: (_t, key) => (global.__ONB_TEST_DB__ as never)[key] });
  return { db };
});

declare global {
  var __ONB_TEST_DB__: object;
}

let mockLaunchUrl: string | null = null;
const pick = pickAvatar as jest.Mock;
let file: string;

function repo() {
  return createProfileRepository(openTestDb(file).db as unknown as AnyDb);
}

async function freshFile(opts: { completed?: boolean; name?: string } = {}) {
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-onb-")), "test.db");
  global.__ONB_TEST_DB__ = openTestDb(file).db;
  if (opts.name) await repo().setDisplayName(opts.name);
  if (opts.completed) await repo().markOnboardingCompleted();
}

beforeEach(() => {
  pick.mockReset();
  queryClient.clear();
  mockLaunchUrl = null;
  setLaunchUrlReader(async () => mockLaunchUrl);
  resetOnboardingOverrideForTests();
  setPermissionAdapter({
    get: async () => ({ status: "undetermined" }),
    request: async () => ({ status: "granted" }),
    openSettings: async () => undefined,
  });
});
afterEach(() => {
  setPermissionAdapter(null);
  delete process.env.EXPO_PUBLIC_E2E;
});

describe("first-launch gate", () => {
  it("opens step 1 on a fresh install", async () => {
    await freshFile();
    await renderRouter("./app", { initialUrl: "/" });
    expect(await screen.findByText("Bước 1/4")).toBeTruthy();
    expect(screen.getByText("Chào bạn! Bạn tên gì?")).toBeTruthy();
    expect(screen.getByText("Để sau")).toBeTruthy();
    expect(screen.queryByTestId("screen-overview")).toBeNull();
  });

  it("opens Tổng quan once completed", async () => {
    await freshFile({ completed: true });
    await renderRouter("./app", { initialUrl: "/" });
    expect(await screen.findByTestId("screen-overview")).toBeTruthy();
    expect(screen.queryByText("Bước 1/4")).toBeNull();
  });

  it("is skipped in E2E mode", async () => {
    process.env.EXPO_PUBLIC_E2E = "1";
    await freshFile();
    await renderRouter("./app", { initialUrl: "/" });
    expect(await screen.findByTestId("screen-overview")).toBeTruthy();
  });

  it("E2E launch override shows step 1", async () => {
    process.env.EXPO_PUBLIC_E2E = "1";
    mockLaunchUrl = "moneymates:///onboarding?e2e_onboarding=1";
    await freshFile();
    await renderRouter("./app", { initialUrl: "/" });
    expect(await screen.findByText("Bước 1/4")).toBeTruthy();
  });
});

describe("step 1 Hồ sơ", () => {
  async function renderStep1(opts: { completed?: boolean; name?: string } = {}) {
    await freshFile(opts);
    await renderRouter("./app", { initialUrl: "/onboarding" });
    await screen.findByText("Chào bạn! Bạn tên gì?");
  }

  it("saves the name and goes to step 2 without an avatar", async () => {
    await renderStep1();
    await fireEvent.changeText(screen.getByTestId("onb-name-input"), "Hoàng");
    await fireEvent.press(screen.getByTestId("onb-next"));
    expect(await screen.findByText("Bước 2/4")).toBeTruthy();
    const p = await repo().getProfile();
    expect(p.display_name).toBe("Hoàng");
    expect(p.avatar_uri).toBeNull();
  });

  it("saves a picked avatar", async () => {
    await renderStep1();
    pick.mockResolvedValue("file:///a.jpg");
    await fireEvent.press(screen.getByTestId("onb-avatar"));
    await waitFor(() => expect(screen.getByTestId("onb-avatar-image")).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId("onb-name-input"), "Hoàng");
    await fireEvent.press(screen.getByTestId("onb-next"));
    await screen.findByText("Bước 2/4");
    expect((await repo().getProfile()).avatar_uri).toBe("file:///a.jpg");
  });

  it("rejects an empty name", async () => {
    await renderStep1();
    await fireEvent.changeText(screen.getByTestId("onb-name-input"), "  ");
    await fireEvent.press(screen.getByTestId("onb-next"));
    expect(await screen.findByTestId("onb-name-error")).toBeTruthy();
    expect(screen.getByText("Bước 1/4")).toBeTruthy();
  });

  it("prefills the existing name", async () => {
    await renderStep1({ name: "Hoàng" });
    await waitFor(() => expect(screen.getByTestId("onb-name-input").props.value).toBe("Hoàng"));
  });

  it("Để sau completes onboarding without saving", async () => {
    await renderStep1({ name: "Hoàng" });
    await fireEvent.changeText(screen.getByTestId("onb-name-input"), "Khác");
    await fireEvent.press(screen.getByTestId("onb-skip"));
    expect(await screen.findByTestId("screen-overview")).toBeTruthy();
    const p = await repo().getProfile();
    expect(p.display_name).toBe("Hoàng");
    expect(await repo().getOnboardingCompletedAt()).not.toBeNull();
  });
});

describe("skipping steps", () => {
  it("walks 2 → 3 → 4 → Tổng quan with Để sau, saving nothing", async () => {
    await freshFile({ name: "Hoàng" });
    await renderRouter("./app", { initialUrl: "/onboarding/apps" });
    await screen.findByText("Bước 2/4");
    await fireEvent.press(screen.getByTestId("onb-skip"));
    await screen.findByTestId("onboarding-permissions");
    await fireEvent.press(screen.getByTestId("perm-skip"));
    await screen.findByText("Bước 4/4");
    expect(await repo().getOnboardingCompletedAt()).toBeNull();
    await fireEvent.press(screen.getByTestId("onb-skip"));
    expect(await screen.findByTestId("screen-overview")).toBeTruthy();
    expect(await repo().getOnboardingCompletedAt()).not.toBeNull();
    expect((await repo().getProfile()).display_name).toBe("Hoàng");
  });

  it("Tiếp tục on step 4 completes", async () => {
    await freshFile();
    await renderRouter("./app", { initialUrl: "/onboarding/account" });
    await screen.findByText("Bước 4/4");
    await act(async () => {});
    await fireEvent.press(screen.getByTestId("onb-next"));
    expect(await screen.findByTestId("screen-overview")).toBeTruthy();
  });
});

describe("Hồ sơ re-run entry", () => {
  it("resets the status and opens step 1 with the saved name", async () => {
    await freshFile({ completed: true, name: "Hoàng" });
    await renderRouter("./app", { initialUrl: "/profile" });
    await fireEvent.press(await screen.findByTestId("row-onboarding"));
    await screen.findByText("Chào bạn! Bạn tên gì?");
    await waitFor(() => expect(screen.getByTestId("onb-name-input").props.value).toBe("Hoàng"));
    expect(await repo().getOnboardingCompletedAt()).toBeNull();
  });
});
