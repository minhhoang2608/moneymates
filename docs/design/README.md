# MoneyMates – design references

These files are exported from the claude.ai design canvases, so agents can use the real markup and CSS:

- UI mockup (19 screens + 3 state boards + 10 v1.0.1 boards): <https://claude.ai/artifact/PxFxv62jrWscb7hbTVEAUu>
- Logo (direction A "Hai đồng xu", chosen): <https://claude.ai/artifact/2m2qR4FeFweAJzbk9sTkUr>

The design source of truth stays on the canvas. Re-export when it changes.

## How to read the screen files

Each `screens/<Name>.dc.html` is one phone screen (390 × 844 px), written as plain HTML with **inline CSS** inside `<x-dc>…</x-dc>`. You can ignore the `support.js` line and the `<script type="text/x-dc">` block: they are canvas plumbing. Links between files (`href="Stats.dc.html"`) show the navigation. `screens/canvas.json` holds the screen titles and layout.

Agents implement these screens in React Native (`apps/mobile`) and translate the inline CSS to `StyleSheet` / theme tokens. They are visual references, not code to copy. Text in the mockup is sample data. Real data comes from the app. UI strings are Vietnamese, as shown.

| # | Screen (plan) | File |
| --- | --- | --- |
| 01 | Tổng quan | `screens/Main.dc.html` |
| 02 | Quét QR | `screens/Scan.dc.html` |
| 03 | Xác nhận thanh toán | `screens/PayConfirm.dc.html` |
| 04 | Nhập giao dịch | `screens/AddTxn.dc.html` |
| 05 | Voice | `screens/Voice.dc.html` |
| 06 | Chụp bill | `screens/BillScan.dc.html` |
| 07 | Lịch sử | `screens/History.dc.html` |
| 08 | Chi tiết giao dịch | `screens/TxnDetail.dc.html` |
| 09 | Danh sách nhóm | `screens/Groups.dc.html` |
| 10 | Chi tiết nhóm | `screens/GroupDetail.dc.html` |
| 11 | Tạo/sửa nhóm | `screens/GroupEdit.dc.html` |
| 12 | Tổng kết nhóm | `screens/GroupSummary.dc.html` |
| 13 | Popup QR | `screens/QrPopup.dc.html` |
| 14 | Thống kê | `screens/Stats.dc.html` |
| 15 | Hồ sơ | `screens/Profile.dc.html` |
| 16 | Tài khoản nhận tiền | `screens/BankAccounts.dc.html` |
| 17 | Danh mục | `screens/Categories.dc.html` |
| 18 | Cài đặt | `screens/Settings.dc.html` |
| 19 | Chọn nơi ghi | `screens/TargetPicker.dc.html` |
| 03b | Chọn app thanh toán (sheet từ "Đổi ›" ở màn 03) | `screens/PayAppPicker.dc.html` |
| 03c | Sau khi chuyển (banner "Đã lưu · Hoàn tác", "Mở lại <bank>") | `screens/HandoffReturn.dc.html` |
| 05b | Voice – 4 trạng thái mic (chờ, đang nghe, đang xử lý, xong) | `screens/VoiceStates.dc.html` |

Boards 03b, 03c and 05b were added for #209 (pay through any bank app) and #265 (touch feedback and motion). The motion rules (pressed scale 0.97 for 100–150 ms, sheets ≤ 250 ms with backdrop fade, scan-frame sweep and detection flash, haptics, "reduce motion") are a note on the canvas, repeated here:

- Every pressable shows a pressed state (scale 0.97 or opacity, 100–150 ms).
- Bottom sheets and popups slide up with a backdrop fade (≤ 250 ms); toasts and banners slide and fade in and out; stack screens use the native slide.
- History rows animate in and out; the overview and the > 20% alert fade in; loading uses skeletons.
- Scan screen: a sweep line in the frame while looking, a short flash on detection.
- Haptics: light impact on save, pay and hand-off; selection on pickers; error on validation.
- "Reduce motion" makes every change instant but keeps haptics.

Bank picker badges: "Tự điền" (VietQR autofill: MB Bank, VietinBank, BIDV, ACB, OCB) or "Quét ảnh QR" (all other apps). The picker has a search field and lists recent/preferred apps first, then the scanned bank's app, then the rest.

### v1.0.1 boards

| # | Screen | File |
| --- | --- | --- |
| 20 | Onboarding 1 – Hồ sơ (tên + ảnh) | `screens/OnbProfile.dc.html` |
| 21 | Onboarding 2 – App thanh toán | `screens/OnbApps.dc.html` |
| 22 | Onboarding 3 – Quyền | `screens/OnbPermissions.dc.html` |
| 23 | Onboarding 4 – Tài khoản nhận tiền | `screens/OnbReceiveAccount.dc.html` |
| 24 | App thanh toán (ẩn/hiện, sắp xếp) | `screens/PaymentApps.dc.html` |
| 25 | Tự nhận biết chuyển khoản (Android, quyền đọc thông báo) | `screens/NotifAccess.dc.html` |
| 26 | Nhận biên lai – không khớp giao dịch nào (bottom sheet) | `screens/ReceiptSheet.dc.html` |
| 26b | Nhận biên lai – khớp giao dịch đang chờ (toast + Hoàn tác) | `screens/ReceiptMatched.dc.html` |
| 27 | Ảnh QR chuyển khoản (PNG 600 × 900) | `screens/QrImage.dc.html` |

Updated for v1.0.1 (fewest taps):

