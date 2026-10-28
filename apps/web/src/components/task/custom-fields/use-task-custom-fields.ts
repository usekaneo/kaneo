import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import useSetCustomFieldValue from "@/hooks/mutations/custom-field/use-set-custom-field-value";
import useGetCustomFieldValuesByTask from "@/hooks/queries/custom-field/use-get-custom-field-values-by-task";
import useGetCustomFieldsByProject from "@/hooks/queries/custom-field/use-get-custom-fields-by-project";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";

type StoredValue = { fieldId: string; value: string | null };

const NO_FIELDS: CustomFieldDefinition[] = [];
const NO_VALUES: StoredValue[] = [];

export function useTaskCustomFields(taskId: string, projectId: string) {
  const { t } = useTranslation();
  const { data: fields = NO_FIELDS } = useGetCustomFieldsByProject(
    projectId,
  ) as {
    data: CustomFieldDefinition[] | undefined;
  };
  const { data: stored = NO_VALUES } = useGetCustomFieldValuesByTask(
    taskId,
  ) as {
    data: StoredValue[] | undefined;
  };
  const { mutateAsync: setCustomFieldValue } = useSetCustomFieldValue();
  const { canUpdateTasks } = useWorkspacePermission();
  const [pending, setPending] = useState<Record<string, string>>({});
  const [seenStored, setSeenStored] = useState(stored);

  const storedValues = useMemo(
    () =>
      Object.fromEntries(
        stored.map((entry) => [entry.fieldId, entry.value ?? ""]),
      ) as Record<string, string>,
    [stored],
  );

  if (stored !== seenStored) {
    setSeenStored(stored);
    setPending((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([fieldId, value]) => storedValues[fieldId] !== value,
        ),
      ),
    );
  }

  const values = useMemo(
    () => ({ ...storedValues, ...pending }),
    [storedValues, pending],
  );

  const save = async (field: CustomFieldDefinition, value: string) => {
    if (!taskId || value === (values[field.id] ?? "")) return;
    setPending((current) => ({ ...current, [field.id]: value }));
    try {
      await setCustomFieldValue({
        taskId,
        fieldId: field.id,
        value,
        projectId,
      });
    } catch (error) {
      setPending(({ [field.id]: _, ...rest }) => rest);
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:customFields.saveError", { field: field.name }),
      );
    }
  };

  return { fields, values, save, canEdit: canUpdateTasks() };
}
