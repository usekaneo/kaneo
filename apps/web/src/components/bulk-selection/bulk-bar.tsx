import {
  Archive,
  ArrowDownToLine,
  ArrowUpToLine,
  CircleDashed,
  SignalHigh,
  Tag,
  Trash2,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Toolbar } from "../ui/toolbar";
import { barButtonClass } from "./bar-button-class";
import { BarTooltip } from "./bar-tooltip";
import {
  BulkActionCommand,
  type BulkCommandGroup,
  type BulkCommandItem,
} from "./bulk-action-command";
import { BulkCountChip } from "./bulk-count-chip";
import { BulkDeleteConfirm } from "./bulk-delete-confirm";
import { BulkDueDatePopover } from "./bulk-due-date-popover";
import { BulkMoreMenu } from "./bulk-more-menu";
import { type BulkOption, BulkOptionPopover } from "./bulk-option-popover";
import { toolbarPresenceClass } from "./toolbar-presence-class";
import { useBulkActions } from "./use-bulk-actions";
import { useBulkOptions } from "./use-bulk-options";
import { useBulkSelectionKeys } from "./use-bulk-selection-keys";
import { useToolbarPresence } from "./use-toolbar-presence";

type BulkBarProps = {
  variant: "board" | "backlog";
  selectedTaskIds: Set<string>;
  clearSelection: () => void;
  selectAll: () => void;
};

const toCommandItems = (
  prefix: string,
  options: BulkOption[],
  run: (value: string) => unknown,
): BulkCommandItem[] =>
  options.map((option) => ({
    value: `${prefix}-${option.value}`,
    label: option.label,
    icon: option.icon,
    onRun: () => void run(option.value),
  }));

export function BulkBar({
  variant,
  selectedTaskIds,
  clearSelection,
  selectAll,
}: BulkBarProps) {
  const { t } = useTranslation();
  const actions = useBulkActions(selectedTaskIds, clearSelection);
  const options = useBulkOptions(actions);
  const { mounted, hidden, displayCount } = useToolbarPresence(actions.count);
  const [commandOpen, setCommandOpen] = useState(false);
  useBulkSelectionKeys({ selectAll, clearSelection });

  const can = actions.permissions;
  if (!mounted) return null;
  if (!can.edit && !can.delete && !can.assign && !can.labels) return null;

  const groups: BulkCommandGroup[] = [
    variant === "board" && can.edit
      ? {
          value: "status",
          label: t("tasks:bulk.changeStatus"),
          items: toCommandItems(
            "status",
            options.columnOptions,
            actions.changeStatus,
          ),
        }
      : null,
    can.edit
      ? {
          value: "priority",
          label: t("tasks:bulk.setPriority"),
          items: toCommandItems(
            "priority",
            options.priorityOptions,
            actions.setPriority,
          ),
        }
      : null,
    can.assign
      ? {
          value: "assign",
          label: t("tasks:bulk.assignTo"),
          items: toCommandItems(
            "assign",
            options.memberOptions,
            actions.assign,
          ),
        }
      : null,
    can.labels
      ? {
          value: "label",
          label: t("tasks:bulk.addLabel"),
          items: toCommandItems(
            "label",
            options.labelOptions,
            actions.addLabel,
          ),
        }
      : null,
    can.edit || can.delete
      ? {
          value: "actions",
          label: t("tasks:bulk.actions"),
          items: [
            ...(can.edit
              ? [
                  {
                    value: "bulk-archive",
                    label: t("tasks:bulk.archive"),
                    icon: <Archive className="size-4 text-muted-foreground" />,
                    onRun: () => void actions.archive(),
                  },
                ]
              : []),
            ...(can.delete
              ? [
                  {
                    value: "bulk-delete",
                    label: t("tasks:bulk.delete"),
                    icon: <Trash2 className="size-4 text-muted-foreground" />,
                    onRun: actions.deleteConfirm.request,
                  },
                ]
              : []),
          ],
        }
      : null,
  ].filter((group): group is BulkCommandGroup => Boolean(group?.items.length));

  const moveLabel =
    variant === "board"
      ? t("tasks:bulk.moveToBacklog")
      : t("tasks:bulk.moveToBoard");

  return (
    <div
      inert={hidden}
      className={cn(
        "-translate-x-1/2 fixed bottom-6 left-1/2 z-50 transition-[translate,opacity,visibility] ease-out max-sm:right-4 max-sm:left-4 max-sm:translate-x-0",
        toolbarPresenceClass(hidden),
      )}
    >
      <Toolbar className="h-10 items-center gap-0.5 rounded-xl border-border/80 bg-popover px-1.5 py-0 shadow-lg/8 max-sm:h-12 max-sm:justify-between">
        <BulkCountChip count={displayCount} onClear={clearSelection} />
        <div className="ms-1.5 flex items-center gap-0.5">
          {variant === "board" && can.edit && (
            <BulkOptionPopover
              icon={<CircleDashed />}
              label={t("tasks:status.label")}
              placeholder={t("tasks:bulk.statusPlaceholder")}
              options={options.columnOptions}
              onSelect={(value) => void actions.changeStatus(value)}
            />
          )}
          {can.edit && (
            <BulkOptionPopover
              icon={<SignalHigh />}
              label={t("tasks:priority.label")}
              placeholder={t("tasks:bulk.priorityPlaceholder")}
              options={options.priorityOptions}
              onSelect={(value) => void actions.setPriority(value)}
            />
          )}
          {can.assign && (
            <BulkOptionPopover
              icon={<UserRound />}
              label={t("tasks:assignee.label")}
              placeholder={t("tasks:bulk.assigneePlaceholder")}
              options={options.memberOptions}
              onSelect={(value) => void actions.assign(value)}
            />
          )}
          {can.labels && (
            <BulkOptionPopover
              icon={<Tag />}
              label={t("tasks:properties.labels")}
              placeholder={t("tasks:bulk.labelPlaceholder")}
              options={options.labelOptions}
              onSelect={(value) => void actions.addLabel(value)}
            />
          )}
          {can.edit && (
            <BulkDueDatePopover
              onSelect={(date) => void actions.setDueDate(date)}
            />
          )}
          {can.edit &&
            (variant === "board" ? (
              <BarTooltip label={moveLabel}>
                <button
                  type="button"
                  onClick={() => void actions.moveToBacklog()}
                  className={cn(barButtonClass, "ms-1.5")}
                >
                  <ArrowDownToLine />
                  <span className="max-lg:sr-only">{moveLabel}</span>
                </button>
              </BarTooltip>
            ) : (
              <BulkOptionPopover
                icon={<ArrowUpToLine />}
                label={moveLabel}
                placeholder={t("tasks:bulk.columnPlaceholder")}
                options={options.columnOptions}
                onSelect={(value) => void actions.moveToBoard(value)}
                className="ms-1.5"
              />
            ))}
          {groups.length > 0 && (
            <BulkMoreMenu
              onSearch={() => setCommandOpen(true)}
              onArchive={can.edit ? () => void actions.archive() : undefined}
              onDelete={can.delete ? actions.deleteConfirm.request : undefined}
            />
          )}
        </div>
      </Toolbar>

      <BulkActionCommand
        open={commandOpen}
        onOpenChange={setCommandOpen}
        groups={groups}
      />

      <BulkDeleteConfirm
        open={actions.deleteConfirm.open}
        count={actions.deleteConfirm.count}
        pending={actions.deleteConfirm.pending}
        onOpenChange={actions.deleteConfirm.onOpenChange}
        onConfirm={() => void actions.deleteConfirm.confirm()}
      />
    </div>
  );
}
