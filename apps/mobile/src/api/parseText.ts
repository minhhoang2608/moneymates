import { useQuery } from "@tanstack/react-query";

import { apiPost } from "./client";

export type ParseTextResponse = {
  amount: number | null;
  currency: string;
  note: string | null;
  category: string | null;
  payer: string | null;
};

export function parseText(text: string, categories: string[]): Promise<ParseTextResponse> {
  return apiPost<ParseTextResponse>("/ai/parse-text", { text, categories });
}

/** Never throws: any failure, or a category that is not in `categories`, becomes `null`. */
export async function suggestCategoryByAi(text: string, categories: string[]): Promise<string | null> {
  try {
    const res = await parseText(text, categories);
    const name = typeof res?.category === "string" ? res.category.trim() : "";
    return name && categories.includes(name) ? name : null;
  } catch {
    return null;
  }
}

export function useCategorySuggestion({
  text,
  categories,
  enabled,
}: {
  text: string;
  categories: string[];
  enabled: boolean;
}): string | null {
  const { data } = useQuery<string | null>({
    queryKey: ["ai", "parse-text", text, categories],
    queryFn: () => suggestCategoryByAi(text, categories),
    enabled: enabled && text.length > 0 && categories.length > 0,
    retry: false,
    staleTime: Infinity,
  });
  return data ?? null;
}
