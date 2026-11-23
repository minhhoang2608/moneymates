import type { CategoryRow } from "@/db/repositories";
import { vi } from "@/i18n/vi";

import { SheetPicker } from "./SheetPicker";

export function CategoryPicker({
  visible,
  categories,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  categories: CategoryRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <SheetPicker
      visible={visible}
      title={vi.txn.categoryChoose}
      options={categories.map((c) => ({ key: c.id, label: c.name, testID: `category-item-${c.id}` }))}
      selectedKey={selectedId}
      onSelect={onSelect}
      onClose={onClose}
    />
  );
}
