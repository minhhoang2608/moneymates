import * as safeArea from "react-native-safe-area-context";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { AccessibilityInfo } from "react-native";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { haptics } from "@/lib/haptics";
import { queryClient } from "@/api/QueryProvider";
import { createGroupRepository, createProfileRepository, createTransactionRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { setSpeechRecognizer, type SpeechHandlers, type SpeechRecognizer } from "@/voice/speech";

jest.mock("@/lib/haptics", () => ({
  haptics: { light: jest.fn(), selection: jest.fn(), error: jest.fn() },
  setHapticsEnabled: jest.fn(),
}));
jest.mock("@expo-google-fonts/inter", () => ({ useFonts: () => [true, null] }));
jest.mock("@/db/DatabaseProvider", () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/db/client", () => {
  const db = new Proxy({}, { get: (_t, key) => (global.__VOICE_TEST_DB__ as never)[key] });
  return { db };
});

declare global {
  var __VOICE_TEST_DB__: object;
}

let file: string;
const d = () => openTestDb(file).db as unknown as AnyDb;
const original = global.fetch;
let fetchMock: jest.Mock;
let heard = "";
let aiOn = false;
let handlers: SpeechHandlers | null = null;
const recognizer = {
  requestPermission: jest.fn(async (): Promise<boolean> => true),
  start: jest.fn((_lang: string, h: SpeechHandlers) => {
    handlers = h;
    h.onText(heard);
  }),
  stop: jest.fn(() => handlers?.onEnd()),
} satisfies SpeechRecognizer;

function mockApi(features: boolean, parse?: () => Promise<unknown>) {
  aiOn = features;
  fetchMock = jest.fn(async (url: string) => {
    if (String(url).includes("/me/features")) {
      return { ok: true, json: async () => ({ ai_enabled: features, ai_parse_text: features, ai_parse_bill: false }) };
    }
    if (!parse) throw new Error("unexpected fetch");
    return parse();
  });
  global.fetch = fetchMock as unknown as typeof fetch;
}
const parseCalls = () => fetchMock.mock.calls.filter(([u]) => String(u).includes("/ai/parse-text"));

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = "https://api.test/";
  delete process.env.EXPO_PUBLIC_E2E;
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mm-voice-")), "test.db");
  global.__VOICE_TEST_DB__ = openTestDb(file).db;
  jest.clearAllMocks();
  queryClient.clear(); // the app-wide client caches /me/features
  handlers = null;
  setSpeechRecognizer(recognizer);
  mockApi(false);
});
afterEach(() => {
  global.fetch = original;
  setSpeechRecognizer(null);
});

async function speakAndUse(text: string, url = "/voice") {
  heard = text;
  await renderRouter("./app", { initialUrl: url });
  await fireEvent(await screen.findByTestId("voice-mic"), "pressIn");
  await fireEvent(screen.getByTestId("voice-mic"), "pressOut");
  if (aiOn) await screen.findByText(/AI tách thông tin/); // /me/features has settled
  await fireEvent.press(screen.getByTestId("voice-use-result"));
  await screen.findByTestId("transaction-form");
}
const field = (id: string) => screen.getByTestId(id).props.value;

async function groupSetup() {
  await createProfileRepository(d()).setDisplayName("Hoàng");
  return createGroupRepository(d()).createGroup({ name: "Đà Lạt 12/2026", members: ["An", "Bình"] });
}

