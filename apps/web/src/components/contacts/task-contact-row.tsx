import { Link } from "@tanstack/react-router";
import { UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PropertyRow } from "@/components/task/properties/property-row";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import { useSetTaskContact } from "@/hooks/mutations/contact/use-set-task-contact";
import { useContacts } from "@/hooks/queries/contact/use-contacts";
import { errorMessage } from "@/components/project/error-message";

const NONE = "none";

type TaskContactRowProps = {
  taskId: string;
  workspaceId: string;
  contactId: string | null | undefined;
  canEdit: boolean;
};

// Leads are ordinary tasks; this row says who the lead is for.
export function TaskContactRow({
  taskId,
  workspaceId,
  contactId,
  canEdit,
}: TaskContactRowProps) {
  const { t } = useTranslation();
  const { data: contacts = [] } = useContacts(workspaceId);
  const { mutateAsync: setContact } = useSetTaskContact(workspaceId);

  // No contacts yet and none linked: keep the row so the feature is findable,
  // and point at the page where the first contact is added.
  if (contacts.length === 0 && !contactId) {
    return (
      <PropertyRow label={t("workspace:contacts.taskLabel")}>
        <Link
          to="/dashboard/workspace/$workspaceId/contacts"
          params={{ workspaceId }}
          className="flex min-h-7.5 min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.25 text-[13px] text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:bg-accent [&_svg]:size-3.5 [&_svg]:shrink-0"
        >
          <UserRound aria-hidden="true" />
          <span className="line-clamp-2 break-words">
            {t("workspace:contacts.addFirst")}
          </span>
        </Link>
      </PropertyRow>
    );
  }

  const items = [
    { value: NONE, label: t("workspace:contacts.noContact") },
    ...contacts.map((contact) => ({ value: contact.id, label: contact.name })),
  ];
  const value = contactId ?? NONE;
  const label = items.find((item) => item.value === value)?.label;

  return (
    <PropertyRow label={t("workspace:contacts.taskLabel")}>
      <Select
        items={items}
        value={value}
        disabled={!canEdit}
        onValueChange={async (next) => {
          if (typeof next !== "string" || next === value) return;
          try {
            await setContact({
              taskId,
              contactId: next === NONE ? null : next,
            });
          } catch (error) {
            toast.error(errorMessage(error, t("workspace:contacts.linkError")));
          }
        }}
      >
        <SelectTrigger
          aria-label={t("workspace:contacts.taskLabel")}
          title={label}
          // Looks like the other rail values: flat, no chevron, wraps long names.
          className="h-auto min-h-7.5 w-full min-w-0 justify-start gap-2 rounded-md border-0 bg-transparent px-2 py-1.25 text-left font-medium text-[13px] shadow-none before:hidden hover:bg-accent focus-visible:bg-accent focus-visible:ring-0 data-popup-open:bg-accent sm:min-h-7.5 dark:bg-transparent [&>[data-slot=select-icon]]:hidden [&_svg]:size-3.5"
        >
          <UserRound
            aria-hidden="true"
            className="size-3.5 shrink-0 text-muted-foreground"
          />
          <span
            className={cn(
              "line-clamp-2 min-w-0 flex-1 break-words text-left",
              value === NONE && "text-muted-foreground",
            )}
          >
            {label}
          </span>
        </SelectTrigger>
        <SelectPopup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </PropertyRow>
  );
}
