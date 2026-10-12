import { useTranslation } from "react-i18next";
import { CustomFieldRow } from "@/components/custom-fields/custom-field-row";
import { useTaskCustomFields } from "./use-task-custom-fields";

type TaskCustomFieldRowsProps = {
  taskId: string;
  projectId: string;
};

export function TaskCustomFieldRows({
  taskId,
  projectId,
}: TaskCustomFieldRowsProps) {
  const { t } = useTranslation();
  const { fields, values, save, canEdit } = useTaskCustomFields(
    taskId,
    projectId,
  );

  if (fields.length === 0) return null;

  return (
    <section
      aria-label={t("tasks:customFields.fields")}
      className="flex flex-col gap-1"
    >
      <span className="px-2 font-medium text-foreground/70 text-xs">
        {t("tasks:customFields.fields")}
      </span>
      <div className="flex flex-col gap-1">
        {fields.map((field) => (
          <CustomFieldRow
            key={field.id}
            field={field}
            value={values[field.id] ?? ""}
            onChange={(value) => void save(field, value)}
            disabled={!canEdit}
          />
        ))}
      </div>
    </section>
  );
}
