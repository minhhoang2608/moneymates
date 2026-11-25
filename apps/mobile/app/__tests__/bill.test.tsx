import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { setApiAdapter } from "@/api/adapter";
import { ApiError } from "@/api/errors";
import { queryClient } from "@/api/QueryProvider";
import { createAppSettingRepository, createCategoryRepository, createTransactionRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { setBillImageSource } from "@/lib/bill/imageSource";

jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/db/client", () => {
  const db = new Proxy({}, { get: (_t, key) => (global.__BILL_TEST_DB__ as never)[key] });
  return { db };
});

declare global {
  var __BILL_TEST_DB__: object;
}

let file: string;
const d = () => openTestDb(file).db as unknown as AnyDb;
const original = global.fetch;
const source = { capture: jest.fn(async () => "file:///bill.jpg"), pick: jest.fn(async () => "file:///pick.jpg") };
const postMultipart = jest.fn();
const response = {
  amount: 345000,
  currency: "VND",
  shop: "Bánh căn Nhà Chung",
  date: "2026-11-22",
  category: "Ăn uống",
};

function setup(aiOn = true) {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ ai_enabled: aiOn, ai_parse_text: aiOn, ai_parse_bill: aiOn }),
  })) as unknown as typeof fetch;
  setApiAdapter({
    get: async () => ({ ai_enabled: aiOn, ai_parse_text: aiOn, ai_parse_bill: aiOn }),
    post: jest.fn(),
    postMultipart,
  } as never);
}

beforeEach(() => {
  delete process.env.EXPO_PUBLIC_E2E;
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-bill-")), "test.db");
  global.__BILL_TEST_DB__ = openTestDb(file).db;
  jest.clearAllMocks();
  queryClient.clear();
  postMultipart.mockImplementation(async () => response);
  setBillImageSource(source);
  setup();
});
afterEach(() => {
  global.fetch = original;
  setApiAdapter(null);
  setBillImageSource(null);
});

const accept = () => createAppSettingRepository(d()).set("bill_privacy_accepted", true);

