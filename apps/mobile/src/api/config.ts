/** API base URL from build-time env, without trailing slash. Null when unset. */
export function getApiUrl(): string | null {
  const url = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!url) return null;
  return url.replace(/\/+$/, "");
}