- `PayConfirm.dc.html` (03): the app is preselected (last app used with that bank, else the scanned bank's app) and shown as one row with "Đổi ›", which opens the sheet 03b. The how-to for non-autofill banks is one line under the pay button. The one-time coach sheet is gone.
- `HandoffReturn.dc.html` (03c): no "Đã thanh toán xong chưa?" question. A payment counts as paid when the user returns after 60 seconds or more, when a bank notification matches (Android, opt-in) or when a receipt matches. The banner offers "Hoàn tác" and "Mở lại <bank>" and hides itself.
- A matching receipt is recorded automatically with a toast (26b); the sheet (26) appears only when nothing matches.
- `Settings.dc.html` (18): the payment app list moved to its own page (24); new rows "Khi app không tự điền" and "Tự nhận biết chuyển khoản".

Onboarding rules:

- Shown once on first launch (`onboarding_completed_at`); re-runnable from Hồ sơ. Every step has "Để sau". E2E mode skips onboarding.
- Step 3: each permission has its own "Tiếp tục" button that opens the system prompt (Apple: no "Cho phép" on a pre-prompt screen). Skipped permissions are asked again when first needed.
- iOS photo permission must be read/write ("Ảnh đã chọn" is enough) so the app can delete its QR images. The "Thông báo ngân hàng" row is Android only.

Temporary QR image rules:

- Only non-autofill apps need an image. Android: banks known to accept a direct share get a cache file, never the gallery; otherwise the image goes to the "MoneyMates" album and is deleted silently when the user returns to the app. iOS: deleted on return with one system prompt for all pending images; the user may choose "Không lưu ảnh" (copy account, amount and message to paste instead).
- Deleted earlier when a bank notification matches (Android, opt-in), or a shared receipt matches. "Mở lại <bank>" regenerates the image. Leftovers are swept after 24 hours.
- The PNG (27): QR ≥ 70% of the width, 4-module white quiet zone, black on white, no tag 59; account name, bank and account number, amount and message sit outside the quiet zone, with the MoneyMates wordmark and "Ảnh tạm của MoneyMates · tự xoá sau khi dùng". The QR in the board is an illustration, not a real payload.

## Logo

- `logo/logo-a-hai-dong-xu.dc.html`: the chosen logo board (icon, wordmark, small sizes).
- `logo/icon.svg`: the app icon alone (1024 × 1024). The `$` uses Inter 800. Convert the text to a path before generating store icons.
- Wordmark: "Money" in `#111827` + "Mates" in `#0E7C66`, Inter 800, letter-spacing −1px.

## Design tokens (measured from the mockup)

Put these in `apps/mobile/src/theme.ts`. Don't introduce other colours without a design change.

### Colour

| Token | Hex | Use |
| --- | --- | --- |
| `primary` | `#0E7C66` | Brand, primary buttons, active tab, income amounts, links |
| `primaryDark` | `#0A5E4D` | Pressed/hover, text on `primarySoft` |
| `primarySoft` | `#E7F4F0` | Selected chips, icon tiles |
| `primarySoft2` | `#D3EEE6` | Badges ("Tự điền"), focus ring |
| `accent` | `#3DD6B0` | Scanner frame, logo coin, highlights on dark |
| `background` | `#F6F7F9` | Screen background |
| `surface` | `#FFFFFF` | Cards, sheets, tab bar |
| `scannerBg` | `#1B1F24` | Camera screens (QR scan, bill) |
| `text` | `#111827` | Primary text |
| `textMuted` | `#5B6472` | Secondary text, inactive tabs |
| `border` | `#E6E8EC` | Card and input borders |
| `divider` | `#EEF0F3` | Row separators |
| `segmentBg` | `#E9ECF0` | Segmented control track (Chi/Thu) |
| `neutral` | `#A5ABB5` | "Khác" category, placeholders |
| `expense` | `#B42318` | Negative amounts, "Chi" |
| `warningBg` / `warningBorder` / `warningText` | `#FEF3E2` / `#F5D9A8` / `#7A4300` | > 20% spending alert banner |

Category chart colours, in order: `#0E7C66`, `#3B82C4`, `#E08A2E`, `#8B6BC8`, then `#A5ABB5` for the rest. Bank and wallet tiles use a light tint with dark text, e.g. TPBank `#F3E8FF`/`#6B2FB3`, Techcombank `#FDE8E8`/`#A3161A`, MB Bank, VietinBank, ACB `#E0ECFF`/`#1D4E9E`, BIDV `#E0F2F1`/`#0F5E57`, OCB `#FFF1E0`/`#8A4B08`, Vietcombank `#E3F4E8`/`#1E6B37`, ZaloPay `#E0F2FE`/`#075985`, VNPay `#FDE8E8`/`#A3161A`, MoMo `#FCE7F3`/`#9D174D`.

### Typography

Inter (400, 500, 600, 700; 800 for the logo). Sizes in px: 11 (tab labels), 12 (captions), 13 (secondary), 14 (body), 15 (row titles, section headers), 16–17 (screen titles, buttons), 22 (page heading), 28–32 (amount hero).

### Shape and layout

- Screen 390 × 844, horizontal padding 20.
- Radius: 10–12 (small tiles, inputs), 14 (buttons, list cards), 16 (cards), 18 (chips, pill height 36), 20 (hero card), 24 (bottom sheet top corners).
- Touch targets ≥ 44 px. The primary button is 52–54 px tall and fills the width in a bottom bar (white, top border `border`).
- Bottom tab bar: 84 px high. 4 tabs (Tổng quan · Lịch sử · Nhóm · Hồ sơ) plus a 60 px raised round QR button in the centre (`primary`, shadow `0 6px 16px rgba(14,124,102,0.35)`).
- Icons: 24 px stroke icons, stroke width 1.8, rounded caps and joins. No emoji.
- Amounts are formatted `vi-VN` with `đ`: `−55.000đ` (expense, `expense` colour) and `+25.000.000đ` (income, `primary`). Compact chart labels look like `3,2tr`.
