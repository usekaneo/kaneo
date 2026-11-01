import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "@/components/ui/menu";
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import type { AutomationDraft } from "./automation-draft";
import { AutomationFilterChip } from "./automation-filter-chip";
import { uniqueNames } from "./unique-names";
import { useColumnNames } from "./use-column-names";

type AutomationEventFiltersProps = {
  workspaceId: string;
  draft: AutomationDraft;
  onChange: (patch: Partial<AutomationDraft>) => void;
};

type FilterOption = { id: string; label: string };

// "Only if" chips. Label, column, and project filters combine with AND; the
// project filter is hidden when the scope is already one project.
export function AutomationEventFilters({
  workspaceId,
  draft,
  onChange,
}: AutomationEventFiltersProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: labels } = useGetLabelsByWorkspace(workspaceId);
  const { data: projects } = useGetProjects({ workspaceId });
  const scoped = Boolean(draft.projectId);
  const filterProjectId = scoped ? null : draft.filterProjectId;
  const columnProjects = draft.projectId
    ? [draft.projectId]
    : filterProjectId
      ? [filterProjectId]
      : (projects ?? []).map((project) => project.id);
  const columns = useColumnNames(columnProjects, open);
  const project = projects?.find((item) => item.id === filterProjectId);

  const groups: {
    key: "label" | "column" | "project";
    options: FilterOption[];
    onSelect: (option: FilterOption) => void;
  }[] = [
    ...(draft.labelName
      ? []
      : [
          {
            key: "label" as const,
            options: uniqueNames((labels ?? []).map((label) => label.name)).map(
              (name) => ({ id: name, label: name }),
            ),
            onSelect: (option: FilterOption) =>
              onChange({ labelName: option.id }),
          },
        ]),
    ...(draft.columnName
      ? []
      : [
          {
            key: "column" as const,
            options: columns.map((name) => ({ id: name, label: name })),
            onSelect: (option: FilterOption) =>
              onChange({ columnName: option.id }),
          },
        ]),
    ...(scoped || filterProjectId
      ? []
      : [
          {
            key: "project" as const,
            options: (projects ?? []).map((item) => ({
              id: item.id,
              label: item.name,
            })),
            onSelect: (option: FilterOption) =>
              onChange({ filterProjectId: option.id }),
          },
        ]),
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-muted-foreground text-xs">
        {t("agent:automations.filters.onlyIf")}
      </span>
      {draft.labelName && (
        <AutomationFilterChip
          label={t("agent:automations.filters.labelIs", {
            name: draft.labelName,
          })}
          onRemove={() => onChange({ labelName: null })}
        />
      )}
      {draft.columnName && (
        <AutomationFilterChip
          label={t("agent:automations.filters.columnIs", {
            name: draft.columnName,
          })}
          onRemove={() => onChange({ columnName: null })}
        />
      )}
      {filterProjectId && (
        <AutomationFilterChip
          label={t("agent:automations.filters.projectIs", {
            name: project?.name ?? "…",
          })}
          onRemove={() => onChange({ filterProjectId: null })}
        />
      )}
      {groups.length > 0 && (
        <Menu open={open} onOpenChange={setOpen}>
          <MenuTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="border-dashed text-muted-foreground"
              />
            }
          >
            <Plus aria-hidden="true" />
            {t("agent:automations.filters.add")}
          </MenuTrigger>
          <MenuPopup align="start" className="min-w-40">
            {groups.map((group) => (
              <MenuSub key={group.key}>
                <MenuSubTrigger>
                  {t(`agent:automations.filters.${group.key}`)}
                </MenuSubTrigger>
                <MenuSubPopup className="max-h-72 min-w-44">
                  {group.options.length === 0 ? (
                    <MenuItem disabled>
                      {t("agent:automations.filters.none")}
                    </MenuItem>
                  ) : (
                    group.options.map((option) => (
                      <MenuItem
                        key={option.id}
                        closeOnClick
                        onClick={() => group.onSelect(option)}
                      >
                        <span className="truncate">{option.label}</span>
                      </MenuItem>
                    ))
                  )}
                </MenuSubPopup>
              </MenuSub>
            ))}
          </MenuPopup>
        </Menu>
      )}
    </div>
  );
}
