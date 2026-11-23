/** API base URL from build-time env, without trailing slash. Null when unset. */
export function getApiUrl(): string | null {
  const url = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!url) return null;
  return url.replace(/\/+$/, "");
}

/** Shared app secret from build-time env (rate-limit secret, not a key). Null when unset. */
export function getAppSecret(): string | null {
  const secret = process.env.EXPO_PUBLIC_APP_SECRET?.trim();
  return secret ? secret : null;
}
