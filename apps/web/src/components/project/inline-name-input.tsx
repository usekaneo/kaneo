import { type KeyboardEvent, useRef, useState } from "react";
import { cn } from "@/lib/cn";

type InlineNameInputProps = {
  name: string;
  label: string;
  readOnly?: boolean;
  className?: string;
  onRename: (name: string) => Promise<boolean> | boolean;
};

export function InlineNameInput({
  name,
  label,
  readOnly = false,
  className,
  onRename,
}: InlineNameInputProps) {
  const [draft, setDraft] = useState(name);
  const [syncedName, setSyncedName] = useState(name);
  const cancelled = useRef(false);

  if (name !== syncedName) {
    setSyncedName(name);
    setDraft(name);
  }

  const commit = async () => {
    const trimmed = draft.trim();
    if (cancelled.current || !trimmed || trimmed === name) {
      cancelled.current = false;
      setDraft(name);
      return;
    }

    setDraft(trimmed);
    if (!(await onRename(trimmed))) setDraft(name);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelled.current = true;
      event.currentTarget.blur();
    }
  };

  return (
    <input
      value={draft}
      aria-label={label}
      readOnly={readOnly}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => void commit()}
      onKeyDown={handleKeyDown}
      className={cn(
        "-ml-2 h-7.5 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-sm text-foreground outline-none transition-[border-color,box-shadow]",
        !readOnly &&
          "hover:border-input focus-visible:border-ring focus-visible:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/24 dark:focus-visible:bg-input/32",
        className,
      )}
    />
  );
}
