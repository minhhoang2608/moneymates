import type { BankNotification } from "../types";

/**
 * Best-known notification formats, NOT confirmed on a real device.
 * Needs real-device confirmation (test:real-device) before relying on them.
 * Samples marked `// unverified` are guesses at the wording.
 */
export type Sample = {
  title: string;
  text: string;
  expected: BankNotification | null;
};

export const SAMPLES: Record<string, { packageName: string; samples: Sample[] }> = {
  tpbank: {
    packageName: "com.tpb.mb.gprsandroid",
    samples: [
      {
        title: "TPBank",
        text: "TK …4567 -55,000 VND lúc 12:03 24/11. ND: PHO HOA BAN 12",
        expected: {
          direction: "out",
          amount: 55000,
          accountSuffix: "4567",
          message: "PHO HOA BAN 12",
        },
      },
      {
        title: "TPBank",
        text: "TK …4567 +55,000 VND lúc 12:03 24/11. ND: NGUYEN VAN A CHUYEN TIEN",
        expected: {
          direction: "in",
          amount: 55000,
          accountSuffix: "4567",
          message: "NGUYEN VAN A CHUYEN TIEN",
        },
      },
      {
        title: "TPBank",
        text: "Ma OTP cua ban la 123456. Khong chia se OTP.", // unverified
        expected: null,
      },
    ],
  },
  techcombank: {
    packageName: "vn.com.techcombank.bb.app",
    samples: [
      {
        title: "Techcombank",
        text: "TK x1234 -1.250.000 VND luc 12:03 24/11/2026. ND: TRA TIEN AN", // unverified
        expected: {
          direction: "out",
          amount: 1250000,
          accountSuffix: "1234",
          message: "TRA TIEN AN",
        },
      },
      {
        title: "Techcombank",
        text: "TK x1234 +2.000.000 VND luc 12:03 24/11/2026. ND: LUONG", // unverified
        expected: {
          direction: "in",
          amount: 2000000,
          accountSuffix: "1234",
          message: "LUONG",
        },
      },
      {
        title: "Techcombank",
        text: "Ưu đãi hoàn tiền 10% khi chi tiêu thẻ. Xem ngay!", // unverified
        expected: null,
      },
    ],
  },
  mbbank: {
    packageName: "com.mbmobile",
    samples: [
      {
        title: "MBBank",
        text: "TK 0987654321 GD: -50,000VND 12:03 24/11/2026. ND: CAFE SANG. Số dư: 1,000,000VND", // unverified
        expected: {
          direction: "out",
          amount: 50000,
          accountSuffix: "4321",
          message: "CAFE SANG",
        },
      },
      {
        title: "MBBank",
        text: "TK 0987654321 GD: +300,000VND 12:03 24/11/2026. ND: HOAN TIEN", // unverified
        expected: {
          direction: "in",
          amount: 300000,
          accountSuffix: "4321",
          message: "HOAN TIEN",
        },
      },
      {
        title: "MBBank",
        text: "Quý khách nhận mã xác thực 998877 để đăng nhập.", // unverified
        expected: null,
      },
    ],
  },
  vietcombank: {
    packageName: "com.VCB",
    samples: [
      {
        title: "Vietcombank",
        text: "Số dư TK VCB 0011001234567 -120,000 VND vào 12:03 24/11/2026. ND: THANH TOAN HOA DON", // unverified
        expected: {
          direction: "out",
          amount: 120000,
          accountSuffix: "4567",
          message: "THANH TOAN HOA DON",
        },
      },
      {
        title: "Vietcombank",
        text: "Số dư TK VCB 0011001234567 +5,000,000 VND vào 12:03 24/11/2026. ND: CHUYEN KHOAN", // unverified
        expected: {
          direction: "in",
          amount: 5000000,
          accountSuffix: "4567",
          message: "CHUYEN KHOAN",
        },
      },
      {
        title: "Vietcombank",
        text: "Chương trình khuyến mãi mới dành cho bạn, giảm đến 50%.", // unverified
        expected: null,
      },
    ],
  },
  momo: {
    packageName: "com.mservice.momotransfer",
    samples: [
      {
        title: "MoMo",
        text: "Bạn đã chuyển 55.000đ đến TRAN B. Lời nhắn: tien tra", // unverified
        expected: { direction: "out", amount: 55000, message: "tien tra" },
      },
      {
        title: "MoMo",
        text: "Bạn đã nhận 1.250.000đ từ NGUYEN VAN A. Lời nhắn: tra no", // unverified
        expected: { direction: "in", amount: 1250000, message: "tra no" },
      },
      {
        title: "MoMo",
        text: "Nhận ngay voucher 50.000đ khi mời bạn bè!", // unverified
        expected: null,
      },
    ],
  },
  zalopay: {
    packageName: "vn.com.vng.zalopay",
    samples: [
      {
        title: "ZaloPay",
        text: "Thanh toán thành công 89.000đ cho Highlands Coffee", // unverified
        expected: { direction: "out", amount: 89000 },
      },
      {
        title: "ZaloPay",
        text: "Bạn đã nhận 200.000đ từ LE C. Lời nhắn: chia tien", // unverified
        expected: { direction: "in", amount: 200000, message: "chia tien" },
      },
      {
        title: "ZaloPay",
        text: "Ưu đãi hôm nay: giảm 30.000đ cho đơn đầu tiên", // unverified
        expected: null,
      },
    ],
  },
};
