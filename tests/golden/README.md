# Golden tests (human-owned, read-only for agents)

Canonical cases for MoneyMates' money and QR logic. Each file is `{ "name", "input", "expected" }`. `apps/mobile` must provide `npm run test:golden`, which loads every JSON file here and calls the matching pure function. Agents may not change these files. If a case looks wrong, a human decides.

Amounts are integer VND. Member names are in stable order with "Tôi" first.

| Folder | Function under test | `input` | `expected` |
| --- | --- | --- | --- |
| `money-parse/` | parse a typed or spoken amount | `{text}` | `{amount}` (`null` = not understood / ambiguous) |
| `split/` | split one expense | `{amount, currency, mode: "equal"\|"amount"\|"percent", participants: [name], values?: {name: VND or basis points}}` | `{shares: {name: VND}}` or `{error: "sum_mismatch", difference}` / `{error: "percent_not_100", difference_bp}` |
| `settlement/` | group balances + "Tôi thu hộ" transfers | `{members: [{name, is_me?}], expenses: [{paid_by, amount, splits: {name: VND}}], settlements?: [{from, to, amount, paid}]}` | `{balances: {name: VND}, transfers: [{from, to, amount}]}` (order: member order) |
| `stats/` | `kind: "alert"`: > 20% month-over-month alert; `kind: "monthly_total"`: personal totals incl. my share of group expenses, excluding settlements | see files | `{alert}` / `{expense_total, income_total}` |
| `vietqr-generate/` | build a VietQR payload | `{bank_bin, account_no, amount?, group_name?, member_name?}` | `{message, payload}`. `message` is the ASCII "<Nhóm> <Tên>" ≤ 25 chars |
| `vietqr-parse/` | parse a scanned payload | `{payload}` | `{kind: "vietqr_transfer", bank_bin, account_no, account_name, amount, message, is_dynamic}`, `{kind: "merchant", amount: null}`, or `{error: "crc_mismatch" \| "malformed"}` |

## Adding real bank QR codes (recommended)

In your bank app, open "QR nhận tiền" and read the code with any QR reader app to get the text that starts with `000201…`. Add a file `vietqr-parse/real-<bank>.json` with that payload and the bank BIN, account number and amount you expect. Real codes catch differences that the generated ones cannot. Use an account you're comfortable keeping in this private repository.
