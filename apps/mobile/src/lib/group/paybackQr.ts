import type { BankAccountRow } from "@/db/repositories";
import { generateVietQr } from "@/lib/vietqr/generate";
import { buildTransferMessage } from "@/lib/vietqr/message";

export type PaybackQr =
  | { kind: "no_account" }
  | {
      kind: "qr";
      payload: string;
      amount: number | null;
      message: string;
      holder: string;
      bankName: string;
      accountNo: string;
    };

/**
 * VietQR for "Tôi thu hộ" payback. With a member the QR carries amount and the message "<Nhóm> <Tên>";
 * without one (QR chung) it is static: no amount, message is the group name.
 */
export function buildPaybackQr(input: {
  groupName: string;
  account:
    Pick<BankAccountRow, "bank_bin" | "bank_name" | "account_no" | "account_name" | "deleted_at"> | null | undefined;
  memberName?: string;
  amount?: number;
}): PaybackQr {
  const { groupName, account, memberName, amount } = input;
  if (!account || account.deleted_at) return { kind: "no_account" };
  const message = buildTransferMessage(groupName, memberName) ?? "";
  const hasAmount = memberName !== undefined && amount !== undefined;
  const payload = generateVietQr({
    bankBin: account.bank_bin,
    account: account.account_no,
    name: account.account_name,
    amount: hasAmount ? amount : undefined,
    message,
  });
  return {
    kind: "qr",
    payload,
    amount: hasAmount ? amount : null,
    message,
    holder: account.account_name,
    bankName: account.bank_name,
    accountNo: account.account_no,
  };
}
