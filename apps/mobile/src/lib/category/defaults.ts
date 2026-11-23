import type { CategoryKind } from "./types";

export type DefaultCategory = {
  id: string;
  name: string;
  type: CategoryKind;
  icon: string;
  color: string;
};

/**
 * Default categories in canonical display order ("Khác" last per type).
 * Ids are fixed so seeding is idempotent and a future sync sees the same rows on every device.
 * Icons are the design's initials; colours are the tile foreground from the Danh mục screen.
 */
export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { id: "813c5c60-cf5a-43a4-9b5b-dbc4f473f2fb", name: "Ăn uống", type: "expense", icon: "ĂU", color: "#0E7C66" },
  { id: "17a0b030-8539-4d91-ad37-a5d4b4950dd9", name: "Di chuyển", type: "expense", icon: "DC", color: "#A0561A" },
  { id: "8adfee2a-6290-4dd9-b646-8f57d3660dbb", name: "Lưu trú", type: "expense", icon: "LT", color: "#5E3FA8" },
  { id: "35658104-e151-489d-87a8-d913157bad5a", name: "Mua sắm", type: "expense", icon: "MS", color: "#245E94" },
  { id: "8c27a2a0-4192-4a23-93aa-a71cd9448e26", name: "Dịch vụ", type: "expense", icon: "DV", color: "#9D174D" },
  { id: "f2a83ced-7c9f-4ebe-8eb6-6e7b8a3716ce", name: "Hóa đơn", type: "expense", icon: "HĐ", color: "#7A4300" },
  { id: "55e3bbc6-ec1c-4df7-b916-b47c74983534", name: "Giải trí", type: "expense", icon: "GT", color: "#075985" },
  { id: "eb3a14c0-6b13-4488-9b57-64d9b511df33", name: "Sức khỏe", type: "expense", icon: "SK", color: "#A3161A" },
  { id: "51b74b66-915b-4b45-9cbf-fc18a190ca96", name: "Khác", type: "expense", icon: "K", color: "#4B5563" },
  { id: "cc9f94b4-757a-44d6-b5a7-a684ce813082", name: "Lương", type: "income", icon: "L", color: "#0E7C66" },
  { id: "9d340fc4-e33a-4310-b637-8055cc2c0e9f", name: "Được trả lại", type: "income", icon: "TL", color: "#0E7C66" },
  { id: "33214f27-de73-43be-b3f4-92414579255b", name: "Khác", type: "income", icon: "K", color: "#4B5563" },
];
