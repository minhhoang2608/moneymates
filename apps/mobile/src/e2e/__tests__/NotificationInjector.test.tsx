import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { RepositoriesProvider } from "@/db/RepositoriesProvider";
import { createCategoryRepository, createHandOffRepository, createTransactionRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { useBankNotificationSubscriber } from "@/hooks/useBankNotificationSubscriber";

import { E2eNotificationInjector } from "../NotificationInjector";
import { e2eQr } from "../fixtures";
import { setE2eAccessGranted } from "../notificationListener";

jest.mock("../isE2E", () => ({ isE2E: () => true }));

function Wiring() {
  useBankNotificationSubscriber();
  return <E2eNotificationInjector />;
}

const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 30))));

describe("E2eNotificationInjector", () => {
  afterEach(() => setE2eAccessGranted(false));
  it("enable, inject and see paid:notification", async () => {
    const db = openTestDb().db as unknown as AnyDb;
    const cat = (await createCategoryRepository(db).listByKind("expense"))[0];
    const tx = await createTransactionRepository(db).create({
      type: "expense",
      amount: 55000,
      category_id: cat.id,
      note: "x",
      occurred_at: new Date().toISOString(),
      source: "qr",
      qr_data: e2eQr.dynamic,
    });
    const h = await createHandOffRepository(db).create({
      transaction_id: tx.id,
      app_id: "tpb",
      method: "share",
      started_at: new Date(Date.now() - 60_000),
    });
    await render(
      <RepositoriesProvider db={db}>
        <Wiring />
      </RepositoriesProvider>,
    );
    await flush();
    expect(screen.getByTestId("e2e-notif-status").props.children).toBe("idle");
    await fireEvent.press(screen.getByTestId("e2e-notif-enable"));
    await flush();
    await fireEvent.press(screen.getByTestId("e2e-notif-inject-tpbank"));
    await flush();
    expect(screen.getByTestId("e2e-notif-status").props.children).toBe("paid:notification");
    expect((await createHandOffRepository(db).get(h.id))?.paid_signal).toBe("notification");
  });
});
