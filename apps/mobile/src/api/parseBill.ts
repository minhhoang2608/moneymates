import { File } from "expo-file-system";

import { apiPostMultipart } from "./client";

export type ParseBillResponse = {
  amount: number | null;
  currency: string;
  shop: string | null;
  date: string | null;
  category: string | null;
};

/** Uploads the compressed bill image. Amount must be a non-negative integer and category one of `categories`, else null. */
export async function parseBill(imageUri: string, categories: string[]): Promise<ParseBillResponse> {
  const form = new FormData();
  // Expo's global fetch cannot send React Native's `{ uri, name, type }` file object ("Unsupported FormDataPart
  // implementation"); it needs a Blob-like part, which expo-file-system's File is.
  form.append("image", new File(imageUri) as unknown as Blob);
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