describe("voice entry screen", () => {
  afterEach(() => jest.restoreAllMocks());

  it("keeps the header below the status bar", async () => {
    jest.spyOn(safeArea, "useSafeAreaInsets").mockReturnValue({ top: 30, bottom: 0, left: 0, right: 0 });
    await renderRouter("./app", { initialUrl: "/voice" });
    await screen.findByTestId("voice-mic");
    expect(screen.getByTestId("screen-header")).toHaveStyle({ marginTop: 30 });
  });

  it("draws the design SVG mic (32 px), not an emoji", async () => {
    await renderRouter("./app", { initialUrl: "/voice" });
    await screen.findByTestId("voice-mic");
    expect(screen.queryByText("🎤")).toBeNull();
    // The design mic: capsule at 9,3 (6x11, rx 3) and the curved stand, drawn by MicIcon at 32 px.
    const tree = JSON.stringify(screen.toJSON());
    expect(tree).toContain("M5 11a7 7 0 0 0 14 0M12 18v3");
    expect(tree).toContain('"rx":"3"');
    expect(tree).toContain('"width":32,"height":32');
  });

  it("AC1: simple sentence prefills the form offline, no network call", async () => {
    await speakAndUse("ăn phở 50 nghìn");
    expect(recognizer.start).toHaveBeenCalledWith("vi-VN", expect.any(Object));
    expect(field("amount-input")).toBe("50000");
    expect(field("note-input")).toBe("phở");
    expect(await screen.findByText(/Ăn uống/)).toBeTruthy();
    expect(parseCalls()).toHaveLength(0);
    await fireEvent.press(screen.getByTestId("save-button"));
    const rows = await createTransactionRepository(d()).list({});
    expect(rows[0]).toMatchObject({ amount: 50000, note: "phở", source: "voice" });
  });

  it("AC2/AC6: group payer matched, saved with source voice", async () => {
    const g = await groupSetup();
    const binh = g.members.find((m) => m.displayName === "Bình")!;
    await speakAndUse("Bình trả tiền xăng hai trăm nghìn", `/voice?groupId=${g.id}`);
    expect(field("amount-input")).toBe("200000");
    expect(field("note-input")).toBe("Tiền xăng");
    expect(await screen.findByText(/Di chuyển/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId("save-button"));
    const rows = await createTransactionRepository(d()).list({});
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amount: 200000, source: "voice", paid_by_member_id: binh.id });
  });

  it("group: a filler word before the payer still matches and the form is prefilled", async () => {
    const g = await groupSetup();
    const binh = g.members.find((m) => m.displayName === "Bình")!;
    await speakAndUse("Anh Bình trả 300k ăn tối", `/voice?groupId=${g.id}`);
    expect(field("amount-input")).toBe("300000");
    expect(field("note-input")).not.toBe("");
    await fireEvent.press(screen.getByTestId("save-button"));
    const rows = await createTransactionRepository(d()).list({});
    expect(rows[0]).toMatchObject({ amount: 300000, source: "voice", paid_by_member_id: binh.id });
  });

  it("group: AI features off still opens the prefilled group form", async () => {
    mockApi(false);
    const g = await groupSetup();
    await speakAndUse("Bình trả 300k ăn tối", `/voice?groupId=${g.id}`);
    expect(field("amount-input")).toBe("300000");
    expect(screen.getByTestId("payer-picker")).toBeTruthy();
    expect(parseCalls()).toHaveLength(0);
  });

  it("AC2: unknown payer falls back to Tôi", async () => {
    const g = await groupSetup();
    const me = g.members.find((m) => m.isMe)!;
    await speakAndUse("Nam trả tiền xăng 200k", `/voice?groupId=${g.id}`);
    await fireEvent.press(screen.getByTestId("save-button"));
    const rows = await createTransactionRepository(d()).list({});
    expect(rows[0].paid_by_member_id).toBe(me.id);
  });

  it("AC3: AI failure on a complex sentence shows the banner, keeps the form editable, category Khác", async () => {
    mockApi(true, async () => ({ ok: false, status: 429, json: async () => ({ error: "quota_exceeded" }) }));
    await speakAndUse("hôm qua đi chơi với mấy đứa hết 300k");
    expect(await screen.findByTestId("voice-ai-error")).toBeTruthy();
    expect(field("amount-input")).toBe("300000");
    expect(await screen.findByText(/Khác/)).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("amount-input"), "250000");
    expect(field("amount-input")).toBe("250000");
  });

  it("AC5: AI flag off → no AI call, entry not blocked", async () => {
    mockApi(false);
    await speakAndUse("hôm qua đi chơi với mấy đứa hết 300k");
    expect(parseCalls()).toHaveLength(0);
    expect(field("amount-input")).toBe("300000");
  });

  it("AC4: Nói lại clears the text and restarts recording", async () => {
    heard = "ăn phở 50 nghìn";
    await renderRouter("./app", { initialUrl: "/voice" });
    await fireEvent(await screen.findByTestId("voice-mic"), "pressIn");
    expect(screen.getByTestId("voice-transcript")).toHaveTextContent("“ăn phở 50 nghìn”");
    heard = "";
    await fireEvent.press(screen.getByTestId("voice-retry"));
    expect(recognizer.stop).toHaveBeenCalled();
    expect(recognizer.start).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("voice-transcript")).not.toHaveTextContent("phở");
  });

  it("shows an error when the microphone permission is denied", async () => {
    recognizer.requestPermission.mockResolvedValueOnce(false);
    await renderRouter("./app", { initialUrl: "/voice" });
    await fireEvent(await screen.findByTestId("voice-mic"), "pressIn");
    expect(await screen.findByTestId("voice-error")).toBeTruthy();
    expect(recognizer.start).not.toHaveBeenCalled();
  });

  it("states: permission pending still shows the listening label, recognizer not started yet", async () => {
    recognizer.requestPermission.mockReturnValueOnce(new Promise<boolean>(() => {}));
    await renderRouter("./app", { initialUrl: "/voice" });
    await fireEvent(await screen.findByTestId("voice-mic"), "pressIn");
    expect(screen.getByTestId("voice-listening-label")).toHaveTextContent("Đang nghe…");
    expect(screen.getByTestId("voice-rings")).toBeTruthy();
    expect(recognizer.start).not.toHaveBeenCalled();
  });

  async function speakThenReady(text: string) {
    heard = text;
    await renderRouter("./app", { initialUrl: "/voice" });
    await fireEvent(await screen.findByTestId("voice-mic"), "pressIn");
    await fireEvent(screen.getByTestId("voice-mic"), "pressOut");
    expect(screen.queryByTestId("voice-listening-label")).toBeNull();
    await screen.findByText(/AI tách thông tin/);
  }

  it("states: done is shown before the prefilled form", async () => {
    mockApi(true, async () => ({
      ok: true,
      json: async () => ({ amount: 300000, category: "Khác", note: "đi chơi", currency: "VND", payer: null }),
    }));
    await speakThenReady("hôm qua đi chơi với mấy đứa hết 300k");
    let sawDone = false;
    const poll = setInterval(() => {
      sawDone ||= !!screen.queryByTestId("voice-done");
    }, 10);
    await fireEvent.press(screen.getByTestId("voice-use-result"));
    await screen.findByTestId("transaction-form");
    clearInterval(poll);
    expect(sawDone).toBe(true);
    expect(field("amount-input")).toBe("300000");
  });

  it("states: a throwing parse returns to idle with the transcript and button usable", async () => {
    mockApi(true, () => Promise.reject(new Error("network")));
    heard = "hôm qua đi chơi với mấy đứa hết 300k";
    await renderRouter("./app", { initialUrl: "/voice" });
    await fireEvent(await screen.findByTestId("voice-mic"), "pressIn");
    await fireEvent(screen.getByTestId("voice-mic"), "pressOut");
    await screen.findByText(/AI tách thông tin/);
    await fireEvent.press(screen.getByTestId("voice-use-result"));
    // resolveVoiceEntry handles AI errors itself and falls back, so the screen continues to the form.
    await screen.findByTestId("transaction-form");
    expect(field("amount-input")).toBe("300000");
  });

  it("haptics: light on pressIn and on pressOut", async () => {
    await renderRouter("./app", { initialUrl: "/voice" });
    await fireEvent(await screen.findByTestId("voice-mic"), "pressIn");
    expect(haptics.light).toHaveBeenCalledTimes(1);
    await fireEvent(screen.getByTestId("voice-mic"), "pressOut");
    expect(haptics.light).toHaveBeenCalledTimes(2);
  });

  it("reduce motion: rings are static, states still change", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    await renderRouter("./app", { initialUrl: "/voice" });
    await fireEvent(await screen.findByTestId("voice-mic"), "pressIn");
    expect(screen.getByTestId("voice-listening-label")).toBeTruthy();
    await waitFor(() => {
      const style = JSON.stringify(screen.getByTestId("voice-rings").props.style);
      expect(style).not.toContain("transform");
    });
    await fireEvent(screen.getByTestId("voice-mic"), "pressOut");
    expect(screen.queryByTestId("voice-listening-label")).toBeNull();
  });

  // Keep this test last: the pending parse leaves its act() scope open until the test ends.
  it("states: processing indicator while the parse is pending", async () => {
    mockApi(true, () => new Promise(() => {}));
    await speakThenReady("hôm qua đi chơi với mấy đứa hết 300k");
    void fireEvent.press(screen.getByTestId("voice-use-result"));
    expect(await screen.findByTestId("voice-processing")).toBeTruthy();
  });
});
