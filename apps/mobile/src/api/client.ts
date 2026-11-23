import { getApiUrl } from "./config";

export const DEFAULT_TIMEOUT_MS = 5000;

export async function apiGet<T>(
  path: string,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<T> {
  const base = getApiUrl();
  if (!base) throw new Error("EXPO_PUBLIC_API_URL is not set");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("request timed out"));
    }, timeoutMs);
  });
  try {
    const request = (async () => {
      const res = await fetch(`${base}${path}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    })();
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
