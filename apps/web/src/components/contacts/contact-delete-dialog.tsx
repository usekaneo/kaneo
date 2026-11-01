import { useTranslation } from "react-i18next";
import { errorMessage } from "@/components/project/error-message";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { Contact } from "@/fetchers/contact";
import { useDeleteContact } from "@/hooks/mutations/contact/use-delete-contact";
import { toast } from "@/lib/toast";

type ContactDeleteDialogProps = {
  workspaceId: string;
  contact: Contact | null;
  onOpenChange: (open: boolean) => void;
};

export function ContactDeleteDialog({
  workspaceId,
  contact,
  onOpenChange,
}: ContactDeleteDialogProps) {
  const { t } = useTranslation();
  const { mutateAsync: remove } = useDeleteContact(workspaceId);

  const confirm = async () => {
    if (!contact) return;
    try {
      await remove(contact.id);
      toast.success(t("workspace:contacts.deleteSuccess"));
    } catch (error) {
      toast.error(errorMessage(error, t("workspace:contacts.deleteError")));
    }
  };

  return (
    <AlertDialog open={contact !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("workspace:contacts.deleteTitle", { name: contact?.name })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("workspace:contacts.deleteDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="outline" size="sm" />}>
            {t("common:actions.cancel")}
          </AlertDialogClose>
          <AlertDialogClose
            render={<Button variant="destructive" size="sm" />}
            onClick={confirm}
          >
            {t("workspace:contacts.delete")}
          </AlertDialogClose>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
