import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import type { ReactNode } from "react";
import { Text } from "react-native";

import { vi } from "@/i18n/vi";

import { db } from "./client";
import migrations from "./migrations/migrations";

/** Runs local migrations at app start. Never touches the network. */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const { success, error } = useMigrations(db, migrations);
  if (error) return <Text testID="db-migration-error">{vi.db.migrationError}</Text>;
  if (!success) return null;
  return <>{children}</>;
}
