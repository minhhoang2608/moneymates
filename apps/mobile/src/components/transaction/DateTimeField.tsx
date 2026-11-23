import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useState } from "react";

/** Native date picker, then time picker. Reports the combined local Date once both are chosen. */
export function DateTimeField({
  value,
  onChange,
  onClose,
  dateOnly = false,
}: {
  value: Date;
  onChange: (d: Date) => void;
  onClose: () => void;
  /** Skip the time step and report the picked day (time kept from `value`). */
  dateOnly?: boolean;
}) {
  const [step, setStep] = useState<"date" | "time">("date");
  const [draft, setDraft] = useState(value);

  const handle = (e: DateTimePickerEvent, picked?: Date) => {
    if (e.type === "dismissed" || !picked) return onClose();
    if (step === "date") {
      const next = new Date(value);
      next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
      if (dateOnly) {
        onChange(next);
        onClose();
        return;
      }
      setDraft(next);
      setStep("time");
      return;
    }
    const next = new Date(draft);
    next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
    onChange(next);
    onClose();
  };

  return <DateTimePicker value={draft} mode={step} is24Hour onChange={handle} />;
}
