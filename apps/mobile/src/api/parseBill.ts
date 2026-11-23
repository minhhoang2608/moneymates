import { apiPostMultipart } from "./client";

export type ParseBillResponse = {
  amount: number | null;
  currency: string;
  shop: string | null;
  date: string | null;
  category: string | null;
};

export const BILL_IMAGE_NAME = "bill.jpg";

/** Uploads the compressed bill image. Amount must be a non-negative integer and category one of `categories`, else null. */
export async function parseBill(imageUri: string, categories: string[]): Promise<ParseBillResponse> {
  const form = new FormData();
  form.append("image", { uri: imageUri, name: BILL_IMAGE_NAME, type: "image/jpeg" } as unknown as Blob);
  form.append("categories", JSON.stringify(categories));
  const raw = await apiPostMultipart<Partial<ParseBillResponse> | null>("/ai/parse-bill", form);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const category = str(raw?.category);
  return {
    amount: typeof raw?.amount === "number" && Number.isInteger(raw.amount) && raw.amount >= 0 ? raw.amount : null,
    currency: str(raw?.currency) ?? "VND",
    shop: str(raw?.shop),
    date: str(raw?.date),
    category: category && categories.includes(category) ? category : null,
  };
}
