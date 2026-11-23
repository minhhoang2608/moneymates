export type GoldenFn = (input: Record<string, unknown>) => unknown;

/**
 * Adapters from fixture input to the pure functions in src/lib/**.
 * `undefined` = not implemented yet; the runner lists those cases as todo.
 * Later tickets plug their function in here.
 */
export const registry: Record<string, GoldenFn | undefined> = {
  "money-parse": undefined,
  split: undefined,
  settlement: undefined,
  stats: undefined,
  "vietqr-generate": undefined,
  "vietqr-parse": undefined,
};

export const DOMAINS = Object.keys(registry);
