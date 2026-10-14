import { Link } from "@tanstack/react-router";
import { SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CustomFieldRow } from "@/components/custom-fields/custom-field-row";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
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
  const { canUpdateProjects } = useWorkspacePermission();
  const { fields, values, save, canEdit } = useTaskCustomFields(
    taskId,
    projectId,
  );

  if (fields.length === 0) return null;

  return (
    <section
      aria-label={t("tasks:customFields.fields")}
      className="flex flex-col gap-0.5 border-border border-t pt-3.5"
    >
      <div className="flex h-6 items-center justify-between pr-1 pb-1 pl-2">
        <span className="font-medium text-muted-foreground text-xs">
          {t("tasks:customFields.fields")}
        </span>
        {canUpdateProjects() && (
          <Link
            to="/dashboard/settings/projects/$projectId/custom-fields"
            params={{ projectId }}
            aria-label={t("tasks:customFields.manage")}
            title={t("tasks:customFields.manage")}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground/70 outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
          >
            <SlidersHorizontal className="size-3.25" />
          </Link>
        )}
      </div>
      {fields.map((field) => (
        <CustomFieldRow
          key={field.id}
          field={field}
          value={values[field.id] ?? ""}
          onChange={(value) => void save(field, value)}
          disabled={!canEdit}
        />
      ))}
    </section>
  );
}
