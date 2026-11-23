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

const SERVER_CODES: ApiErrorCode[] = [
  "invalid_input",
  "unauthorized",
  "ai_disabled",
  "quota_exceeded",
  "ai_unavailable",
];

const STATUS_CODES: Record<number, ApiErrorCode> = {
  400: "invalid_input",
  401: "unauthorized",
  403: "ai_disabled",
  429: "quota_exceeded",
  502: "ai_unavailable",
};

/** Maps an HTTP error response (status + parsed body) to an ApiError. */
export function toApiError(status: number, body: unknown): ApiError {
  const raw = (body as { error?: unknown } | null)?.error;
  const fromBody = SERVER_CODES.find((c) => c === raw);
  return new ApiError(fromBody ?? STATUS_CODES[status] ?? "http_error", status);
}
