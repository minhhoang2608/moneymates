export type BankNotification = {
  direction: "out" | "in";
  /** Integer VND, always positive. */
  amount: number;
  accountSuffix?: string;
  message?: string;
};

export type BankRule = {
  packageNames: string[];
  parse(title: string, text: string): BankNotification | null;
};
