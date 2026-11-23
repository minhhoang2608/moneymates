import { render } from "@testing-library/react-native";
import type { ReactElement } from "react";

import { RepositoriesProvider } from "@/db/RepositoriesProvider";
import { createTransactionRepository } from "@/db/repositories";
import { openTestDb } from "@/db/testing/testDb";
import { DEFAULT_CATEGORIES } from "@/lib/category/defaults";

export const catId = (name: string, type: "expense" | "income" = "expense") =>
  DEFAULT_CATEGORIES.find((c) => c.name === name && c.type === type)!.id;

/** In-memory db plus a mount helper that wraps the UI in the repositories provider. */
export function setup(ui: () => ReactElement) {
  const { db } = openTestDb();
  const repos = { transactions: createTransactionRepository(db) };
  const mount = async (el: ReactElement = ui()) =>
    await render(<RepositoriesProvider db={db}>{el}</RepositoriesProvider>);
  return { db, repos, mount };
}
