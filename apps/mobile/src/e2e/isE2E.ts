export function isE2E(): boolean {
  return process.env.EXPO_PUBLIC_E2E === "1";
}