describe("bill scan screen", () => {
  it("AC2: shows the privacy notice before any upload on first use", async () => {
    await renderRouter("./app", { initialUrl: "/bill" });
    expect(await screen.findByTestId("bill-privacy")).toBeTruthy();
    expect(source.capture).not.toHaveBeenCalled();
    expect(postMultipart).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId("bill-accept"));
    expect(await screen.findByTestId("bill-result")).toBeTruthy();
    expect(postMultipart).toHaveBeenCalledTimes(1);
    expect(await createAppSettingRepository(d()).get("bill_privacy_accepted")).toBe(true);
  });

  it("AC2: does not show the notice again once accepted", async () => {
    await accept();
    await renderRouter("./app", { initialUrl: "/bill" });
    expect(await screen.findByTestId("bill-result")).toBeTruthy();
    expect(screen.queryByTestId("bill-privacy")).toBeNull();
  });

  it("AC1: shows amount, shop, date and category from the AI result", async () => {
    await accept();
    await renderRouter("./app", { initialUrl: "/bill" });
    await screen.findByTestId("bill-result");
    expect(screen.getByTestId("bill-amount")).toHaveTextContent("345.000đ");
    expect(screen.getByText("Bánh căn Nhà Chung")).toBeTruthy();
    expect(screen.getByText("22/11/2026")).toBeTruthy();
    expect(screen.getByTestId("bill-category")).toHaveTextContent("Ăn uống");
  });

  it("AC1 (#190): result title text is exactly 'AI đã đọc xong bill'", async () => {
    await accept();
    await renderRouter("./app", { initialUrl: "/bill" });
    await screen.findByTestId("bill-result");
    expect(screen.getByText("AI đã đọc xong bill")).toBeTruthy();
    expect(screen.getByTestId("bill-done").props.children).toBe("AI đã đọc xong bill");
  });

  it("AC3: Chụp lại discards the result and captures again", async () => {
    await accept();
    await renderRouter("./app", { initialUrl: "/bill" });
    await screen.findByTestId("bill-result");
    postMultipart.mockImplementation(() => new Promise(() => undefined));
    await fireEvent.press(screen.getByTestId("bill-retake"));
    expect(await screen.findByTestId("bill-loading")).toBeTruthy();
    expect(screen.queryByTestId("bill-result")).toBeNull();
    expect(source.capture).toHaveBeenCalledTimes(2);
  });

  it("Điền vào form routes to the transaction form with the bill params", async () => {
    await accept();
    await renderRouter("./app", { initialUrl: "/bill" });
    await screen.findByTestId("bill-result");
    await fireEvent.press(screen.getByTestId("bill-fill-form"));
    await waitFor(() => expect(screen).toHavePathname("/transaction/new"));
    const food = (await createCategoryRepository(d()).listByKind("expense")).find((c) => c.name === "Ăn uống")!;
    expect(screen).toHaveSearchParams({
      source: "bill",
      amount: "345000",
      note: "Bánh căn Nhà Chung",
      categoryId: food.id,
      date: "2026-11-22",
      attachmentUri: expect.stringMatching(/^file:\/\/\/doc\/attachments\/[0-9a-f-]{36}\.jpg$/),
    });
  });

  it.each([
    ["quota_exceeded", "Bạn đã dùng hết lượt AI hôm nay. Vui lòng nhập tay."],
    ["ai_unavailable", "AI tạm thời không phản hồi. Vui lòng thử lại sau."],
    ["ai_disabled", "Tính năng AI đang tắt. Vui lòng nhập tay."],
    ["timeout", "Máy chủ phản hồi quá lâu. Vui lòng thử lại."],
  ] as const)("AC6: %s shows a short message and Nhập tay uses Khác", async (code, message) => {
    await accept();
    postMultipart.mockImplementation(async () => {
      throw new ApiError(code);
    });
    await renderRouter("./app", { initialUrl: "/bill" });
    expect(await screen.findByTestId("bill-error")).toHaveTextContent(message);
    await fireEvent.press(screen.getByTestId("bill-manual"));
    await waitFor(() => expect(screen).toHavePathname("/transaction/new"));
    const other = (await createCategoryRepository(d()).listByKind("expense")).find((c) => c.name === "Khác")!;
    expect(screen).toHaveSearchParams({
      source: "bill",
      categoryId: other.id,
      attachmentUri: expect.stringMatching(/^file:\/\/\/doc\/attachments\/[0-9a-f-]{36}\.jpg$/),
    });
  });

  it("AC4: opened while AI is unavailable → error state, no capture, no upload", async () => {
    setup(false);
    await accept();
    await renderRouter("./app", { initialUrl: "/bill" });
    expect(await screen.findByTestId("bill-error")).toBeTruthy();
    expect(source.capture).not.toHaveBeenCalled();
    expect(postMultipart).not.toHaveBeenCalled();
  });

  it("AC1/AC3: Điền vào form prefills the form and saving stores a bill transaction with the attachment", async () => {
    await accept();
    await renderRouter("./app", { initialUrl: "/bill" });
    await screen.findByTestId("bill-result");
    await fireEvent.press(screen.getByTestId("bill-fill-form"));
    await waitFor(() => expect(screen).toHavePathname("/transaction/new"));
    expect(await screen.findByTestId("photo-thumbnail")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("save-button"));
    await waitFor(async () => expect((await createTransactionRepository(d()).list()).length).toBe(1));
    const [row] = await createTransactionRepository(d()).list();
    expect(row).toMatchObject({ amount: 345000, currency: "VND", note: "Bánh căn Nhà Chung", source: "bill" });
    expect(row!.photo_uri).toMatch(/^file:\/\/\/doc\/attachments\/[0-9a-f-]{36}\.jpg$/);
    const when = new Date(row!.occurred_at);
    expect([when.getFullYear(), when.getMonth() + 1, when.getDate()]).toEqual([2026, 11, 22]);
  });

  it.each(["ai_unavailable", "quota_exceeded", "timeout"] as const)(
    "AC2: after a %s error, Nhập tay keeps the image and saving stores it",
    async (code) => {
      await accept();
      postMultipart.mockImplementation(async () => {
        throw new ApiError(code);
      });
      await renderRouter("./app", { initialUrl: "/bill" });
      await screen.findByTestId("bill-error");
      await fireEvent.press(screen.getByTestId("bill-manual"));
      await waitFor(() => expect(screen).toHavePathname("/transaction/new"));
      expect(await screen.findByTestId("photo-thumbnail")).toBeTruthy();
      await fireEvent.changeText(screen.getByTestId("amount-input"), "120000");
      await fireEvent.press(screen.getByTestId("save-button"));
      await waitFor(async () => expect((await createTransactionRepository(d()).list()).length).toBe(1));
      const [row] = await createTransactionRepository(d()).list();
      const other = (await createCategoryRepository(d()).listByKind("expense")).find((c) => c.name === "Khác")!;
      expect(row).toMatchObject({ amount: 120000, source: "bill", category_id: other.id });
      expect(row!.photo_uri).toMatch(/^file:\/\/\/doc\/attachments\/[0-9a-f-]{36}\.jpg$/);
    },
  );
  describe("group flow (#430)", () => {
    const url = "/bill?groupId=g1";
    it("AC1: Điền vào form keeps the groupId", async () => {
      await accept();
      await renderRouter("./app", { initialUrl: url });
      await screen.findByTestId("bill-result");
      await fireEvent.press(screen.getByTestId("bill-fill-form"));
      await waitFor(() => expect(screen).toHavePathname("/transaction/new"));
      expect(screen).toHaveSearchParams({
        source: "bill",
        groupId: "g1",
        amount: "345000",
        note: "Bánh căn Nhà Chung",
        categoryId: expect.any(String),
        date: "2026-11-22",
        attachmentUri: expect.any(String),
      });
    });

    it("AC2: AI unavailable → Nhập tay opens the group form without an amount", async () => {
      setup(false);
      await accept();
      await renderRouter("./app", { initialUrl: url });
      expect(await screen.findByTestId("bill-error")).toBeTruthy();
      expect(source.capture).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByTestId("bill-manual"));
      await waitFor(() => expect(screen).toHavePathname("/transaction/new"));
      expect(screen).toHaveSearchParams({ source: "bill", groupId: "g1", categoryId: expect.any(String) });
    });

    it("AC2: upload error → Nhập tay keeps the groupId", async () => {
      await accept();
      postMultipart.mockImplementation(async () => {
        throw new ApiError("timeout");
      });
      await renderRouter("./app", { initialUrl: url });
      await screen.findByTestId("bill-error");
      await fireEvent.press(screen.getByTestId("bill-manual"));
      await waitFor(() => expect(screen).toHavePathname("/transaction/new"));
      expect(screen).toHaveSearchParams({
        source: "bill",
        groupId: "g1",
        categoryId: expect.any(String),
        attachmentUri: expect.any(String),
      });
    });

    it("AC2: consent screen Nhập tay keeps the groupId", async () => {
      await renderRouter("./app", { initialUrl: url });
      await screen.findByTestId("bill-privacy");
      await fireEvent.press(screen.getByTestId("bill-manual"));
      await waitFor(() => expect(screen).toHavePathname("/transaction/new"));
      expect(screen).toHaveSearchParams({ source: "bill", groupId: "g1", categoryId: expect.any(String) });
    });
  });
});
