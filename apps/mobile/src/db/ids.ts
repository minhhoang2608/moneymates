/** New UUID v4, generated on the device. */
export function newId(): string {
  // Loaded lazily so `drizzle-kit generate` (plain Node) can import the schema without Expo runtime.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { randomUUID } = require("expo-crypto") as typeof import("expo-crypto");
  return randomUUID();
}
