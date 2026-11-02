import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { ContactOption } from "@/fetchers/contact-options";
import { ContactOptionEditableLabel } from "./contact-option-editable-label";

type ContactOptionRowProps = {
  option: ContactOption;
  isFirst: boolean;
  isLast: boolean;
  isOnly: boolean;
  busy: boolean;
  onRename: (key: string, label: string) => Promise<unknown>;
  onMove: (key: string, direction: "up" | "down") => void;
  onDelete: (option: ContactOption) => void;
};

export function ContactOptionRow({
  option,
  isFirst,
  isLast,
  isOnly,
  busy,
  onRename,
  onMove,
  onDelete,
}: ContactOptionRowProps) {
  const { t } = useTranslation();
  const up = useRef<HTMLButtonElement>(null);
  const down = useRef<HTMLButtonElement>(null);
  const moved = useRef<"up" | "down" | null>(null);

  // Moving re-renders the row in a new place, which can drop keyboard focus;
  // put it back on the same button, or the other one if this one is now at an end.
  useEffect(() => {
    const direction = moved.current;
    if (!direction) return;
    moved.current = null;
    const same = direction === "up" ? up.current : down.current;
    const other = direction === "up" ? down.current : up.current;
    (same && !same.disabled ? same : other)?.focus();
  }, [option.position]);

  const move = (direction: "up" | "down") => {
    moved.current = direction;
    onMove(option.key, direction);
  };

  return (
    <li className="flex items-center gap-2 px-3 py-2">
      <div className="min-w-0 flex-1">
        <ContactOptionEditableLabel
          key={option.key}
          label={option.label}
          disabled={busy}
          onSave={(label) => onRename(option.key, label)}
        />
      </div>
      <span className="w-24 shrink-0 text-right text-muted-foreground text-xs tabular-nums">
        {t("settings:workspaceContacts.contactCount", {
          count: option.contactCount,
        })}
      </span>
      <Button
        ref={up}
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={busy || isFirst}
        aria-label={t("settings:workspaceContacts.moveUpAria", {
          name: option.label,
        })}
        onClick={() => move("up")}
      >
        <ArrowUp aria-hidden="true" />
      </Button>
      <Button
        ref={down}
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={busy || isLast}
        aria-label={t("settings:workspaceContacts.moveDownAria", {
          name: option.label,
        })}
        onClick={() => move("down")}
      >
        <ArrowDown aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={busy || isOnly}
        title={isOnly ? t("settings:workspaceContacts.lastOne") : undefined}
        aria-label={t("settings:workspaceContacts.deleteAria", {
          name: option.label,
        })}
        onClick={() => onDelete(option)}
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </li>
  );
}
