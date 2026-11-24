# MoneyMates – Plan chức năng & giao diện

Cập nhật: 22/11/2026 · Hoàng Lê

## Tổng quan & giả định

App ghi thu chi trên iOS và Android, ghi giao dịch nhanh nhất có thể: quét QR rồi chuyển sang app bank/ví, nhập tay, nói, hoặc chụp bill. Có hai chế độ: chi tiêu cá nhân và chi tiêu nhóm theo từng trip.

**Tên app: MoneyMates** — logo hướng A "Hai đồng xu" (có ký tự $), xem [MoneyMates – Logo](https://claude.ai/artifact/2m2qR4FeFweAJzbk9sTkUr#artboard-Main). Tên trên store dự kiến kèm phụ đề, ví dụ "MoneyMates: Thu chi & Chia tiền nhóm"; cần tra trùng tên trên App Store / Google Play trước khi phát hành (đã có vài app tên "MoneyMate").

Tech stack xem ở file `tech-stack.md`. Mockup giao diện: [App thu chi – Mockup](https://claude.ai/artifact/PxFxv62jrWscb7hbTVEAUu).

**Đã chốt**

- Bấm "Thanh toán" ở flow QR là lưu giao dịch ngay, không có trạng thái Pending. Giao dịch lỗi thì user tự vào xóa.
- QR trong nhóm mặc định người chi là chính chủ; nhập tay/voice/ảnh thì chọn được người chi.
- Danh mục có bộ mặc định luôn tồn tại (Ăn uống, Dịch vụ, Lưu trú…) và user được thêm/sửa/xóa danh mục riêng.
- AI (voice, ảnh bill) dùng model free của OpenRouter qua một endpoint Django; key nằm trên server, không nằm trong app.
- Loại khỏi phạm vi: widget, lưu người nhận, tự đọc thông báo bank để xác nhận.

**Chốt thêm ngày 22/11**

- Dữ liệu lưu trên máy, phần lõi chạy offline; chỉ AI cần mạng.
- v1 có cả cá nhân lẫn nhóm, gồm chia tiền và quyết toán.
- Quyết toán kiểu "Tôi thu hộ": mọi người chỉ trả/nhận với Tôi, khoản nào cũng có QR.
- Có ghi khoản thu.
- Thống kê tháng cá nhân cộng cả "phần tôi phải chịu" trong nhóm (trả 1tr cho 4 người thì tính 250k).
- v1 không đăng nhập, không sync, không backup.

## Phạm vi theo phase

v1 gồm toàn bộ luồng ghi chép và nhóm cơ bản; các thứ làm "đẹp" hơn để v2.

| Phase | Nội dung |
| --- | --- |
| v1 – Lõi | Quét QR + mở app bank/ví; nhập tay; danh mục (mặc định + CRUD); chi tiêu cá nhân; lịch sử + lọc; thống kê tháng; cảnh báo lệch >20% so với tháng trước; Hồ sơ + tài khoản nhận tiền của tôi |
| v1 – Nhóm | CRUD nhóm, thành viên theo tên, chọn người chi; chia tiền (đều / theo số tiền / theo tỷ lệ); Tổng kết từng người; QR đòi tiền theo từng thành viên + QR chung cả nhóm |
| v1 – AI | Voice: speech-to-text trên máy → tách số tiền/mô tả/danh mục (rule offline trước, LLM khi cần); ảnh bill → LLM vision đọc tổng tiền, tên quán, ngày |
| v2 – Nhóm nâng cao | Đa tiền tệ; khóa/lưu trữ trip; xuất ảnh tổng kết |
| v2 – Cá nhân nâng cao | Ngân sách theo danh mục; chi định kỳ (tiền nhà, điện, sub) |
| Sau này | Đăng nhập + sync nhiều máy; backup; mời thành viên nhóm bằng tài khoản thật (email/SĐT) |
| Khi phổ biến app – Free / Pro | Đăng nhập không bắt buộc; backup file cho Free; gói Pro gồm AI, lưu server, sync, tạo nhóm chung; thêm Phân tích chi tiêu bằng AI (xem mục 7) |
| v1.0.1 – Thanh toán nhanh & lần đầu | Hướng dẫn lần đầu (4 bước, bỏ qua được); trang ẩn/hiện app thanh toán; thêm ZaloPay, VNPay; ảnh QR có STK, tên, số tiền; ảnh QR tạm tự xoá; bỏ coach sheet và câu hỏi "Đã thanh toán xong chưa?"; nhận biên lai qua nút Chia sẻ + đọc chữ offline; tự nhận biết chuyển khoản qua thông báo ngân hàng (chỉ Android, tuỳ chọn). Xem mục 1, 1b–1d, 6, 6c |
| Đã loại | Widget; lưu người nhận; đọc SMS ngân hàng (Google Play gần như cấm); đọc thông báo ngân hàng trên iOS (hệ điều hành không cho) |

## Chức năng chi tiết

### 1. Quét QR thanh toán

Quét xong là vào màn xác nhận; bấm Thanh toán thì lưu giao dịch rồi mới chuyển app.

```mermaid
flowchart LR
    A[Quét QR<br/>camera hoặc ảnh] --> B{Mã có sẵn<br/>số tiền?}
    B -- có --> C[Màn xác nhận<br/>danh mục, nhóm, app]
    B -- không --> D[Nhập số tiền] --> C
    C --> E[Bấm Thanh toán<br/>lưu giao dịch ngay]
    E --> F{App hỗ trợ<br/>autofill?}
    F -- có --> G[Mở app bank/ví<br/>đã điền STK, số tiền]
    F -- không --> H[Tạo lại ảnh QR, lưu album MoneyMates<br/>copy STK, gửi ảnh hoặc mở app]
    G --> I[Xác nhận chuyển trong app]
    H --> I
    I --> J[Quay lại MoneyMates<br/>coi là đã trả, xoá ảnh QR tạm<br/>banner Hoàn tác]
```

Mục tiêu: nhập số tiền trong MoneyMates → app ngân hàng mở ra → thanh toán, càng ít bước càng tốt. Dùng được với **mọi app ngân hàng/ví có trong VietQR**, không chỉ vài app cố định. App không nhận điền sẵn vẫn đi tiếp được nhờ ảnh QR và clipboard. Không chuyển thì user bấm "Hoàn tác" trên banner hoặc xóa trong Lịch sử.

**Nguyên tắc từ v1.0.1: ít thao tác nhất.** App tự chọn sẵn, không hỏi lại những gì đoán được, cho "Hoàn tác" thay vì hỏi xác nhận. Quét QR có sẵn số tiền với ngân hàng đã dùng: mở Quét → **Thanh toán** → thao tác trong app ngân hàng → quay lại; không có sheet hay câu hỏi nào, kể cả lần đầu.

1. Mở camera từ nút QR giữa thanh điều hướng (có nút chọn ảnh QR từ thư viện).
2. Đọc mã VietQR trên máy: ngân hàng, số tài khoản, tên người nhận (nếu có), số tiền, nội dung.
3. Màn xác nhận:
    - Mã có số tiền → điền sẵn (cho sửa nếu mã tĩnh). Mã không có → bàn phím số bật sẵn.
    - Danh mục được chọn sẵn tự động (xem "Tự chọn danh mục" ở mục 2), đổi được; ghi chú; và dòng "Ghi vào" (mặc định theo quy tắc ở mục 4; trong nhóm người chi = chính chủ).
    - App thanh toán **được chọn sẵn**: app đã dùng lần trước với ngân hàng đó → app của ngân hàng trong mã QR → app đầu tiên trong danh sách đang bật. Hiện thành **một dòng** "<app> · nhãn · Đổi ›" (giống dòng "Ghi vào").
    - "Đổi ›" mở bottom sheet chọn app: chỉ các app **đang bật** (xem mục 6), ngân hàng trong mã QR luôn có mặt; ô tìm kiếm tìm được cả app đang ẩn; có lối vào "Quản lý app thanh toán". Mỗi dòng có nhãn **"Tự điền"** (app nhận điền sẵn) hoặc **"Quét ảnh QR"** (các app khác).
    - Ví điện tử: MoMo, **ZaloPay**, **VNPay** (loại "Quét ảnh QR"). Scheme và package Android của ZaloPay, VNPay lấy từ nguồn chính thức hoặc kiểm tra trên máy thật, không đoán; khai báo trong `<queries>` và `LSApplicationQueriesSchemes`.
    - Danh sách app lấy từ API (`GET /banks/apps`, server gộp danh sách deeplink và ngân hàng của VietQR, cache khoảng 24 giờ, VietQR lỗi thì trả bản tốt gần nhất). App có sẵn một bản danh sách để chạy offline và lần mở đầu. App không gọi VietQR trực tiếp.
4. Bấm **Thanh toán** → lưu giao dịch → mở app đã chọn:
    - App hỗ trợ autofill (hiện có MB Bank, VietinBank iPay, BIDV SmartBanking, ACB ONE, OCB OMNI) → mở link `dl.vietqr.io/pay` để app mở thẳng màn chuyển tiền đã điền STK, số tiền, nội dung. Có một bước chuyển nhanh qua trình duyệt, đó là cơ chế của VietQR.
    - App không hỗ trợ (Techcombank, TPBank, Vietcombank, MoMo…) → không qua trình duyệt:
        - Tạo lại ảnh VietQR với đúng ngân hàng, STK, số tiền và nội dung đã xác nhận (đen trên trắng, viền trắng 4 ô, không có tag tên merchant để app bank đọc được). Từ v1.0.1 ảnh có thêm **tên chủ TK, ngân hàng · STK, số tiền, nội dung** in bên dưới mã, logo MoneyMates và dòng "Ảnh tạm của MoneyMates · tự xoá sau khi dùng"; mã QR chiếm ít nhất 70% chiều ngang, chữ nằm ngoài viền trắng (mockup 27). Copy STK vào clipboard.
        - Ảnh được lưu và xoá theo mục 1b (không phải lúc nào cũng vào thư viện ảnh).
        - Android: gửi thẳng ảnh QR sang app đó (chia sẻ ảnh tới đúng package). App không nhận ảnh thì mở app; mở không được thì thử scheme riêng, cuối cùng là link VietQR.
        - iOS: mở app; ảnh QR đã nằm sẵn trong album.
        - Hướng dẫn nằm **ngay dưới nút Thanh toán** của màn xác nhận: "Trong <bank>: Quét QR → Ảnh → chọn ảnh đầu tiên. Ảnh QR tạm tự xoá khi bạn quay lại." Từ v1.0.1 **bỏ bottom sheet hướng dẫn lần đầu** (thêm một lần chạm không cần thiết).
        - iOS: user có thể chọn "Không lưu ảnh" trong Cài đặt (mục 6): app chỉ copy STK, số tiền, nội dung để dán vào màn chuyển tiền, không có ảnh nào.
    - App chưa cài hoặc không mở được → báo ngắn, thông tin đã nằm trong clipboard.
    - QR merchant không phải VietQR chuyển khoản → bắt nhập số tiền, lưu ảnh QR, mở app.
    - Không tự động thao tác trong app ngân hàng (accessibility, overlay…) và không dùng deeplink riêng không công khai.
5. Quay lại app thì thấy banner "Đã lưu <số tiền> · <nội dung>" có nút **Hoàn tác**, và (nếu có ảnh QR) "Đã xoá ảnh QR tạm · **Mở lại <bank>**" (tạo lại ảnh mới rồi mở app). Banner tự ẩn sau vài giây. Từ v1.0.1 **không hỏi "Đã thanh toán xong chưa?"**: giao dịch coi là đã trả khi một trong các điều sau xảy ra trước:
    - Thông báo ngân hàng khớp (mục 1d, chỉ Android, nếu đã bật).
    - Biên lai được chia sẻ vào và khớp (mục 1c).
    - User quay lại MoneyMates sau **ít nhất 60 giây** kể từ lúc bấm Thanh toán.
    App vẫn nhớ theo từng ngân hàng xem gửi ảnh thẳng có chạy không (dựa vào các tín hiệu trên thay cho câu hỏi), lần sau chọn cách chuyển nhanh nhất đã biết.

### 1b. Ảnh QR tạm: lưu ít nhất, xoá sớm nhất

Ảnh lạ trong thư viện ảnh là điều user khó chịu nhất, nên ảnh QR chỉ được tạo khi thật cần và bị xoá sớm nhất có thể.

- **App tự điền** (link VietQR): không bao giờ tạo ảnh.
- **Android:**
    - Ngân hàng đã biết là nhận ảnh gửi thẳng → chỉ dùng file tạm trong bộ nhớ của app, **không vào thư viện ảnh**.
    - Ngân hàng chưa biết hoặc không nhận ảnh gửi thẳng → lưu vào album "MoneyMates" và **xoá ngay khi user quay lại MoneyMates, không hiện hộp thoại** (Android 10+ cho app xoá ảnh do chính nó tạo). Xoá hẳn, không vào thùng rác.
- **iOS:** lưu vào album "MoneyMates"; xoá khi user quay lại MoneyMates, **một hộp thoại hệ thống cho tất cả ảnh đang chờ** (iOS bắt buộc hỏi, ảnh còn trong "Đã xoá gần đây" 30 ngày). User chọn "Không lưu ảnh" thì không có ảnh và không có hộp thoại.
- Xoá sớm hơn khi thông báo ngân hàng khớp (Android) hoặc biên lai khớp.
- Ghi lại id của ảnh cho mỗi lần chuyển để xoá đúng ảnh. Ảnh còn sót (app bị tắt, user không quay lại) được gom và xoá một lần khi mở app, nếu đã quá 24 giờ.
- Quyền Ảnh trên iOS phải là đọc/ghi (chế độ "Ảnh đã chọn" là đủ, vì ảnh do app tạo tự nằm trong phần được chọn). Nếu user chỉ cho quyền "thêm ảnh" thì tắt tự xoá và báo cho user.
- Popup QR đòi tiền trong nhóm (màn 13) dùng cùng mẫu ảnh có chữ; ảnh đó là để user chủ động tải/chia sẻ nên không tự xoá.

### 1c. Nhận biên lai từ nút "Chia sẻ" của app ngân hàng

Sau khi chuyển, user bấm "Chia sẻ" biên lai trong app ngân hàng và chọn MoneyMates.

- Android: app nhận ảnh được chia sẻ tới. iOS: cần Share Extension. Mở thẳng một bottom sheet / toast nhỏ đè lên màn đang có, **không điều hướng qua Tổng quan**.
- Đọc chữ **offline trên máy** (OCR, không gọi AI, không tốn quota, ảnh không gửi đi): số tiền, người nhận, ngân hàng · STK, nội dung, thời gian, mã giao dịch.
- **Khớp giao dịch đang chờ** (cùng số tiền, cùng STK hoặc người nhận, trong khoảng 30 phút sau khi bấm Thanh toán) → tự đánh dấu đã trả, đính kèm biên lai, xoá ảnh QR tạm; chỉ hiện toast "Đã đính kèm biên lai · <người nhận> đã trả · **Hoàn tác**" (mockup 26b).
- **Không khớp** → bottom sheet (mockup 26) hiện thông tin đọc được, danh mục tự chọn, nút **Ghi giao dịch** / Sửa / Bỏ qua. Giao dịch mới có `source = receipt`, ảnh biên lai được đính kèm.
- OCR đọc sai hoặc không đọc được → mở sheet với các ô trống để nhập tay, ảnh vẫn được đính kèm.

### 1d. Tự nhận biết chuyển khoản qua thông báo ngân hàng (chỉ Android, tuỳ chọn)

- iOS không cho app đọc thông báo của app khác, nên tính năng này chỉ có trên Android.
- User tự bật (onboarding bước Quyền hoặc Cài đặt). Có màn giải thích (mockup 25) trước khi mở trang "Truy cập thông báo" của Android.
- Chỉ đọc thông báo của các app ngân hàng/ví **đang bật** ở trang App thanh toán; thông báo khác bị bỏ qua ngay. Xử lý trên máy, không lưu nội dung thông báo, không gửi đi.
- Khớp khi: thông báo là tiền ra, đúng số tiền, đến trong khoảng 30 phút sau khi bấm Thanh toán; có STK hoặc nội dung thì so thêm. Mỗi ngân hàng một bộ quy tắc đọc, có test bằng mẫu thông báo thật (TPBank, Techcombank, MB, Vietcombank, MoMo, ZaloPay…).
- Khi khớp: đánh dấu đã trả, ghi nhận cách chuyển đã chạy với ngân hàng đó, đánh dấu ảnh QR "chờ xoá" (xoá ngay khi user quay lại app).
- Không đọc SMS (Google Play gần như cấm). Ngân hàng chỉ báo qua SMS thì dùng quy tắc 60 giây hoặc biên lai.

### 2. Nhập chi tiêu/thu

Một màn nhập chung cho ba cách, kết quả AI luôn hiện ra để user sửa trước khi lưu.

- **Nhập tay:** loại (Chi/Thu), số tiền (hỗ trợ gõ "50k", "1tr2"), danh mục, ghi chú, ngày giờ, nguồn tiền (Tiền mặt / bank / ví / thẻ), ảnh đính kèm. Trong nhóm có thêm "Người chi".
- **Voice:** giữ nút mic nói "ăn phở 50 nghìn" → điền sẵn form. Trong nhóm nói "Nam trả tiền xăng 200k" thì tự chọn Nam nếu trùng tên thành viên. Nút mic có 4 trạng thái nhìn khác nhau rõ: chờ → **đang nghe** (vòng sáng nhịp theo âm lượng, chữ "Đang nghe…") → **đang xử lý** (spinner, "Đang xử lý…") → **xong** (dấu tick rồi form điền sẵn). Trạng thái đổi ngay khi chạm, có rung nhẹ khi bắt đầu và khi dừng.
- **Ảnh bill:** chụp hoặc chọn ảnh → AI đọc tổng tiền, tên quán, ngày, tự chọn danh mục → điền form, ảnh bill được đính kèm.
- AI lỗi hoặc hết quota → báo ngắn gọn, để form cho nhập tay, danh mục để "Khác".

**Tự chọn danh mục (quét QR, chụp bill, voice)**

App tự phân tích và chọn sẵn danh mục, user không phải chọn tay; không xác định được thì chọn "Khác".

- **Quét QR:** dựa vào tên người nhận và nội dung chuyển khoản (ví dụ "PHO", "CAFE", "GRAB") bằng bộ từ khóa trên máy; chưa khớp thì hỏi AI.
- **Voice:** rule offline tìm từ khóa trong câu nói; câu phức tạp thì AI.
- **Chụp bill:** AI chọn danh mục cùng lúc đọc tổng tiền, tên quán, món.
- **Không xác định được, AI lỗi hoặc hết quota:** chọn "Khác".
- AI nhận cả danh mục riêng của user, nên chọn được vào danh mục tự tạo.
- Danh mục tự chọn hiện rõ trên màn xác nhận / form, đổi được bằng một chạm.

### 3. Chi tiêu cá nhân

- Trang chủ: tổng chi/thu tháng này, so với tháng trước, banner cảnh báo khi lệch >20%.
- Lịch sử nhóm theo ngày; lọc theo tháng, danh mục, nguồn tiền, Chi/Thu; tìm theo ghi chú.
- Xem / sửa / xóa từng giao dịch (vuốt để xóa, có Hoàn tác).
- Thống kê: cơ cấu theo danh mục, xu hướng 6 tháng.

### 4. Chi tiêu nhóm

- CRUD nhóm: tên, biểu tượng, ngày bắt đầu/kết thúc (tuỳ chọn), tài khoản nhận tiền của nhóm (mặc định là TK chính trong Hồ sơ). Mỗi nhóm có history riêng.
- Thành viên: thêm bằng tên; "Tôi" lấy tên từ Hồ sơ, luôn có sẵn và không xóa được; không xóa thành viên đã có giao dịch (chỉ đổi tên).
- Trang nhóm: tổng chi cả trip, danh sách giao dịch, nút thêm chi tiêu và nút **Tổng kết**.
- Chia tiền cho từng khoản chi: Chia đều (mặc định, bỏ tick người không tham gia), Theo số tiền, Theo tỷ lệ. App báo khi tổng các phần chưa khớp số tiền.
- Màn Tổng kết:
    - Bảng từng người: Đã chi, Phần phải chịu, Chênh lệch (+ được nhận / − phải trả); bấm vào một người để xem các khoản chi tiết.
    - Danh sách quyết toán kiểu Tôi thu hộ: mỗi người chỉ trả hoặc nhận với Tôi, ví dụ "An trả Tôi 250.000đ", "Tôi trả Bình 100.000đ".
    - Khoản trả cho Tôi có nút QR → popup VietQR (TK nhận của tôi + đúng số tiền + nội dung "<Nhóm> <Tên>"), có Tải xuống và Chia sẻ.
    - Nút **QR chung**: VietQR không kèm số tiền, gửi cả nhóm để mọi người tự nhập.
    - Đánh dấu "Đã trả" từng khoản → ghi lại việc thanh toán để chênh lệch về 0.
- QR tạo ngay trên máy theo chuẩn VietQR, không cần mạng.
- Thống kê cá nhân cộng "phần tôi phải chịu" của mỗi khoản nhóm vào tháng phát sinh.
- Chọn nơi ghi khi có nhiều nhóm: một dòng "Ghi vào: <tên> ›", bấm mở danh sách Cá nhân + các nhóm, sắp theo dùng gần nhất, có ô tìm; nhóm đã kết thúc xếp cuối.
    - Mặc định = nơi ghi gần nhất (cá nhân hoặc nhóm).
    - Quay về Cá nhân nếu nhóm đó đã qua ngày kết thúc hoặc hơn 24 giờ chưa ghi gì.
    - Thêm chi tiêu từ trong trang nhóm thì luôn chọn sẵn nhóm đó.

### 5. Danh mục

- Mặc định (không xóa được, đổi được icon/màu): Ăn uống, Di chuyển, Lưu trú, Mua sắm, Dịch vụ, Hóa đơn, Giải trí, Sức khỏe, Khác. Thu: Lương, Được trả lại, Khác.
- Danh mục riêng: thêm/sửa/xóa; xóa thì chuyển các giao dịch cũ sang "Khác".
- Dùng chung cho cá nhân và nhóm.

### 6. Hồ sơ & cài đặt

- Hồ sơ: tên hiển thị (dùng làm "Tôi" trong nhóm), ảnh đại diện.
- Tài khoản nhận tiền của tôi: thêm/sửa/xóa nhiều TK (ngân hàng, STK, tên chủ TK), chọn một TK mặc định, xem trước QR. Dùng để tạo QR đòi tiền trong nhóm.
- Cài đặt: dòng **"App thanh toán · N đang bật ›"** mở trang riêng (mockup 24); nguồn tiền, đơn vị tiền mặc định (VND). Nếu user có tài khoản ở ngân hàng hỗ trợ tự điền thì gợi ý đặt app đó làm mặc định (Đặt mặc định / Bỏ qua).
- Trang **App thanh toán**: liệt kê mọi app trong danh sách VietQR cộng thêm các ví (MoMo, ZaloPay, VNPay), chia nhóm *Ngân hàng* / *Ví điện tử*, có ô tìm kiếm. Mỗi app có công tắc bật/tắt và nhãn Tự điền / Quét ảnh QR; các app đang bật nằm trên cùng, kéo để sắp xếp. Chỉ app đang bật mới hiện khi thanh toán (ngoại lệ: ngân hàng trong mã QR, và ô tìm kiếm). Mặc định khi chưa chọn: các app đã cài trên máy (nếu phát hiện được), nếu không thì danh sách hiện tại.
- **Khi app không tự điền** (chủ yếu cho iOS): "Ảnh QR, tự xoá" (mặc định) hoặc "Không lưu ảnh" (copy STK, số tiền, nội dung để dán).
- **Tự nhận biết chuyển khoản** (chỉ Android): công tắc, mở màn giải thích rồi trang cấp quyền của hệ thống (mục 1d).
- Khóa app bằng Face ID / vân tay (tuỳ chọn).

### 6b. Cảm giác chạm & chuyển động

App phải phản hồi mọi thao tác, không đứng im. Dùng đúng màu và token của design, không thêm branding mới.

- Mọi nút, dòng danh sách, chip, tab, dòng chọn ngân hàng: khi nhấn thu nhỏ khoảng 0.97 hoặc mờ đi, 100–150 ms.
- Bottom sheet (Ghi vào, chọn app thanh toán, danh mục, Popup QR, biên lai) trượt lên kèm nền tối mờ dần; toast và banner trượt/mờ vào ra; màn stack dùng hiệu ứng trượt gốc của hệ điều hành.
- Lịch sử: dòng mới hoặc vừa xóa có animation. Tổng quan và cảnh báo >20% hiện dần khi có dữ liệu; lúc đang tải dùng skeleton thay vì màn trống.
- Quét QR: khung quét có vệt quét chạy, nháy sáng ngắn khi nhận được mã.
- Rung: nhẹ khi lưu giao dịch, thanh toán, chuyển app; rung chọn khi dùng picker; rung lỗi khi nhập sai. Gom vào một chỗ để tắt được.
- Animation ngắn (≤ 250 ms), không chặn thao tác. Bật "Giảm chuyển động" của hệ thống thì đổi trạng thái tức thì, vẫn giữ rung.

### 6c. Hướng dẫn lần đầu (onboarding, v1.0.1)

Hiện một lần khi mở app lần đầu, giúp user biết các phần cài đặt nằm ở đâu. 4 bước, có thanh tiến độ, **bước nào cũng có "Để sau"**; làm lại được từ Hồ sơ.

1. **Hồ sơ:** tên hiển thị và ảnh đại diện trên cùng một màn (ảnh tuỳ chọn).
2. **App thanh toán:** chọn app đang dùng, chia nhóm "Tự điền sẵn" và "Quét ảnh QR", có ô tìm kiếm; dùng chung component với trang App thanh toán. Chọn sẵn các app đã cài nếu phát hiện được.
3. **Quyền:** Camera (quét QR, chụp bill), Ảnh (lưu ảnh QR tạm và xoá), Micro & giọng nói (nhập bằng giọng nói), Thông báo ngân hàng (chỉ Android, tuỳ chọn). Mỗi quyền có một dòng giải thích và nút **"Tiếp tục"** riêng; bấm mới hiện hộp thoại hệ thống (Apple không cho dùng nút "Cho phép" ở màn giải thích). Quyền bị bỏ qua được hỏi lại đúng lúc cần dùng; quyền đã bị từ chối thì hiện nút mở Cài đặt của máy. Face ID không có ở đây (chỉ cần khi bật khoá app).
4. **Tài khoản nhận tiền:** ngân hàng, STK, tên chủ TK (in hoa, không dấu); dùng lại form của màn 16.

- Lưu `onboarding_completed_at` khi xong hoặc khi bấm "Để sau" ở bất kỳ bước nào cho tới hết.
- Chế độ E2E bỏ qua onboarding để các flow Maestro hiện có không đổi; onboarding có flow Maestro riêng.

### 7. Free / Pro (khi phổ biến app)

**v1 không chia gói, không giới hạn:** mọi tính năng trong phạm vi v1 đều bật đầy đủ vì đang dùng cá nhân. Phần dưới chỉ áp dụng khi phổ biến app.

Free dùng đầy đủ chức năng và lưu trên máy. Pro là mọi thứ tốn tài nguyên server: AI, lưu dữ liệu trên server, đồng bộ, nhóm chung. Giai đoạn dùng cá nhân thì AI vẫn bật cho chủ app; code có sẵn cờ tính năng theo gói để sau này khóa lại.

| Tính năng | Free | Pro |
| --- | --- | --- |
| Quét QR, nhập tay, chia tiền, QR đòi tiền, thống kê | Có | Có |
| Tạo / sửa / xóa nhóm trên máy, thêm thành viên bằng tên | Có | Có |
| Voice – câu đơn giản (rule offline trên máy, ví dụ "phở 50k") | Có | Có |
| Nhận biên lai qua Chia sẻ, đọc chữ offline; tự nhận biết chuyển khoản qua thông báo (Android) | Có | Có |
| Xuất / nhập file backup thủ công (JSON, tự lưu Drive/iCloud) | Có | Có |
| Đăng nhập tài khoản (email OTP) | Có, không bắt buộc | Có |
| Tham gia nhóm chung khi được mời: xem và thêm chi tiêu trong nhóm đó | Có (cần đăng nhập) | Có |
| Tạo nhóm chung, mời thành viên qua email / SĐT | Không | Có |
| Lưu dữ liệu cá nhân trên server, đồng bộ nhiều máy | Không | Có |
| Voice – tách bằng AI (câu phức tạp, nhận tên người chi) | Không | Có |
| Đọc ảnh bill bằng AI | Không | Có |
| Phân tích chi tiêu bằng AI (nhận xét thói quen chi, gợi ý tiết kiệm, hỏi đáp về chi tiêu) | Không | Có |

- **Đăng nhập không bắt buộc:** app dùng được ngay không cần tài khoản; chỉ hỏi đăng nhập khi user muốn vào nhóm chung hoặc lên Pro. Bắt đăng nhập ngay lần mở đầu làm nhiều người bỏ app, nhất là app tài chính.
- **Đếm người dùng:** dùng analytics ẩn danh (lượt cài, người dùng hoạt động) để đếm cả người chưa đăng nhập; số tài khoản đăng nhập là số liệu riêng.
- **Free đã đăng nhập** vẫn chỉ lưu dữ liệu cá nhân trên máy; server chỉ giữ tài khoản và phần dữ liệu của nhóm chung họ tham gia.
- **Nhóm trên máy vs nhóm chung:** Free tạo nhóm và thành viên ghi tên như bình thường, dữ liệu chỉ nằm trên máy. Pro chuyển được một nhóm thành nhóm chung (đẩy lên server) rồi mời thành viên qua email/SĐT, ghép vào thành viên đã có theo tên.
- **Giới hạn để kiểm soát tài nguyên:** đặt giới hạn số nhóm chung đang hoạt động và số thành viên mỗi nhóm cho gói Pro (con số chốt khi ra Pro, theo dõi bằng số liệu thực tế).
- **Hết hạn Pro:** dữ liệu cá nhân giữ lại trên máy để dùng tiếp bản Free; nhóm chung do mình tạo chuyển sang chỉ xem, gia hạn là mở lại.
- User Free bấm vào tính năng Pro thì hiện màn giới thiệu gói Pro, không báo lỗi.
- Chi tiết giá, chu kỳ thanh toán, dùng thử: chốt khi chuẩn bị phổ biến app.

## Màn hình & điều hướng

Thanh điều hướng dưới có 4 tab + nút QR nổi ở giữa: **Tổng quan · Lịch sử · [QR] · Nhóm · Hồ sơ**. Cài đặt nằm trong tab Hồ sơ để thanh dưới gọn. Giữ nút QR (hoặc nút "+" trên Tổng quan) mở menu: Nhập tay / Voice / Chụp bill.

| # | Màn hình | Nội dung chính | Vào từ |
| --- | --- | --- | --- |
| 1 | Tổng quan | Tổng chi/thu tháng, so tháng trước, cảnh báo >20%, top danh mục, 5 giao dịch gần nhất | Tab |
| 2 | Quét QR | Camera, chọn ảnh từ thư viện, đèn flash | Nút QR giữa |
| 3 | Xác nhận thanh toán | Người nhận, số tiền, danh mục, dòng Ghi vào (mở màn Chọn nơi ghi) + chia cho ai, dòng app thanh toán chọn sẵn "<app> · Đổi ›", nút Thanh toán, hướng dẫn một dòng cho app không tự điền | Sau khi quét |
| 3b | Chọn app thanh toán | Bottom sheet: ô tìm (cả app đang ẩn), các app đang bật với nhãn Tự điền / Quét ảnh QR, "Quản lý app thanh toán" | "Đổi ›" ở màn 3 |
| 3c | Sau khi chuyển | Banner trên màn hiện tại: Đã lưu + Hoàn tác, "Đã xoá ảnh QR tạm" + Mở lại <bank>; tự ẩn | Quay lại từ app bank |
| 4 | Nhập giao dịch | Form chung cho tay/voice/bill; Chi/Thu; người chi + cách chia khi ở nhóm | Menu "+" |
| 5 | Voice | Sóng âm, chữ nhận dạng trực tiếp, nút mic 4 trạng thái (chờ / đang nghe / đang xử lý / xong), nút xong | Menu "+" |
| 6 | Chụp bill | Camera, xử lý AI, chuyển sang form | Menu "+" |
| 7 | Lịch sử | Danh sách theo ngày, bộ lọc, tìm kiếm, vuốt xóa | Tab |
| 8 | Chi tiết giao dịch | Thông tin đầy đủ, ảnh bill/QR, phần chia từng người, sửa, xóa | Lịch sử, Tổng quan, Nhóm |
| 9 | Danh sách nhóm | Các trip đang có, tổng chi mỗi nhóm, tạo nhóm | Tab |
| 10 | Chi tiết nhóm | Tổng trip, giao dịch, nút thêm chi tiêu, nút Tổng kết | Danh sách nhóm |
| 11 | Tạo/sửa nhóm | Tên, icon, ngày, thành viên, TK nhận tiền của nhóm | Danh sách / Chi tiết nhóm |
| 12 | Tổng kết nhóm | Bảng Đã chi / Phần phải chịu / Chênh lệch từng người, danh sách chuyển tiền, Đã trả, nút QR chung | Chi tiết nhóm |
| 13 | Popup QR | Ảnh VietQR (theo thành viên có số tiền, hoặc chung không số tiền), Tải xuống, Chia sẻ | Tổng kết nhóm |
| 14 | Thống kê | Cơ cấu danh mục, xu hướng 6 tháng | Tổng quan |
| 15 | Hồ sơ | Tên, ảnh, lối vào Tài khoản nhận tiền, Danh mục, Cài đặt | Tab |
| 16 | Tài khoản nhận tiền | Danh sách TK của tôi, thêm/sửa/xóa, TK mặc định, xem trước QR | Hồ sơ |
| 17 | Danh mục | Danh sách mặc định + riêng, thêm/sửa/xóa | Hồ sơ |
| 18 | Cài đặt | Lối vào App thanh toán, gợi ý app tự điền làm mặc định, Khi app không tự điền, Tự nhận biết chuyển khoản (Android), nguồn tiền, khóa app | Hồ sơ |
| 19 | Chọn nơi ghi | Bottom sheet: ô tìm, Cá nhân, các nhóm theo dùng gần nhất, nhóm đã kết thúc ở cuối | Dòng "Ghi vào" ở màn 3 và 4 |
| 20–23 | Hướng dẫn lần đầu | 4 bước: Hồ sơ, App thanh toán, Quyền, Tài khoản nhận tiền; bước nào cũng có "Để sau" | Lần mở app đầu tiên, Hồ sơ |
| 24 | App thanh toán | Ô tìm, app đang bật (kéo sắp xếp), Ngân hàng, Ví điện tử; công tắc từng app | Cài đặt, màn 3b, onboarding |
| 25 | Tự nhận biết chuyển khoản | Màn giải thích quyền đọc thông báo (chỉ Android), Tiếp tục / Để sau | Cài đặt, onboarding |
| 26 | Nhận biên lai – không khớp | Bottom sheet: thông tin đọc được, danh mục tự chọn, Ghi giao dịch / Sửa / Bỏ qua | Chia sẻ ảnh từ app ngân hàng |
| 26b | Nhận biên lai – khớp | Toast "Đã đính kèm biên lai · đã trả" + Hoàn tác | Chia sẻ ảnh từ app ngân hàng |
| 27 | Ảnh QR chuyển khoản | Ảnh PNG: logo, mã QR, tên chủ TK, ngân hàng · STK, số tiền, nội dung, "Ảnh tạm… tự xoá" | Tạo khi chuyển qua app không tự điền |

## Mô hình dữ liệu sơ bộ

Một bảng Transaction chung cho cá nhân và nhóm; `group_id` rỗng nghĩa là giao dịch cá nhân. Mọi bảng thêm các trường phục vụ sync (xem `tech-stack.md`).

| Bảng | Trường chính |
| --- | --- |
| Transaction | id, type (expense/income), amount, currency, category_id, note, occurred_at, source (manual/voice/bill/qr/receipt), payment_method_id, group_id?, paid_by_member_id?, attachment_uri?, qr_payload?, created_at, updated_at |
| TransactionSplit | id, transaction_id, member_id, split_type (equal/amount/percent), value, amount |
| Settlement | id, group_id, from_member_id, to_member_id, amount, paid_at? |
| Category | id, name, icon, color, type (expense/income), is_default |
| Group | id, name, icon, start_date?, end_date?, receive_account_id?, created_at |
| GroupMember | id, group_id, name, is_me |
| Profile | display_name, avatar_uri?, onboarding_completed_at? |
| BankAccount (TK nhận tiền của tôi) | id, bank_bin, bank_name, account_no, account_name, is_default |
| PaymentMethod | id, name, kind (cash/bank/wallet/card), app_id? (để mở deeplink), sort_order |
| QrPayload (nhúng trong Transaction) | bank_bin, account_no, account_name?, amount?, message?, is_dynamic |

v1.0.1 thêm:

| Bảng | Trường chính |
| --- | --- |
| PaymentAppPref | id, app_id, enabled, sort_order (thay cho danh sách app yêu thích hiện tại) |
| HandOff (mỗi lần bấm Thanh toán) | id, transaction_id, app_id, method (autofill/share/gallery/paste), qr_asset_id? (id ảnh trong thư viện), started_at, returned_at?, paid_signal? (time/notification/receipt), qr_deleted_at? |
| Cài đặt (key-value) | non_autofill_mode (qr_image/paste), notification_match_enabled |

v2 thêm: Budget (category_id, month, limit), RecurringRule.

## Lưu ý kỹ thuật & rủi ro

Rủi ro lớn nhất là không phải app bank nào cũng nhận điền sẵn thông tin, nên flow QR phải có đường dự phòng.

| Rủi ro | Ảnh hưởng | Cách xử lý |
| --- | --- | --- |
| Chỉ một phần app hỗ trợ autofill qua deeplink (danh sách VietQR `api.vietqr.io/v2/{android,ios}-app-deeplinks`, cờ `autofill`; hiện chỉ MB, VietinBank, BIDV, ACB, OCB) | Các bank khác chỉ mở được app | Tạo lại ảnh QR dễ đọc, lưu album MoneyMates, gửi thẳng ảnh (Android), hướng dẫn một dòng dưới nút Thanh toán, nhớ cách đã chạy theo từng bank; test thực tế với TPBank, Techcombank, Vietcombank, MBBank, MoMo |
| Android 11+ ẩn package app khác | Không mở được app bank | Khai báo package và scheme của các app bank trong `<queries>`; thử lần lượt: mở package → scheme riêng → link VietQR |
| Thêm chữ vào ảnh QR làm app bank khó nhận mã (như lỗi #262) | Không quét được từ ảnh | QR ≥ 70% chiều ngang, viền trắng 4 ô, chữ ngoài viền; kiểm tra lại TPBank, Techcombank, MoMo, ZaloPay trên máy thật |
| iOS luôn hỏi khi xoá ảnh, ảnh còn trong "Đã xoá gần đây" 30 ngày | User thấy hộp thoại | Gom mọi ảnh chờ xoá vào một lần hỏi khi quay lại app; tuỳ chọn "Không lưu ảnh" |
| Quyền đọc thông báo bị Google Play kiểm duyệt kỹ | Bị từ chối khi phát hành | Tính năng tuỳ chọn, màn giải thích rõ, khai báo đầy đủ trong phần dữ liệu của Play; chỉ đọc app ngân hàng đang bật, xử lý trên máy |
| Mỗi ngân hàng viết thông báo, biên lai một kiểu | Khớp sai hoặc không khớp | Bộ quy tắc theo từng ngân hàng, test bằng mẫu thật; luôn có Hoàn tác; không khớp thì dùng quy tắc 60 giây |
| iOS cần Share Extension để nhận biên lai | Thêm phần native, cấu hình App Group | Dùng thư viện hỗ trợ Expo dev build; kiểm tra trên máy thật |
| QR merchant (VNPay…) không phải VietQR chuyển khoản | Không đọc được STK/số tiền | Nhập số tiền tay, lưu ảnh QR để app bank quét từ thư viện |
| [OpenRouter free](https://openrouter.zendesk.com/hc/en-us/articles/39501163636379): 20 req/phút, 50 req/ngày (1.000/ngày sau khi nạp $10) | Hết quota là AI ngừng | Rule offline cho voice đơn giản; chỉ gọi LLM khi cần; khai báo 2–3 model free dự phòng |
| Model free bị rate limit giờ cao điểm hoặc bị gỡ | AI chậm/lỗi | Fallback model, timeout, luôn cho nhập tay |
| API key OpenRouter | Lộ key nếu để trong app | Key nằm trong env của Django trên Hawk Host; app gọi qua endpoint, có giới hạn request theo thiết bị |
| Dữ liệu chỉ trên máy | Mất máy là mất dữ liệu | Chấp nhận ở v1; backup/sync để sau |
| Ảnh bill có thông tin cá nhân gửi lên AI | Quyền riêng tư | Thông báo rõ khi dùng lần đầu; có thể cắt ảnh trước khi gửi |

## Bước tiếp theo

1. ~~Làm mockup giao diện~~ — đã xong (19 màn, thêm 3b, 3c và trạng thái mic voice ngày 24/11/2026; thêm các màn v1.0.1 20–27 ngày 24/11/2026).
2. ~~Chọn stack~~ — đã chốt, xem `tech-stack.md`.
3. Test deeplink thực tế với TPBank, Techcombank, Vietcombank, MBBank, MoMo.
4. Dựng khung dự án theo `tech-stack.md`.
5. v1.0.1: làm theo mục 1, 1b–1d, 6, 6c; kiểm tra trên máy thật ảnh QR mới, xoá ảnh, nhận biên lai và đọc thông báo với TPBank, Techcombank, Vietcombank, MB, MoMo, ZaloPay, VNPay.
