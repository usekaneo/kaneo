import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ColumnOptionLabel } from "@/components/project/automations/column-option-label";
import type { WorkflowEvent } from "@/components/project/automations/workflow-events";
import type { ProjectColumn } from "@/components/project/columns/types";
import { SettingsRow } from "@/components/settings/settings-row";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NO_RULE = "__none__";

type AutomationRuleRowProps = {
  event: WorkflowEvent;
  columns: ProjectColumn[];
  columnId: string | undefined;
  canEdit: boolean;
  onChange: (columnId: string | null) => Promise<void>;
};

export function AutomationRuleRow({
  event,
  columns,
  columnId,
  canEdit,
  onChange,
}: AutomationRuleRowProps) {
  const { t } = useTranslation();
  const labelId = useId();
  const [pending, setPending] = useState<string | null>(null);
  const value = pending ?? columnId ?? NO_RULE;
  const selected = columns.find((column) => column.id === value);

  const change = async (next: string | null) => {
    if (!next || next === value) return;
    setPending(next);
    try {
      await onChange(next === NO_RULE ? null : next);
    } finally {
      setPending(null);
    }
  };

  return (
    <SettingsRow
      stack
      title={
        <span id={labelId}>{t(`settings:workflowEditor.events.${event}`)}</span>
      }
      titleClassName="font-normal"
    >
      <Select
        value={value}
        disabled={!canEdit}
        onValueChange={(next) => void change(next)}
      >
        <SelectTrigger
          size="sm"
          aria-labelledby={labelId}
          className="w-full sm:w-48"
        >
          <SelectValue>
            {selected ? (
              <ColumnOptionLabel column={selected} />
            ) : (
              <span className="text-muted-foreground">
                {t("settings:workflowEditor.dontMove")}
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_RULE}>
            <span className="text-muted-foreground">
              {t("settings:workflowEditor.dontMove")}
            </span>
          </SelectItem>
          {columns.map((column) => (
            <SelectItem key={column.id} value={column.id}>
              <ColumnOptionLabel column={column} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SettingsRow>
  );
}
