import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FilterSubjectPanel } from "@/components/project/task-filters/filter-subject-panel";
import { LabelFilterDot } from "@/components/project/task-filters/label-filter-dot";
import { SidebarGroupAction } from "@/components/ui/sidebar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { PinnedLabel } from "@/fetchers/label/get-pinned-labels";
import useSetLabelPinned from "@/hooks/mutations/label/use-set-label-pinned";
import useGlobalBoardMeta from "@/hooks/queries/task/use-global-board-meta";
import { toast } from "@/lib/toast";
import type { PinnedLabelGroup } from "./group-pinned-labels";

type PinLabelPickerProps = { groups: PinnedLabelGroup[] };

// Lists every label the global board can filter by, across workspaces.
export function PinLabelPicker({ groups }: PinLabelPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: meta } = useGlobalBoardMeta({ enabled: open });
  const { mutate: setPinned } = useSetLabelPinned();
  const title = t("navigation:pinnedLabels.pin");
  const pinnedNames = new Map(
    groups.map((group) => [group.name.toLowerCase(), group]),
  );

  const toggle = (name: string) => {
    const group = pinnedNames.get(name.toLowerCase());
    const label = meta?.labels.find((item) => item.name === name);
    const pins: Array<{ label: PinnedLabel; pinned: boolean }> = group
      ? group.pins.map((pin) => ({ label: pin, pinned: false }))
      : label
        ? [{ label: { ...label, workspaceId: null }, pinned: true }]
        : [];
    for (const variables of pins)
      setPinned(variables, {
        onError: () => toast.error(t("navigation:pinnedLabels.error")),
      });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <SidebarGroupAction
            className="top-2 right-2 text-sidebar-foreground/70"
            title={title}
          />
        }
      >
        <Plus />
        <span className="sr-only">{title}</span>
      </PopoverTrigger>
      <PopoverContent align="start" side="right" className="w-64">
        <FilterSubjectPanel
          subject={{
            id: "pinned-labels",
            kind: "core",
            label: t("navigation:pinnedLabels.title"),
            icon: null,
            operators: { positive: "", negative: "" },
            options: (meta?.labels ?? []).map((label) => ({
              value: label.name,
              label: label.name,
              icon: <LabelFilterDot color={label.color} />,
            })),
            selected: (meta?.labels ?? [])
              .filter((label) => pinnedNames.has(label.name.toLowerCase()))
              .map((label) => label.name),
            negated: false,
            onToggle: toggle,
            onNegate: () => undefined,
            onClear: () => undefined,
            emptyLabel: meta
              ? t("tasks:labels.empty")
              : t("common:empty.loading"),
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
