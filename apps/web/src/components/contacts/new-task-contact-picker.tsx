import { Check, UserRound } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useContacts } from "@/hooks/queries/contact/use-contacts";
import { cn } from "@/lib/cn";

type NewTaskContactPickerProps = {
  workspaceId: string;
  value: string | null;
  onChange: (contactId: string | null) => void;
};

// Chip in the new-task dialog. Hidden until the workspace has a contact, so
// teams that don't use contacts never see it.
export function NewTaskContactPicker({
  workspaceId,
  value,
  onChange,
}: NewTaskContactPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: contacts = [] } = useContacts(workspaceId);
  if (contacts.length === 0) return null;

  const selected = contacts.find((contact) => contact.id === value);
  const options = [
    { id: null, name: t("workspace:contacts.noContact") },
    ...contacts,
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex max-w-48 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 font-medium text-xs transition-colors hover:bg-accent/50",
            selected ? "bg-accent/30 text-foreground" : "text-muted-foreground",
          )}
        >
          <UserRound aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {selected?.name ?? t("workspace:contacts.taskLabel")}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="max-h-72 w-56 overflow-y-auto p-1"
        align="start"
      >
        {options.map((option) => (
          <button
            key={option.id ?? "none"}
            type="button"
            className="flex min-h-8 w-full items-center gap-2 px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent/50"
            onClick={() => {
              onChange(option.id);
              setOpen(false);
            }}
          >
            <span className="line-clamp-2 break-words">{option.name}</span>
            {(option.id ?? null) === value && (
              <Check className="ml-auto h-4 w-4 shrink-0" />
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
