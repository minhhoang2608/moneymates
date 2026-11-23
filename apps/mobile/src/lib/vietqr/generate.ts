import { crc16ccitt } from "./crc16";
import { MAX_MESSAGE_LENGTH, toAsciiText } from "./message";
import { encodeTlv, encodeTlvList } from "./tlv";

export type GenerateVietQrInput = {
  bankBin: string;
  account: string;
  name?: string;
  /** Integer VND. Omit for a static QR. */
  amount?: number;
  message?: string;
  /** QRIBFTTA = to account (default), QRIBFTTC = to card. */
  service?: "QRIBFTTA" | "QRIBFTTC";
};

export function generateVietQr(input: GenerateVietQrInput): string {
  const { bankBin, account, name, amount, message, service = "QRIBFTTA" } = input;
  if (!/^\d{6}$/.test(bankBin)) throw new RangeError("bankBin must be 6 digits");
  if (!/^[A-Za-z0-9]{1,19}$/.test(account)) {
    throw new RangeError("account must be 1-19 alphanumeric characters");
  }
  if (amount !== undefined && (!Number.isSafeInteger(amount) || amount <= 0)) {
    throw new RangeError("amount must be a positive integer (VND)");
  }

  const fields: [string, string][] = [
    ["00", "01"],
    ["01", amount !== undefined ? "12" : "11"],
    [
      "38",
      encodeTlvList([
        ["00", "A000000727"],
        [
          "01",
          encodeTlvList([
            ["00", bankBin],
            ["01", account],
          ]),
        ],
        ["02", service],
      ]),
    ],
    ["53", "704"],
  ];
  if (amount !== undefined) fields.push(["54", String(amount)]);
  fields.push(["58", "VN"]);
  const merchant = name ? toAsciiText(name).slice(0, MAX_MESSAGE_LENGTH).trim() : "";
  if (merchant) fields.push(["59", merchant]);
  const text = message ? toAsciiText(message).slice(0, MAX_MESSAGE_LENGTH).trim() : "";
  if (text) fields.push(["62", encodeTlv("08", text)]);

  const body = `${encodeTlvList(fields)}6304`;
  return `${body}${crc16ccitt(body)}`;
}
