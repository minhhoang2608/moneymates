import type { MyShare } from "./monthTotals";

/** Loads my share of group expenses for a "YYYY-MM" month. */
export type MyShareSource = (month: string) => Promise<MyShare[]>;

/** Default until group expenses are wired into the overview. */
export const emptyMyShareSource: MyShareSource = async () => [];
