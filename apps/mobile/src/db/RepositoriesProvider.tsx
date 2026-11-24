import { createContext, useContext, useMemo, type ReactNode } from "react";

import { db as defaultDb } from "./client";
import {
  createAppSettingRepository,
  createBankAccountRepository,
  createCategoryRepository,
  createGroupExpenseRepository,
  createGroupRepository,
  createHandOffMemoryRepository,
  createMoneySourceRepository,
  createPaymentAppPrefsRepository,
  createPreferencesRepository,
  createProfileRepository,
  createSettlementRepository,
  createTransactionRepository,
  type AppSettingRepository,
  type BankAccountRepository,
  type CategoryRepository,
  type GroupExpenseRepository,
  type GroupRepository,
  type HandOffMemoryRepository,
  type MoneySourceRepository,
  type PaymentAppPrefsRepository,
  type PreferencesRepository,
  type ProfileRepository,
  type SettlementRepository,
  type TransactionRepository,
} from "./repositories";
import type { AnyDb } from "./seed";

export type Repositories = {
  profile: ProfileRepository;
  bankAccounts: BankAccountRepository;
  categories: CategoryRepository;
  transactions: TransactionRepository;
  groups: GroupRepository;
  groupExpenses: GroupExpenseRepository;
  settlements: SettlementRepository;
  appSettings: AppSettingRepository;
  paymentAppPrefs: PaymentAppPrefsRepository;
  moneySources: MoneySourceRepository;
  preferences: PreferencesRepository;
  handOffMemory: HandOffMemoryRepository;
};

const RepositoriesContext = createContext<Repositories | null>(null);

/** Builds the repositories once. Tests inject a better-sqlite3 db through `db`. */
export function RepositoriesProvider({ children, db }: { children: ReactNode; db?: AnyDb }) {
  const value = useMemo(() => {
    const target = db ?? (defaultDb as unknown as AnyDb);
    return {
      profile: createProfileRepository(target),
      bankAccounts: createBankAccountRepository(target),
      categories: createCategoryRepository(target),
      transactions: createTransactionRepository(target),
      groups: createGroupRepository(target),
      groupExpenses: createGroupExpenseRepository(target),
      settlements: createSettlementRepository(target),
      appSettings: createAppSettingRepository(target),
      paymentAppPrefs: createPaymentAppPrefsRepository(target),
      moneySources: createMoneySourceRepository(target),
      preferences: createPreferencesRepository(target),
      handOffMemory: createHandOffMemoryRepository(target),
    };
  }, [db]);
  return <RepositoriesContext.Provider value={value}>{children}</RepositoriesContext.Provider>;
}

export function useRepositories(): Repositories {
  const value = useContext(RepositoriesContext);
  if (!value) throw new Error("useRepositories must be used inside RepositoriesProvider");
  return value;
}
