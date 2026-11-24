import { initialVoiceState, voiceReducer, type VoiceEvent, type VoiceState, type VoiceStatus } from "../voiceState";

const s = (status: VoiceStatus, error: string | null = null): VoiceState => ({ status, error });

describe("voiceReducer", () => {
  const valid: [string, VoiceState, VoiceEvent, VoiceStatus][] = [
    ["idle START", s("idle"), { type: "START" }, "listening"],
    ["listening STOP", s("listening"), { type: "STOP" }, "idle"],
    ["listening RECOGNIZER_END", s("listening"), { type: "RECOGNIZER_END" }, "idle"],
    ["idle PROCESS", s("idle"), { type: "PROCESS" }, "processing"],
    ["processing PARSE_OK", s("processing"), { type: "PARSE_OK" }, "done"],
    ["processing PARSE_FAIL", s("processing"), { type: "PARSE_FAIL" }, "idle"],
    ["done RESET", s("done"), { type: "RESET" }, "idle"],
    ["listening CANCEL", s("listening"), { type: "CANCEL" }, "idle"],
    ["processing CANCEL", s("processing"), { type: "CANCEL" }, "idle"],
    ["done CANCEL", s("done"), { type: "CANCEL" }, "idle"],
  ];
  it.each(valid)("%s", (_n, from, event, to) => {
    expect(voiceReducer(from, event).status).toBe(to);
  });

  it("ERROR goes to idle from any state and keeps the message", () => {
    for (const st of ["idle", "listening", "processing", "done"] as const) {
      expect(voiceReducer(s(st), { type: "ERROR", message: "x" })).toEqual(s("idle", "x"));
    }
  });

  it("START clears a previous error; CANCEL clears it too", () => {
    expect(voiceReducer(s("idle", "x"), { type: "START" })).toEqual(s("listening"));
    expect(voiceReducer(s("idle", "x"), { type: "CANCEL" })).toEqual(s("idle"));
  });

  it("starts idle without an error", () => {
    expect(initialVoiceState).toEqual(s("idle"));
  });

  const invalid: [VoiceStatus, VoiceEvent][] = [
    ["listening", { type: "START" }],
    ["processing", { type: "START" }],
    ["done", { type: "START" }],
    ["idle", { type: "STOP" }],
    ["processing", { type: "RECOGNIZER_END" }],
    ["listening", { type: "PROCESS" }],
    ["done", { type: "PROCESS" }],
    ["idle", { type: "PARSE_OK" }],
    ["listening", { type: "PARSE_FAIL" }],
    ["idle", { type: "RESET" }],
    ["processing", { type: "RESET" }],
    ["idle", { type: "CANCEL" }],
  ];
  it.each(invalid)("%s + %j is a no-op (same reference)", (status, event) => {
    const from = s(status);
    expect(voiceReducer(from, event)).toBe(from);
  });
});
