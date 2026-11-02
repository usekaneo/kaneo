import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";

type ContactOptionEditableLabelProps = {
  label: string;
  disabled: boolean;
  // Resolves when saved; rejects (after showing why) when it could not be.
  onSave: (label: string) => Promise<unknown>;
};

// Edited in place: Enter or leaving the field saves, Escape puts the old name back.
export function ContactOptionEditableLabel({
  label,
  disabled,
  onSave,
}: ContactOptionEditableLabelProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(label);
  const cancelled = useRef(false);

  useEffect(() => setDraft(label), [label]);

  const commit = async () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const next = draft.trim();
    if (next === "" || next === label) {
      setDraft(label);
      return;
    }
    try {
      await onSave(next);
    } catch {
      setDraft(label);
    }
  };

  return (
    <Input
      value={draft}
      maxLength={120}
      disabled={disabled}
      aria-label={t("settings:workspaceContacts.renameAria", { name: label })}
      className="h-8"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Enter") {
          event.preventDefault();
          void commit();
        } else if (event.key === "Escape") {
          // Let the dialog or page keep Escape for itself only when nothing changed.
          if (draft === label) return;
          event.stopPropagation();
          cancelled.current = true;
          setDraft(label);
          event.currentTarget.blur();
        }
      }}
    />
  );
}
