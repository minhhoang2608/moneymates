import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { queryClient } from "@/api/QueryProvider";
import { createBankAccountRepository, createProfileRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { resetOnboardingOverrideForTests, setLaunchUrlReader } from "@/e2e/onboardingOverride";

jest.unmock("@/components/onboarding/OnboardingGate");
jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/db/client", () => {
  const db = new Proxy({}, { get: (_t, key) => (global.__ONB_ACC_DB__ as never)[key] });
  return { db };
});

declare global {
  var __ONB_ACC_DB__: object;
}

let file: string;
const db = () => openTestDb(file).db as unknown as AnyDb;
const accounts = () => createBankAccountRepository(db());
const profile = () => createProfileRepository(db());

function freshFile() {
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-onbacc-")), "test.db");
  global.__ONB_ACC_DB__ = openTestDb(file).db;
}

async function renderStep4() {
  await renderRouter("./app", { initialUrl: "/onboarding/account" });
  await screen.findByText("Bước 4/4");
}

async function pickBank(code = "TPB") {
  await fireEvent.press(screen.getByTestId("onb-account-bank"));
  await fireEvent.press(await screen.findByTestId(`bank-option-${code}`));
}

beforeEach(() => {
  queryClient.clear();
  setLaunchUrlReader(async () => null);
  resetOnboardingOverrideForTests();
});

const disabled = () => screen.getByTestId("onb-next").props.accessibilityState?.disabled;

describe("onboarding step 4 Tài khoản nhận tiền", () => {
  it("saves a default account, completes onboarding and lands on Tổng quan", async () => {
    freshFile();
    await renderStep4();
    await pickBank();
    await fireEvent.changeText(screen.getByTestId("onb-account-no"), "0123456789");
    await fireEvent.changeText(screen.getByTestId("onb-account-holder"), "NGUYEN VAN HOANG");
    await fireEvent.press(screen.getByTestId("onb-next"));
    expect(await screen.findByTestId("screen-overview")).toBeTruthy();
    const rows = await accounts().listAccounts();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      is_default: true,
      bank_bin: "970423",
      bank_name: "TPBank",
      account_no: "0123456789",
      account_name: "NGUYEN VAN HOANG",
    });
    expect(await profile().getOnboardingCompletedAt()).not.toBeNull();
    expect(screen.queryByText("Bước 4/4")).toBeNull();
  });

  it("with several accounts, edits the default one and keeps exactly one default", async () => {
    freshFile();
    const first = await accounts().addAccount({ bank_bin: "970407", account_no: "111", account_name: "A" });
    const second = await accounts().addAccount({ bank_bin: "970407", account_no: "222", account_name: "B" });
    await renderStep4();
    await waitFor(() => expect(screen.getByTestId("onb-account-no").props.value).toBe("111"));
    await fireEvent.changeText(screen.getByTestId("onb-account-no"), "333");
    await fireEvent.press(screen.getByTestId("onb-next"));
    await screen.findByTestId("screen-overview");
    const rows = await accounts().listAccounts();
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.is_default).map((r) => r.id)).toEqual([first.id]);
    expect(rows.find((r) => r.id === first.id)?.account_no).toBe("333");
    expect(rows.find((r) => r.id === second.id)?.account_no).toBe("222");
  });

  it("normalises the holder name on save", async () => {
    freshFile();
    await renderStep4();
    await pickBank();
    await fireEvent.changeText(screen.getByTestId("onb-account-no"), "0123456789");
    await fireEvent.changeText(screen.getByTestId("onb-account-holder"), "Nguyễn Văn Hoàng");
    await fireEvent.press(screen.getByTestId("onb-next"));
    await screen.findByTestId("screen-overview");
    expect((await accounts().listAccounts())[0].account_name).toBe("NGUYEN VAN HOANG");
  });

  it("keeps Hoàn tất disabled on invalid input and stores nothing", async () => {
    freshFile();
    await renderStep4();
    expect(disabled()).toBe(true);
    await fireEvent.changeText(screen.getByTestId("onb-account-no"), "0123");
    await fireEvent.changeText(screen.getByTestId("onb-account-holder"), "A B");
    expect(disabled()).toBe(true); // no bank
    await pickBank();
    expect(disabled()).toBe(false);
    await fireEvent.changeText(screen.getByTestId("onb-account-no"), "12ab");
    expect(disabled()).toBe(true);
    await fireEvent.changeText(screen.getByTestId("onb-account-no"), "");
    expect(disabled()).toBe(true);
    await fireEvent.press(screen.getByTestId("onb-next"));
    expect(await accounts().listAccounts()).toHaveLength(0);
    expect(await profile().getOnboardingCompletedAt()).toBeNull();
  });

  it("Để sau stores nothing, completes onboarding and lands on Tổng quan", async () => {
    freshFile();
    await renderStep4();
    await fireEvent.press(screen.getByTestId("onb-skip"));
    expect(await screen.findByTestId("screen-overview")).toBeTruthy();
    expect(await accounts().listAccounts()).toHaveLength(0);
    expect(await profile().getOnboardingCompletedAt()).not.toBeNull();
  });

  it("re-run: prefills the default account and updates it in place", async () => {
    freshFile();
    const row = await accounts().addAccount({ bank_bin: "970423", account_no: "0123456789", account_name: "OLD NAME" });
    await accounts().setDefault(row.id);
    await renderStep4();
    await waitFor(() => expect(screen.getByTestId("onb-account-no").props.value).toBe("0123456789"));
    expect(screen.getByTestId("onb-account-holder").props.value).toBe("OLD NAME");
    expect(screen.getByText("TPBank")).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("onb-account-holder"), "New Name");
    await fireEvent.press(screen.getByTestId("onb-next"));
    await screen.findByTestId("screen-overview");
    const rows = await accounts().listAccounts();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: row.id, account_name: "NEW NAME", is_default: true });
  });
});
