import { vi } from "@/i18n/vi";

import { SheetPicker } from "./SheetPicker";

export function MoneySourcePicker({
  visible,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  options: string[];
  selected: string;
  onSelect: (source: string) => void;
  onClose: () => void;
}) {
  return (
    <SheetPicker
      visible={visible}
      title={vi.txn.moneySource}
      options={options.map((s, i) => ({ key: s, label: s, testID: `money-source-item-${i}` }))}
      selectedKey={selected}
      onSelect={onSelect}
      onClose={onClose}
    />
  );
}
