import { getApiAdapter } from "./adapter";
import type { RequestOptions } from "./constants";

export { DEFAULT_TIMEOUT_MS, MULTIPART_TIMEOUT_MS, type RequestOptions } from "./constants";

export function apiGet<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  return getApiAdapter().get<T>(path, opts);
}

export function apiPost<T>(path: string, body: unknown, opts: RequestOptions = {}): Promise<T> {
  return getApiAdapter().post<T>(path, body, opts);
}

export function apiPostMultipart<T>(path: string, form: FormData, opts: RequestOptions = {}): Promise<T> {
  return getApiAdapter().postMultipart<T>(path, form, opts);
}
