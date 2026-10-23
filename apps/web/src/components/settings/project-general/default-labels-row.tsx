import { Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FilterSubjectPanel } from "@/components/project/task-filters/filter-subject-panel";
import { LabelFilterDot } from "@/components/project/task-filters/label-filter-dot";
import { LabelPill } from "@/components/settings/labels/label-pill";
import { SettingsRow } from "@/components/settings/settings-row";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import useSetProjectDefaultLabels from "@/hooks/mutations/label/use-set-project-default-labels";
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import useGetProjectDefaultLabels from "@/hooks/queries/label/use-get-project-default-labels";
import { toast } from "@/lib/toast";

type DefaultLabelsRowProps = {
  projectId: string;
  workspaceId: string;
  canEdit: boolean;
};

export function DefaultLabelsRow({
  projectId,
  workspaceId,
  canEdit,
}: DefaultLabelsRowProps) {
  const { t } = useTranslation();
  const { data: defaults = [] } = useGetProjectDefaultLabels(projectId);
  const { data: labels = [] } = useGetLabelsByWorkspace(workspaceId);
  const { mutate: save, isPending } = useSetProjectDefaultLabels(projectId);
  const workspaceLabels = labels.filter((label) => !label.taskId);
  const selected = defaults.map((label) => label.id);

  const toggle = (id: string) =>
    save(
      selected.includes(id)
        ? selected.filter((item) => item !== id)
        : [...selected, id],
      {
        onError: () =>
          toast.error(t("settings:projectGeneral.defaultLabels.error")),
      },
    );

  return (
    <SettingsRow
      stack
      icon={<Tag />}
      title={t("settings:projectGeneral.defaultLabels.title")}
      description={
        <>
          <span>{t("settings:projectGeneral.defaultLabels.description")}</span>
          {defaults.length > 0 && (
            <span className="mt-2 flex flex-wrap gap-1.5">
              {defaults.map((label) => (
                <LabelPill
                  key={label.id}
                  name={label.name}
                  color={label.color}
                />
              ))}
            </span>
          )}
        </>
      }
    >
      {canEdit && (
        <Popover>
          <PopoverTrigger
            render={<Button variant="outline" size="sm" disabled={isPending} />}
          >
            {t("settings:projectGeneral.defaultLabels.choose")}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <FilterSubjectPanel
              subject={{
                id: "default-labels",
                kind: "core",
                label: t("settings:projectGeneral.defaultLabels.title"),
                icon: null,
                operators: { positive: "", negative: "" },
                options: workspaceLabels.map((label) => ({
                  value: label.id,
                  label: label.name,
                  icon: <LabelFilterDot color={label.color} />,
                })),
                selected,
                negated: false,
                onToggle: toggle,
                onNegate: () => undefined,
                onClear: () => undefined,
                emptyLabel: t("tasks:labels.empty"),
              }}
            />
          </PopoverContent>
        </Popover>
      )}
    </SettingsRow>
  );
}
