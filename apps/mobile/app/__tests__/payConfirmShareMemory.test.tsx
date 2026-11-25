import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import qr from "../../e2e/fixtures/qr.json";
import { createHandOffMemoryRepository, createHandOffRepository } from "@/db/repositories";
import { usePendingHandOff } from "@/stores/pendingHandOff";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { scanResultToRoute } from "@/lib/vietqr/scanRoute";

jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/db/client", () => {
  const db = new Proxy({}, { get: (_t, key) => (global.__PAY_TEST_DB__ as never)[key] });
  return { db };
});
const mockHandOff = jest.fn();
jest.mock("@/lib/payConfirm/handOffDeps", () => ({
  makeHandOff: jest.fn(
    () =>
      (...args: unknown[]) =>
        mockHandOff(...args),
  ),
}));

declare global {
  var __PAY_TEST_DB__: object;
}

const testDb = () => global.__PAY_TEST_DB__ as unknown as AnyDb;

const fetchMock = jest.fn(() => {
  throw new Error("network disabled");
});
const original = global.fetch;
beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterAll(() => {
  global.fetch = original;
  expect(fetchMock).not.toHaveBeenCalled(); // AC6
});

const urlFor = (text: string) => {
  const r = scanResultToRoute(text);
  if (!r.ok) throw new Error("expected ok");
  return `/pay-confirm?${new URLSearchParams(r.href.params).toString()}`;
};

/** Opens the app sheet, searches the whole catalogue for the id and picks that app. */
async function pickApp(id: string) {
  await fireEvent.press(await screen.findByTestId("pay-app-change"));
  await fireEvent.changeText(await screen.findByTestId("pay-app-search"), id);
  await fireEvent.press(await screen.findByTestId(`app-${id}`));
}

describe("pay-confirm share memory", () => {
  beforeEach(async () => {
    mockHandOff.mockReset();
    usePendingHandOff.setState({ pending: null, visible: false });
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-pay-")), "test.db");
    global.__PAY_TEST_DB__ = openTestDb(file).db;
  });

  it("records a hand-off, never asks, and a 75 s return marks it paid and remembers share_ok", async () => {
    mockHandOff.mockResolvedValue({ opened: true, mode: "direct", decision: "direct-share", share: "shared" });
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    await pickApp("tcb");
    await fireEvent.press(screen.getByTestId("pay-submit"));
    await waitFor(() => expect(usePendingHandOff.getState().pending?.handOffId).toBeTruthy());
    const repo = createHandOffRepository(testDb());
    const id = usePendingHandOff.getState().pending?.handOffId as string;
    const row = await repo.get(id);
    expect(row?.method).toBe("share");
    expect(row?.paid_signal).toBeNull();
    await repo.recordReturn(id, new Date(new Date(row?.started_at as string).getTime() + 75_000));
    expect((await repo.get(id))?.paid_signal).toBe("time");
    expect(await createHandOffMemoryRepository(testDb()).getShareMemory()).toEqual({ tcb: "share_ok" });
  });

  it("autofill hand-off does not ask", async () => {
    mockHandOff.mockResolvedValue({ opened: true, mode: "autofill", decision: "autofill-link" });
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    await pickApp("mb");
    await fireEvent.press(screen.getByTestId("pay-submit"));
    await waitFor(() => expect(mockHandOff).toHaveBeenCalled());
  });

  it("passes the remembered result to the hand-off", async () => {
    await createHandOffMemoryRepository(testDb()).setShareResult("vcb", false);
    mockHandOff.mockResolvedValue({ opened: true, mode: "direct", decision: "direct-share", share: "share_failed" });
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    await pickApp("vcb");
    await fireEvent.press(screen.getByTestId("pay-submit"));
    await waitFor(() => expect(mockHandOff).toHaveBeenCalled());
    expect(mockHandOff.mock.calls[0][1].knownResult).toBe("share_failed");
  });

  it("stores a rejected share as failed", async () => {
    mockHandOff.mockResolvedValue({ opened: true, mode: "direct", decision: "direct-share", share: "share_failed" });
    await renderRouter("./app", { initialUrl: urlFor(qr.dynamic) });
    await pickApp("tcb");
    await fireEvent.press(screen.getByTestId("pay-submit"));
    await waitFor(async () =>
      expect(await createHandOffMemoryRepository(testDb()).getShareMemory()).toEqual({ tcb: "share_failed" }),
    );
  });
});
