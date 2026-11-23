import { ApiError } from "@/api/errors";
import type { ApiAdapter } from "@/api/adapter";

type Fixture = unknown | ApiError | (() => unknown);

const fixtures = new Map<string, Fixture>();

/** Later tickets register canned responses for "METHOD path". */
export function registerE2eApiFixture(method: "GET" | "POST", path: string, value: Fixture): void {
  fixtures.set(`${method} ${path}`, value);
}

export function clearE2eApiFixtures(): void {
  fixtures.clear();
}

/** Never touches the network: unknown routes fail like a network error. */
export function createE2eApiAdapter(): ApiAdapter {
  const answer = async <T>(method: string, path: string): Promise<T> => {
    const key = `${method} ${path}`;
    if (!fixtures.has(key)) throw new ApiError("network");
    const value = fixtures.get(key);
    if (value instanceof ApiError) throw value;
    return (typeof value === "function" ? (value as () => unknown)() : value) as T;
  };
  return {
    get: (path) => answer("GET", path),
    post: (path) => answer("POST", path),
    postMultipart: (path) => answer("POST", path),
  };
}
