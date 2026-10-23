import { Clock } from "lucide-react";
import { createElement } from "react";
import type { OptionMenuItem } from "@/components/common/option-menu/option-menu-item";
import { getColumnIcon } from "@/lib/column";
import { getStatusDisplayLabel } from "@/lib/i18n/domain";

type StatusColumn = {
  slug: string;
  name: string;
  icon?: string | null;
  isFinal: boolean;
};

export function statusMenuOptions(
  columns: StatusColumn[],
  current: string | null | undefined,
  backlogLabel?: string,
): OptionMenuItem[] {
  const options = columns.map((column) => ({
    value: column.slug,
    label: getStatusDisplayLabel(column.slug, column.name),
    icon: getColumnIcon(column.slug, column.isFinal, column.icon),
    selected: column.slug === current,
  }));
  // The backlog is no board column, but a task can be sent back to it.
  return backlogLabel
    ? [
        ...options,
        {
          value: "planned",
          label: backlogLabel,
          icon: createElement(Clock),
          selected: current === "planned",
        },
      ]
    : options;
}
