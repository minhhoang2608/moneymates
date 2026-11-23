---
name: money-logic
description: MoneyMates money rules – integer VND, parsing "50k"/"1tr2", group splitting (equal / by amount / by percent) with exact remainders, balances, "Tôi thu hộ" settlement, personal monthly stats including "my share" of group expenses, and the >20% month-over-month alert. Load for any amount, split, settlement or statistics work.
---

# Money logic

## Representation

- Every amount is an **integer number of đồng** (`number` in TS, kept within `Number.MAX_SAFE_INTEGER`; `BigIntegerField` in Django), always with `currency = "VND"`.
- Never use floats for storage or arithmetic. Percentages are **basis points** (integer, 10000 = 100%).
- Display uses `vi-VN` grouping: `1.250.000đ`. Formatting is UI only; never parse a formatted string back.
- Expenses and incomes are positive amounts. `type` (expense/income) carries the sign.

## Parsing user input ("50k", "1tr2")

Accept case-insensitive input, with spaces, after trimming. Return `null` on ambiguity (the UI then asks).

| Input | Value |
| --- | --- |
| `50000`, `50.000`, `50,000` | 50 000 (`.` and `,` as thousands separators when followed by exactly 3 digits) |
| `50k`, `50 k`, `50 nghìn`, `50 ngàn`, `50 nghin` | 50 000 |
| `1k5` | 1 500 |
| `1tr`, `1 triệu`, `1 trieu`, `1 củ` | 1 000 000 |
| `1tr2` | 1 200 000 |
| `1tr25`, `1tr250` | 1 250 000 (digits after `tr` are the fraction of a million, right-padded to 3 digits) |
| `1.5tr`, `1,5tr` | 1 500 000 |
| `2 tỷ` | 2 000 000 000 |

Voice sentences ("ăn phở 50 nghìn", "Nam trả tiền xăng 200k") use the same number parser after the offline rules extract the amount phrase. Write table-driven tests. These cases belong in `tests/golden/money-parse/`.

## Splitting one expense (TransactionSplit)

Participants are the ticked group members, in **stable order**: the member list order, with "Tôi" first. Every split's shares must **sum exactly to the amount**.

- **Equal (default):** `base = floor(amount / n)`, `rem = amount - base*n`. The first `rem` participants get `base + 1`.
  For example, 1 000 000 / 3 → 333 334, 333 333, 333 333.
- **By amount:** the user enters each share. Valid only if the sum equals the amount. Otherwise show the difference ("Còn thiếu 50.000đ" / "Dư 50.000đ") and block saving.
- **By percent:** inputs are basis points that must sum to 10000. `share_i = floor(amount * bp_i / 10000)`. Distribute the leftover đồng one by one to the largest fractional remainders, with ties broken by stable order.
- Store `split_type`, the raw `value` (amount or bp) and the computed integer `amount` per member.

## Balances (Tổng kết)

For each member `m` in a group, ignoring soft-deleted rows:

- `paid(m)` = sum of group expenses where `paid_by_member_id = m`.
- `share(m)` = sum of split amounts for `m`.
- `settled_out(m)` = sum of Settlements with `from = m` and `paid_at` set. `settled_in(m)` is the same with `to = m`.
- `balance(m) = paid(m) - share(m) + settled_out(m) - settled_in(m)`. Positive means m should receive, negative means m should pay.
- **Invariant:** the sum of balances over all members is `0`. Assert it in tests.

## "Tôi thu hộ" settlement

Everyone settles only with **Tôi** (the `is_me` member):

- For every other member `m` with `balance(m) < 0`, the result is "**m trả Tôi |balance|**" and has a payback QR (my receiving account, exact amount, message `"<Nhóm> <Tên>"`).
- For every other member `m` with `balance(m) > 0`, the result is "**Tôi trả m balance**".
- Members with a zero balance don't appear.
- Marking an item "Đã trả" creates or updates a Settlement row with `paid_at` set. The balance moves to 0 by the formula above.
- Tôi's own balance is implicitly `-(sum of the others)` and is not listed as a transfer.

## Personal statistics

- A month's personal expense total = personal expenses (`group_id` null) **+ my share** (`share(Tôi)`) of every group expense in the month of `occurred_at`. That includes expenses someone else paid. Exclude settlements (they're transfers, not spending).
- Example from the docs: I pay 1 000 000 for 4 people → my statistics get 250 000.
- Income totals: personal incomes only.
- **> 20% alert:** compare this month with last month. Alert when `last > 0` and `5 * |this - last| > last` (integer form of > 20%). No alert when `last = 0`.

## Testing

- Pure functions, with no DB or UI dependency. Use table-driven tests plus property tests: sums equal the amount, balances sum to 0, and settlement applied → all zero.
- The canonical cases live in `tests/golden/` (human-owned, read-only for agents). Your implementation must pass them unchanged.
