import { List, Plus, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CustomFieldListSkeleton } from "@/components/project/custom-fields/custom-field-list-skeleton";
import { CustomFieldRow } from "@/components/project/custom-fields/custom-field-row";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import { errorMessage } from "@/components/project/error-message";
import { toPositions } from "@/components/project/sortable/apply-order";
import { SortableList } from "@/components/project/sortable/sortable-list";
import { useSortableOrder } from "@/components/project/sortable/use-sortable-order";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsEmpty } from "@/components/settings/settings-empty";
import { Button } from "@/components/ui/button";
import useDeleteCustomField from "@/hooks/mutations/custom-field/use-delete-custom-field";
import { useReorderCustomFields } from "@/hooks/mutations/custom-field/use-reorder-custom-field";
import useGetCustomFieldsByProject from "@/hooks/queries/custom-field/use-get-custom-fields-by-project";
import { toast } from "@/lib/toast";

type CustomFieldListProps = {
  projectId: string;
  canEdit: boolean;
  onCreate: () => void;
  onEdit: (field: CustomFieldDefinition) => void;
};

const NO_FIELDS: CustomFieldDefinition[] = [];

export function CustomFieldList({
  projectId,
  canEdit,
  onCreate,
  onEdit,
}: CustomFieldListProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useGetCustomFieldsByProject(projectId);
  const fields = (data as CustomFieldDefinition[] | undefined) ?? NO_FIELDS;
  const { mutateAsync: reorderFields } = useReorderCustomFields();
  const { mutateAsync: deleteField, isPending: deleting } =
    useDeleteCustomField(projectId);
  const [pendingDelete, setPendingDelete] =
    useState<CustomFieldDefinition | null>(null);

  const { ordered, move } = useSortableOrder(fields, async (next) => {
    try {
      await reorderFields({ projectId, fields: toPositions(next) });
    } catch (error) {
      toast.error(errorMessage(error, t("settings:customFields.reorderError")));
    }
  });

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteField({ id: pendingDelete.id });
      setPendingDelete(null);
      toast.success(t("settings:customFields.deleteSuccess"), {
        icon: Trash2Icon,
      });
    } catch (error) {
      toast.error(errorMessage(error, t("settings:customFields.deleteError")));
    }
  };

  if (isLoading) return <CustomFieldListSkeleton />;

  if (ordered.length === 0) {
    return (
      <SettingsCard>
        <SettingsEmpty
          icon={<List />}
          title={t("settings:customFields.emptyTitle")}
          description={t("settings:customFields.emptyDescription")}
          action={
            canEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCreate}
              >
                <Plus aria-hidden="true" />
                {t("settings:projectCustomFields.newField")}
              </Button>
            ) : undefined
          }
        />
      </SettingsCard>
    );
  }

  return (
    <>
      <SettingsCard>
        <SortableList ids={ordered.map((field) => field.id)} onMove={move}>
          {ordered.map((field) => (
            <CustomFieldRow
              key={field.id}
              field={field}
              canEdit={canEdit}
              onEdit={() => onEdit(field)}
              onDelete={() => setPendingDelete(field)}
            />
          ))}
        </SortableList>
      </SettingsCard>
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={t("settings:customFields.deleteTitle", {
          name: pendingDelete?.name ?? "",
        })}
        description={t("settings:customFields.deleteDescription")}
        confirmLabel={t("settings:customFields.deleteConfirm")}
        pendingLabel={t("common:actions.deleting")}
        pending={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
