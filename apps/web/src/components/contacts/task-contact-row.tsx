import { UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PropertyRow } from "@/components/task/properties/property-row";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  // Hide the row until it is useful: no contacts yet and none linked.
  if (contacts.length === 0 && !contactId) return null;

  const items = [
    { value: NONE, label: t("workspace:contacts.noContact") },
    ...contacts.map((contact) => ({ value: contact.id, label: contact.name })),
  ];
  const value = contactId ?? NONE;

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
          size="sm"
          aria-label={t("workspace:contacts.taskLabel")}
          className="border-transparent bg-transparent shadow-none"
        >
          <UserRound aria-hidden="true" className="text-muted-foreground" />
          <SelectValue>
            {items.find((item) => item.value === value)?.label}
          </SelectValue>
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
