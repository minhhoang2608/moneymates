---
name: vietqr
description: VietQR (NAPAS, EMVCo merchant-presented QR) parsing and generation – TLV structure, tag 38 bank transfer data, amount/message tags, CRC16-CCITT checksum, validation and test vectors. Load for any QR scan, QR payback or bank account preview work.
---

# VietQR

VietQR is the EMVCo Merchant-Presented Mode (MPM) QR as profiled by NAPAS. MoneyMates parses it on the device (scan flow) and generates it on the device (group payback QR, shared group QR, account preview). No network is involved. Implement it as a small pure TypeScript module with exhaustive unit tests (`apps/mobile/src/lib/vietqr/`).

## TLV format

The payload is a string of `ID (2 digits) + LEN (2 digits, decimal) + VALUE (LEN chars)`, repeated. Some values are themselves TLV (templates).

| ID   | Name                                     | Value                                                         |
| ---- | ---------------------------------------- | ------------------------------------------------------------- |
| `00` | Payload format indicator                 | `01` (must be first)                                          |
| `01` | Point of initiation                      | `11` static (reusable, no amount) · `12` dynamic (has amount) |
| `38` | Merchant account info – NAPAS (template) | see below                                                     |
| `52` | Merchant category code                   | optional, for example `0000`                                  |
| `53` | Transaction currency                     | `704` (VND)                                                   |
| `54` | Transaction amount                       | integer VND as decimal digits, no separators, e.g. `250000`   |
| `58` | Country code                             | `VN`                                                          |
| `59` | Merchant / beneficiary name              | optional                                                      |
| `60` | Merchant city                            | optional                                                      |
| `62` | Additional data (template)               | sub-tag `08` = purpose of transaction (the transfer message)  |
| `63` | CRC                                      | 4 uppercase hex chars, always last                            |

Tag `38` template:

| Sub-ID | Value                                                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------------------------------- |
| `00`   | GUID `A000000727` (NAPAS)                                                                                                 |
| `01`   | Beneficiary organisation (template): `00` = bank BIN (6 digits, e.g. `970422` MB), `01` = account number (or card number) |
| `02`   | Service code: `QRIBFTTA` = transfer to account, `QRIBFTTC` = transfer to card                                             |

## CRC16

- CRC-16/CCITT-FALSE: polynomial `0x1021`, initial value `0xFFFF`, no reflection, final XOR `0x0000`.
- It is computed over the **whole payload up to and including `6304`** (the CRC tag ID and length), then appended as 4 uppercase hex digits.
- Check value: `crc16("123456789") === 0x29B1`.

```ts
export function crc16ccitt(input: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(input)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
```

## Parsing rules

- Read tags sequentially. Reject the payload if a length runs past the end, an ID or length is not numeric, or the CRC is missing or wrong. A wrong CRC is "not a valid VietQR" and goes to the manual path.
- Unknown tags are skipped, not errors. Order beyond `00` first and `63` last is not guaranteed.
- A payload is a **VietQR bank transfer** only if tag `38` exists with GUID `A000000727` and has BIN and account. Anything else (for example VNPay merchant QR, tag `26`–`51` with other GUIDs) is a **non-transfer merchant QR**. Per the docs, that path asks the user for the amount, saves the QR image and opens the app.
- Amount: if `54` is present → `Number.parseInt`, and reject decimals or non-digits for VND. Absent → amount is `null` and the keypad opens.
- `is_dynamic = (tag 01 === "12")`. The docs say: amount prefilled, editable when the code is static.
- Map BIN → bank name with a local table (NAPAS BIN list) in the app. An unknown BIN still parses (show the BIN).
- Output matches the `QrPayload` model: `{ bank_bin, account_no, account_name?, amount?, message?, is_dynamic }`.

## Generation rules

- Order: `00`, `01`, `38`, `53`, `54` (only if there is an amount), `58`, `59`? (optional), `62` (only if there is a message), then `6304` + CRC.
- Point of initiation: `12` when an amount is present, otherwise `11` (shared group QR without an amount).
- Message (`62`→`08`): docs format `"<Nhóm> <Tên>"`. Strip Vietnamese diacritics (`đ→d`) and use only ASCII letters, digits and spaces, max 25 characters (truncate the group name first). Many bank apps reject or garble other characters.
- Length fields count characters of the value. With ASCII-only values, characters equal bytes.
- **Round-trip property:** `parse(generate(x))` deep-equals `x`. Test this with many cases.

## Tests (minimum)

- The CRC check value, plus a few known real-world payloads (static and dynamic, with and without message). These are good candidates for `tests/golden/vietqr/` (human-owned).
- Malformed payloads: truncated, wrong CRC, non-numeric length, missing tag 38 → typed errors, never throws untyped.
- Diacritics stripping and the 25-char message limit.
- Non-VietQR merchant QR → classified as merchant, not as an error.
