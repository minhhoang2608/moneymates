import { createE2eApiAdapter } from "@/e2e/apiAdapter";
import { isE2E } from "@/e2e/isE2E";

import { liveGet, livePost, livePostMultipart, type RequestOptions } from "./live";

export interface ApiAdapter {
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body: unknown, options?: RequestOptions): Promise<T>;
  postMultipart<T>(path: string, form: FormData, options?: RequestOptions): Promise<T>;
}

export const liveAdapter: ApiAdapter = { get: liveGet, post: livePost, postMultipart: livePostMultipart };

let override: ApiAdapter | null = null;

export function setApiAdapter(adapter: ApiAdapter | null): void {
  override = adapter;
}

/** The active adapter: an explicit override, the E2E mock in E2E mode, else the live fetch client. */
export function getApiAdapter(): ApiAdapter {
  if (override) return override;
  return isE2E() ? createE2eApiAdapter() : liveAdapter;
}
