import { getApiUrl, getAppSecret } from "./config";
import { getDeviceId } from "./deviceId";
import { ApiError, toApiError } from "./errors";

export const DEFAULT_TIMEOUT_MS = 5000;
export const MULTIPART_TIMEOUT_MS = 30000;

export type RequestOptions = { timeoutMs?: number };

async function request<T>(
  method: "GET" | "POST",
  path: string,
  body: BodyInit | undefined,
  contentType: string | null,
  timeoutMs: number,
): Promise<T> {
  const base = getApiUrl();
  if (!base) throw new ApiError("not_configured");
  const headers: Record<string, string> = { "X-Device-Id": await getDeviceId() };
  const secret = getAppSecret();
  if (secret) headers["X-App-Secret"] = secret;
  if (contentType) headers["Content-Type"] = contentType;

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ApiError("timeout"));
    }, timeoutMs);
  });
  try {
    const run = (async () => {
      let res: Response;
      try {
        res = await fetch(`${base}${path}`, { method, headers, body, signal: controller.signal });
      } catch {
        throw new ApiError("network");
      }
      if (!res.ok) {
        let errBody: unknown = null;
        try {
          errBody = await res.json();
        } catch {
          // non-JSON error body: fall back on the status
        }
        throw toApiError(res.status, errBody);
      }
      try {
        return (await res.json()) as T;
      } catch {
        throw new ApiError("http_error", res.status);
      }
    })();
    run.catch(() => undefined);
    return await Promise.race([run, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export function liveGet<T>(path: string, { timeoutMs = DEFAULT_TIMEOUT_MS }: RequestOptions = {}): Promise<T> {
  return request<T>("GET", path, undefined, null, timeoutMs);
}

export function livePost<T>(
  path: string,
  body: unknown,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: RequestOptions = {},
): Promise<T> {
  return request<T>("POST", path, JSON.stringify(body), "application/json", timeoutMs);
}

/** FormData sets its own multipart boundary, so no Content-Type is sent. */
export function livePostMultipart<T>(
  path: string,
  form: FormData,
  { timeoutMs = MULTIPART_TIMEOUT_MS }: RequestOptions = {},
): Promise<T> {
  return request<T>("POST", path, form, null, timeoutMs);
}
