import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { createBankAccountRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { vi } from "@/i18n/vi";
import { generateVietQr, parseVietQr } from "@/lib/vietqr";

jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/db/client", () => {
  const db = new Proxy({}, { get: (_t, key) => (global.__BANK_TEST_DB__ as never)[key] });
  return { db };
});
jest.mock("react-native-qrcode-svg", () => {
  const { View } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: ({ value }: { value: string }) => <View testID="qr-inner" accessibilityLabel={value} />,
  };
});

declare global {
  var __BANK_TEST_DB__: object;
}

let file: string;
function freshFile() {
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-bank-")), "test.db");
  global.__BANK_TEST_DB__ = openTestDb(file).db;
}
function repo() {
  return createBankAccountRepository(openTestDb(file).db as unknown as AnyDb);
}
async function seed(n: number) {
  const r = repo();
  const rows = [];
  for (let i = 0; i < n; i++) {
    rows.push(
      await r.addAccount({
        bank_bin: i === 0 ? "970407" : "970423",
        account_no: i === 0 ? "190345676789" : "0456789123",
        account_name: "HOANG LE",
      }),
    );
  }
  return rows;
}
async function renderScreen() {
  await renderRouter("./app", { initialUrl: "/bank-accounts" });
  await screen.findByTestId("screen-bank-accounts");
}
async function fillAndSave(opts: { bank?: string; no?: string; holder?: string }) {
  await fireEvent.press(screen.getByTestId("account-bank"));
  if (opts.bank) await fireEvent.press(await screen.findByTestId(`bank-option-${opts.bank}`));
  else await fireEvent.press(screen.getByTestId("bank-picker-close"));
  if (opts.no !== undefined) await fireEvent.changeText(screen.getByTestId("account-no"), opts.no);
  if (opts.holder) await fireEvent.changeText(screen.getByTestId("account-holder"), opts.holder);
  await fireEvent.press(screen.getByTestId("account-save"));
}

describe("Tài khoản nhận tiền screen", () => {
  it("AC1: adds TPBank on an empty list and marks it default", async () => {
    freshFile();
    await renderScreen();
    await fireEvent.press(await screen.findByTestId("account-add"));
    await fillAndSave({ bank: "TPB", no: "0123456789", holder: "LE MINH HOANG" });
    await screen.findByText(vi.bankAccounts.defaultBadge);
    expect(screen.getByText("TPBank · 0123 4567 89")).toBeTruthy();
    const rows = await repo().listAccounts();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ account_no: "0123456789", account_name: "LE MINH HOANG", is_default: true });
  });

  it("AC2: marking the second account default leaves only it as default", async () => {
    freshFile();
    const [, second] = await seed(2);
    await renderScreen();
    await fireEvent.press(await screen.findByTestId(`account-set-default-${second.id}`));
    await waitFor(() => expect(screen.getAllByText(vi.bankAccounts.defaultBadge)).toHaveLength(1));
    expect(screen.getByTestId(`account-default-${second.id}`)).toBeTruthy();
    const rows = await repo().listAccounts();
    expect(rows.filter((r) => r.is_default).map((r) => r.id)).toEqual([second.id]);
  });

  it("AC3: QR preview payload equals generateVietQr without amount", async () => {
    freshFile();
    const r = repo();
    const row = await r.addAccount({ bank_bin: "970423", account_no: "0123456789", account_name: "LE MINH HOANG" });
    await renderScreen();
    await fireEvent.press(await screen.findByTestId(`account-row-${row.id}`));
    const qr = await screen.findByTestId("account-qr");
    const expected = generateVietQr({ bankBin: "970423", account: "0123456789", name: "LE MINH HOANG" });
    expect(qr.props.accessibilityLabel).toBe(expected);
    expect(screen.getByTestId("qr-inner").props.accessibilityLabel).toBe(expected);
    expect(parseVietQr(expected)).toMatchObject({
      kind: "vietqr",
      bankBin: "970423",
      account: "0123456789",
      name: "LE MINH HOANG",
    });
  });

  it("AC4: deleting the default promotes the other; deleting the last shows empty state", async () => {
    freshFile();
    const [first, second] = await seed(2);
    await renderScreen();
    await fireEvent.press(await screen.findByTestId(`account-row-${first.id}`));
    await fireEvent.press(screen.getByTestId("account-delete"));
    await screen.findByTestId(`account-default-${second.id}`);
    expect((await repo().getDefaultAccount())?.id).toBe(second.id);
    await fireEvent.press(screen.getByTestId(`account-row-${second.id}`));
    await fireEvent.press(screen.getByTestId("account-delete"));
    await waitFor(() => expect(screen.queryByTestId(`account-row-${second.id}`)).toBeNull());
    expect(screen.getByTestId("account-add")).toBeTruthy();
    expect(await repo().listAccounts()).toHaveLength(0);
  });

  it("AC5: missing bank or account number blocks saving", async () => {
    freshFile();
    await renderScreen();
    await fireEvent.press(await screen.findByTestId("account-add"));
    await fillAndSave({ no: "0123456789" });
    expect(await screen.findByText(vi.bankAccounts.bankRequired)).toBeTruthy();
    await fillAndSave({ bank: "TPB", no: "   " });
    expect(await screen.findByText(vi.bankAccounts.accountNoRequired)).toBeTruthy();
    expect(await repo().listAccounts()).toHaveLength(0);
  });
});
