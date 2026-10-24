import { useState } from "react";
import { Input } from "@/components/ui/input";

type HabitNameInputProps = {
  initial?: string;
  placeholder?: string;
  ariaLabel: string;
  autoFocus?: boolean;
  /** Called with the trimmed name; the input clears unless it is closing. */
  onSubmit: (name: string) => void;
  onCancel?: () => void;
};

export function HabitNameInput({
  initial = "",
  placeholder,
  ariaLabel,
  autoFocus,
  onSubmit,
  onCancel,
}: HabitNameInputProps) {
  const [name, setName] = useState(initial);
  const submit = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== initial) onSubmit(trimmed);
    else onCancel?.();
    setName(onCancel ? trimmed : "");
  };

  return (
    <Input
      size="sm"
      value={name}
      maxLength={100}
      placeholder={placeholder}
      aria-label={ariaLabel}
      // eslint-disable-next-line jsx-a11y/no-autofocus -- opened on purpose to rename
      autoFocus={autoFocus}
      onChange={(event) => setName(event.target.value)}
      onBlur={() => onCancel && submit()}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submit();
        } else if (event.key === "Escape" && onCancel) {
          event.preventDefault();
          onCancel();
        }
      }}
    />
  );
}
