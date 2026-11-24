export type VoiceStatus = "idle" | "listening" | "processing" | "done";

export type VoiceState = { status: VoiceStatus; error: string | null };

export type VoiceEvent =
  | { type: "START" }
  | { type: "STOP" }
  | { type: "RECOGNIZER_END" }
  | { type: "ERROR"; message: string }
  | { type: "CANCEL" }
  | { type: "PROCESS" }
  | { type: "PARSE_OK" }
  | { type: "PARSE_FAIL" }
  | { type: "RESET" };

export const initialVoiceState: VoiceState = { status: "idle", error: null };

/**
 * State machine of the voice screen. Invalid events return the same state object (no-op).
 * Releasing the mic (STOP / RECOGNIZER_END) goes back to idle with the transcript kept by the screen;
 * PROCESS (the user taps "use result") starts the parsing.
 */
export function voiceReducer(state: VoiceState, event: VoiceEvent): VoiceState {
  switch (event.type) {
    case "START":
      return state.status === "idle" ? { status: "listening", error: null } : state;
    case "STOP":
    case "RECOGNIZER_END":
      return state.status === "listening" ? { status: "idle", error: state.error } : state;
    case "ERROR":
      return { status: "idle", error: event.message };
    case "CANCEL":
      return state.status === "idle" && state.error === null ? state : { status: "idle", error: null };
    case "PROCESS":
      return state.status === "idle" ? { status: "processing", error: null } : state;
    case "PARSE_OK":
      return state.status === "processing" ? { status: "done", error: null } : state;
    case "PARSE_FAIL":
      return state.status === "processing" ? { status: "idle", error: null } : state;
    case "RESET":
      return state.status === "done" ? { status: "idle", error: null } : state;
    default:
      return state;
  }
}
