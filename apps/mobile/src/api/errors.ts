import { vi } from "@/i18n/vi";

export type ApiErrorCode =
  | "invalid_input"
  | "unauthorized"
  | "ai_disabled"
  | "quota_exceeded"
  | "ai_unavailable"
  | "timeout"
  | "network"
  | "http_error"
  | "not_configured";

const SERVER_CODES: readonly string[] = [
  "invalid_input",
  "unauthorized",
  "ai_disabled",
  "quota_exceeded",
  "ai_unavailable",
];

export class ApiError extends Error {
  readonly status: number | null;
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, status: number | null = null) {
    super(vi.apiErrors[code]);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

function codeFromStatus(status: number): ApiErrorCode {
  switch (status) {
    case 400:
      return "invalid_input";
    case 401:
      return "unauthorized";
    case 403:
      return "ai_disabled";
    case 429:
      return "quota_exceeded";
    case 502:
      return "ai_unavailable";
    default:
      return "http_error";
  }
}

/** Maps an HTTP error response to an ApiError: the body's `error` code wins, else the status. */
export function toApiError(status: number, body: unknown): ApiError {
  const raw = (body as { error?: unknown } | null)?.error;
  if (typeof raw === "string" && SERVER_CODES.includes(raw)) return new ApiError(raw as ApiErrorCode, status);
  return new ApiError(codeFromStatus(status), status);
}
