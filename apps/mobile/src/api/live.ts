import type { ApiAdapter } from "./adapter";
import { getApiUrl, getAppSecret } from "./config";
import { getDeviceId } from "./deviceId";
import { ApiError, toApiError } from "./errors";

import { DEFAULT_TIMEOUT_MS, MULTIPART_TIMEOUT_MS, type RequestOptions } from "./constants";

type Init = { method: "GET" | "POST"; body?: string | FormData; json?: boolean };

async function request<T>(path: string, init: Init, timeoutMs: number): Promise<T> {
  const base = getApiUrl();
  if (!base) throw new ApiError("not_configured");
  const headers: Record<string, string> = { "X-Device-Id": await getDeviceId() };
  const secret = getAppSecret();
  if (secret) headers["X-App-Secret"] = secret;
  if (init.json) headers["Content-Type"] = "application/json";

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
        res = await fetch(`${base}${path}`, {
          method: init.method,
          headers,
          body: init.body,
          signal: controller.signal,
        });
      } catch {
        throw new ApiError("network");
      }
      if (!res.ok) {
        let body: unknown = null;
        try {
          body = await res.json();
        } catch {
          // non-JSON error body: fall back on the status
        }
        throw toApiError(res.status, body);
      }
      try {
        return (await res.json()) as T;
      } catch {
        throw new ApiError("http_error", res.status);
      }
    })();
    run.catch(() => undefined); // avoid unhandled rejection when the timeout wins the race
    return await Promise.race([run, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export const liveAdapter: ApiAdapter = {
  get: <T>(path: string, opts: RequestOptions = {}) =>
    request<T>(path, { method: "GET" }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  post: <T>(path: string, body: unknown, opts: RequestOptions = {}) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body), json: true }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  postMultipart: <T>(path: string, form: FormData, opts: RequestOptions = {}) =>
    request<T>(path, { method: "POST", body: form }, opts.timeoutMs ?? MULTIPART_TIMEOUT_MS),
};
