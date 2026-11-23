export type DefaultExpenseName =
  "Ăn uống" | "Di chuyển" | "Lưu trú" | "Mua sắm" | "Dịch vụ" | "Hóa đơn" | "Giải trí" | "Sức khỏe";

export type CategoryKeywords = {
  category: DefaultExpenseName;
  keywords: readonly string[];
};

/**
 * Keyword list used to suggest a category from a recipient name or transfer message.
 * Plain uppercase ASCII (matching ignores case and diacritics). Edit this file to tune coverage.
 */
export const CATEGORY_KEYWORDS: readonly CategoryKeywords[] = [
  {
    category: "Ăn uống",
    keywords: [
      "PHO",
      "BUN",
      "COM",
      "CAFE",
      "COFFEE",
      "CA PHE",
      "TRA SUA",
      "HIGHLANDS",
      "PHUC LONG",
      "KFC",
      "LOTTERIA",
      "BANH MI",
      "NHA HANG",
      "GOFOOD",
      "SHOPEEFOOD",
    ],
  },
  {
    category: "Di chuyển",
    keywords: [
      "GRAB",
      "BE",
      "GOJEK",
      "XANH SM",
      "TAXI",
      "XANG",
      "PETROLIMEX",
      "VETC",
      "GUI XE",
      "VIETJET",
      "VIETNAM AIRLINES",
    ],
  },
  {
    category: "Lưu trú",
    keywords: ["HOTEL", "KHACH SAN", "HOMESTAY", "AGODA", "BOOKING", "AIRBNB", "RESORT"],
  },
  {
    category: "Mua sắm",
    keywords: ["SHOPEE", "LAZADA", "TIKI", "WINMART", "COOPMART", "BACH HOA XANH", "CIRCLE K", "GS25", "UNIQLO"],
  },
  {
    category: "Hóa đơn",
    keywords: ["TIEN DIEN", "EVN", "TIEN NUOC", "INTERNET", "VIETTEL", "VNPT", "FPT", "HOC PHI"],
  },
  {
    category: "Giải trí",
    keywords: ["CGV", "LOTTE CINEMA", "NETFLIX", "SPOTIFY", "KARAOKE"],
  },
  {
    category: "Sức khỏe",
    keywords: ["PHARMACITY", "LONG CHAU", "NHA THUOC", "BENH VIEN"],
  },
  {
    category: "Dịch vụ",
    keywords: ["SPA", "CAT TOC", "GIAT", "SUA XE"],
  },
];
