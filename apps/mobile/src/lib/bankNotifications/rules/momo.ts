import { keywordWalletRule } from "../common";

export const momoRule = keywordWalletRule(
  ["com.mservice.momotransfer"],
  /đã nhận|nhận được/iu,
  /đã chuyển|thanh toán thành công/iu,
);
