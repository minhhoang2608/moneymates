import { getApiAdapter } from "./adapter";
import type { RequestOptions } from "./live";

export { DEFAULT_TIMEOUT_MS, MULTIPART_TIMEOUT_MS, type RequestOptions } from "./live";

export function apiGet<T>(path: string, options?: RequestOptions): Promise<T> {
  return getApiAdapter().get<T>(path, options);
}

export function apiPost<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
  return getApiAdapter().post<T>(path, body, options);
}

export function apiPostMultipart<T>(path: string, form: FormData, options?: RequestOptions): Promise<T> {
  return getApiAdapter().postMultipart<T>(path, form, options);
}
