import type { ApiAdapter } from "@/api/adapter";
import { ApiError } from "@/api/errors";

type Fixture = unknown | ApiError;

const fixtures = new Map<string, Fixture>();

/** Registers the mock response for `"METHOD path"`, e.g. `"POST /ai/parse-text"`. */
export function registerE2eApiFixture(route: string, value: Fixture): void {
  fixtures.set(route, value);
}

export function clearE2eApiFixtures(): void {
  fixtures.clear();
}

function respond<T>(route: string): Promise<T> {
  if (!fixtures.has(route)) return Promise.reject(new ApiError("network"));
  const value = fixtures.get(route);
  return value instanceof ApiError ? Promise.reject(value) : Promise.resolve(value as T);
}

/** E2E adapter: never touches fetch; unknown routes fail like an offline network. */
export function createE2eApiAdapter(): ApiAdapter {
  return {
    get: (path) => respond(`GET ${path}`),
    post: (path) => respond(`POST ${path}`),
    postMultipart: (path) => respond(`POST ${path}`),
  };
}
