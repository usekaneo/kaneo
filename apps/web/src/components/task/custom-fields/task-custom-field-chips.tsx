import { CustomFieldChip } from "@/components/custom-fields/custom-field-chip";
import { useTaskCustomFields } from "./use-task-custom-fields";

type TaskCustomFieldChipsProps = {
  taskId: string;
  projectId: string;
  className?: string;
};

export function TaskCustomFieldChips({
  taskId,
  projectId,
  className,
}: TaskCustomFieldChipsProps) {
  const { fields, values, save, canEdit } = useTaskCustomFields(
    taskId,
    projectId,
  );

  return fields.map((field) => (
    <CustomFieldChip
      key={field.id}
      field={field}
      value={values[field.id] ?? ""}
      onChange={(value) => void save(field, value)}
      disabled={!canEdit}
      className={className}
    />
  ));
}
