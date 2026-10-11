import { View } from "react-native";

import type { TaskLabel } from "@/lib/api/types";
import { formatDueShort, isOverdue } from "@/lib/format";
import { useColors } from "@/theme";

import { StatusIcon } from "./icons";
import { Txt } from "./text";
import { LabelTag, Touch } from "./ui";

/**
 * A task as a full-width row: status icon lane, title over meta (ID, project, labels), due date lane.
 * Fixed-width lanes keep icons and dates aligned down a list.
 */
export function TaskRow({
  title,
  ticket,
  project,
  labels,
  dueDate,
  status,
  statusIcon,
  onPress,
  last,
  compact,
}: {
  title: string;
  ticket?: string;
  project?: string | null;
  labels?: TaskLabel[];
  dueDate?: string | null;
  /** Column slug; drawn with the column's default Kaneo icon. */
  status?: string;
  /** The column's own icon name, when it has one. */
  statusIcon?: string | null;
  onPress?: () => void;
  last?: boolean;
  /** One-line title, used inside grouped cards. */
  compact?: boolean;
}) {
  const c = useColors();
  const overdue = isOverdue(dueDate);
  const due = formatDueShort(dueDate);
  return (
    <Touch
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: compact ? "center" : "flex-start",
        gap: 12,
        paddingHorizontal: compact ? 14 : 16,
        paddingVertical: 12,
        minHeight: compact ? 56 : undefined,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.divider,
      }}
    >
      {status ? (
        <View style={{ width: 16, paddingTop: compact ? 0 : 2 }}>
          <StatusIcon status={status} icon={statusIcon} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: compact ? 2 : 4 }}>
        <Txt
          variant={compact ? "bodySm" : "body"}
          weight="medium"
          numberOfLines={compact ? 1 : 3}
        >
          {title}
        </Txt>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            columnGap: 10,
            rowGap: 2,
          }}
        >
          {ticket ? (
            <Txt variant="mono" tone="muted">
              {ticket}
            </Txt>
          ) : null}
          {project ? (
            <Txt variant="caption" tone="faint" numberOfLines={1}>
              {project}
            </Txt>
          ) : null}
          {!compact &&
            labels?.map((l) => (
              <LabelTag key={l.id} name={l.name} color={l.color} />
            ))}
        </View>
      </View>
      <View
        style={{
          width: 72,
          alignItems: "flex-end",
          paddingTop: compact ? 0 : 2,
        }}
      >
        {due ? (
          <Txt
            variant="caption"
            weight={overdue || due === "Today" ? "medium" : "regular"}
            color={overdue ? c.danger : due === "Today" ? c.ink : c.muted}
          >
            {due}
          </Txt>
        ) : null}
      </View>
    </Touch>
  );
}

/** Group heading inside a list: "Overdue 1", "Today 2". */
export function ListGroupHeader({
  title,
  count,
  danger,
  icon,
}: {
  title: string;
  count?: number;
  danger?: boolean;
  icon?: React.ReactNode;
}) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        height: 36,
        paddingHorizontal: 16,
        backgroundColor: c.ground,
        borderBottomWidth: 1,
        borderBottomColor: c.divider,
      }}
    >
      {icon}
      <Txt variant="meta" weight="semibold" color={danger ? c.danger : c.ink}>
        {title}
      </Txt>
      {count !== undefined ? (
        <Txt variant="caption" tone="faint">
          {count}
        </Txt>
      ) : null}
    </View>
  );
}
