import { createE2eApiAdapter } from "@/e2e/apiAdapter";
import { isE2E } from "@/e2e/isE2E";

import type { RequestOptions } from "./constants";
import { liveAdapter } from "./live";

export type ApiAdapter = {
  get<T>(path: string, opts?: RequestOptions): Promise<T>;
  post<T>(path: string, body: unknown, opts?: RequestOptions): Promise<T>;
  postMultipart<T>(path: string, form: FormData, opts?: RequestOptions): Promise<T>;
};

let override: ApiAdapter | null = null;
let e2eAdapter: ApiAdapter | null = null;

/** Replace the active adapter (null restores the default). */
export function setApiAdapter(adapter: ApiAdapter | null): void {
  override = adapter;
}

export function getApiAdapter(): ApiAdapter {
  if (override) return override;
  if (isE2E()) {
    e2eAdapter ??= createE2eApiAdapter();
    return e2eAdapter;
  }
  return liveAdapter;
}
