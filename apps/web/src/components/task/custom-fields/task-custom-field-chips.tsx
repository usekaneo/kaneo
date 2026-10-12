import { CustomFieldChip } from "@/components/custom-fields/custom-field-chip";
import { useTaskCustomFields } from "./use-task-custom-fields";

type TaskCustomFieldChipsProps = {
  taskId: string;
  projectId: string;
};

export function TaskCustomFieldChips({
  taskId,
  projectId,
}: TaskCustomFieldChipsProps) {
  const { fields, values, save, canEdit } = useTaskCustomFields(
    taskId,
    projectId,
  );

  if (fields.length === 0) return null;

  return (
    <div className="flex w-full flex-wrap items-center gap-1.5">
      {fields.map((field) => (
        <CustomFieldChip
          key={field.id}
          field={field}
          value={values[field.id] ?? ""}
          onChange={(value) => void save(field, value)}
          disabled={!canEdit}
        />
      ))}
    </div>
  );
}
