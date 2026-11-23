import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { setApiAdapter } from "@/api/adapter";
import { ApiError } from "@/api/errors";
import { queryClient } from "@/api/QueryProvider";
import { createAppSettingRepository, createCategoryRepository } from "@/db/repositories";
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
      attachmentUri: "file:///bill.jpg",
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
    expect(screen).toHaveSearchParams({ source: "bill", categoryId: other.id });
  });

  it("AC4: opened while AI is unavailable → error state, no capture, no upload", async () => {
    setup(false);
    await accept();
    await renderRouter("./app", { initialUrl: "/bill" });
    expect(await screen.findByTestId("bill-error")).toBeTruthy();
    expect(source.capture).not.toHaveBeenCalled();
    expect(postMultipart).not.toHaveBeenCalled();
  });
});
