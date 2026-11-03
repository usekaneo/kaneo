import { UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/components/project/error-message";
import {
  ContextMenuCheckboxItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import { useSetTaskContact } from "@/hooks/mutations/contact/use-set-task-contact";
import { useContacts } from "@/hooks/queries/contact/use-contacts";
import { toast } from "@/lib/toast";

type ContactSubmenuProps = {
  taskId: string;
  workspaceId: string;
  contactId: string | null | undefined;
};

// Link a card to a contact without opening it. Absent when there are no contacts.
export function ContactSubmenu({
  taskId,
  workspaceId,
  contactId,
}: ContactSubmenuProps) {
  const { t } = useTranslation();
  const { data: contacts = [] } = useContacts(workspaceId);
  const { mutateAsync: setContact } = useSetTaskContact(workspaceId);
  if (contacts.length === 0) return null;

  const choose = async (next: string | null) => {
    if (next === (contactId ?? null)) return;
    try {
      await setContact({ taskId, contactId: next });
    } catch (error) {
      toast.error(errorMessage(error, t("workspace:contacts.linkError")));
    }
  };

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <UserRound className="size-3.5 text-muted-foreground" />
        <span>{t("workspace:contacts.taskLabel")}</span>
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="max-h-72 w-52 overflow-y-auto">
        <ContextMenuCheckboxItem
          checked={!contactId}
          onCheckedChange={() => void choose(null)}
          closeOnClick
        >
          {t("workspace:contacts.noContact")}
        </ContextMenuCheckboxItem>
        {contacts.map((contact) => (
          <ContextMenuCheckboxItem
            key={contact.id}
            checked={contactId === contact.id}
            onCheckedChange={() => void choose(contact.id)}
            closeOnClick
          >
            <span className="line-clamp-2 break-words">{contact.name}</span>
          </ContextMenuCheckboxItem>
        ))}
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}
