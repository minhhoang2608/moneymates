import { keywordWalletRule } from "../common";

export const zalopayRule = keywordWalletRule(
  ["vn.com.vng.zalopay"],
  /đã nhận|nhận được/iu,
  /đã chuyển|thanh toán thành công/iu,
);
