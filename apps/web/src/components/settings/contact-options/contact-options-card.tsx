import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/components/project/error-message";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSection } from "@/components/settings/settings-section";
import type {
  ContactOption,
  ContactOptionKind,
} from "@/fetchers/contact-options";
import { useAddContactOptions } from "@/hooks/mutations/contact/use-add-contact-options";
import { useDeleteContactOption } from "@/hooks/mutations/contact/use-delete-contact-option";
import { useRenameContactOption } from "@/hooks/mutations/contact/use-rename-contact-option";
import { useReorderContactOptions } from "@/hooks/mutations/contact/use-reorder-contact-options";
import { toast } from "@/lib/toast";
import { ContactOptionAddForm } from "./contact-option-add-form";
import type { ContactOptionCopy } from "./contact-option-copy";
import { ContactOptionRow } from "./contact-option-row";
import { moveKey } from "./move-option";

type ContactOptionsCardProps = {
  workspaceId: string;
  kind: ContactOptionKind;
  options: ContactOption[];
  copy: ContactOptionCopy;
};

export function ContactOptionsCard({
  workspaceId,
  kind,
  options,
  copy,
}: ContactOptionsCardProps) {
  const { t } = useTranslation();
  const [toDelete, setToDelete] = useState<ContactOption | null>(null);
  const add = useAddContactOptions(workspaceId, kind);
  const rename = useRenameContactOption(workspaceId, kind);
  const reorder = useReorderContactOptions(workspaceId, kind);
  const remove = useDeleteContactOption(workspaceId, kind);
  const busy = rename.isPending || reorder.isPending || remove.isPending;

  const onRename = async (key: string, label: string) => {
    try {
      return await rename.mutateAsync({ key, label });
    } catch (error) {
      toast.error(
        errorMessage(error, t("settings:workspaceContacts.renameError")),
      );
      throw error;
    }
  };

  const onMove = (key: string, direction: "up" | "down") => {
    const keys = moveKey(
      options.map((option) => option.key),
      key,
      direction,
    );
    if (!keys) return;
    reorder.mutate(keys, {
      onError: (error) =>
        toast.error(
          errorMessage(error, t("settings:workspaceContacts.reorderError")),
        ),
    });
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      const { affectedContacts } = await remove.mutateAsync(toDelete.key);
      toast.success(copy.deleteSuccess(affectedContacts));
      setToDelete(null);
    } catch (error) {
      toast.error(
        errorMessage(error, t("settings:workspaceContacts.deleteError")),
      );
    }
  };

  return (
    <SettingsSection title={copy.title} description={copy.description}>
      <SettingsCard>
        {options.length === 0 ? (
          <p className="px-4 py-3.5 text-muted-foreground text-sm">
            {copy.empty}
          </p>
        ) : (
          <ul aria-label={copy.listLabel} className="max-h-96 overflow-y-auto">
            {options.map((option, index) => (
              <ContactOptionRow
                key={option.key}
                option={option}
                isFirst={index === 0}
                isLast={index === options.length - 1}
                isOnly={options.length === 1}
                busy={busy}
                onRename={onRename}
                onMove={onMove}
                onDelete={setToDelete}
              />
            ))}
          </ul>
        )}
        <ContactOptionAddForm
          copy={copy}
          pending={add.isPending}
          onAdd={add.mutateAsync}
        />
      </SettingsCard>
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title={copy.deleteTitle(toDelete?.label ?? "")}
        description={copy.deleteDescription(toDelete?.contactCount ?? 0)}
        confirmLabel={t("settings:workspaceContacts.delete")}
        pending={remove.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </SettingsSection>
  );
}
