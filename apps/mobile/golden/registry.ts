import { parseAmount } from "../src/lib/money";
import { buildTransferMessage, generateVietQr } from "../src/lib/vietqr";

export type GoldenFn = (input: Record<string, unknown>) => unknown;

/**
 * Adapters from fixture input to the pure functions in src/lib/**.
 * `undefined` = not implemented yet; the runner lists those cases as todo.
 * Later tickets plug their function in here.
 */
export const registry: Record<string, GoldenFn | undefined> = {
  "money-parse": ({ text }) => {
    const r = parseAmount(String(text));
    return { amount: r.ok ? r.vnd : null };
  },
  split: undefined,
  settlement: undefined,
  stats: undefined,
  "vietqr-generate": (i) => {
    const message = buildTransferMessage(i.group_name as string | undefined, i.member_name as string | undefined);
    return {
      message,
      payload: generateVietQr({
        bankBin: String(i.bank_bin),
        account: String(i.account_no),
        amount: i.amount as number | undefined,
        message: message ?? undefined,
      }),
    };
  },
  "vietqr-parse": undefined,
};

export const DOMAINS = Object.keys(registry);
