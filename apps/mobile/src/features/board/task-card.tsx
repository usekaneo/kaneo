import { CalendarDays, ListTree } from "lucide-react-native";
import { View } from "react-native";

import { Avatar } from "@/components/avatar";
import { PriorityIcon } from "@/components/icons";
import { Txt } from "@/components/text";
import { LabelTag, Touch } from "@/components/ui";
import type { BoardTask } from "@/lib/api/types";
import { daysOverdue, formatDate, isOverdue, ticketId } from "@/lib/format";
import { useColors } from "@/theme";

/** The web board card: mono ID, title, label dots, a meta row; overdue cards get a red ring. */
export function TaskCard({
  task,
  projectSlug,
  onPress,
  onLongPress,
}: {
  task: BoardTask;
  projectSlug?: string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const c = useColors();
  const overdue = isOverdue(task.dueDate);
  const late = daysOverdue(task.dueDate);
  const subtasks = task.subtaskCounts?.total
    ? `${task.subtaskCounts.completed ?? 0}/${task.subtaskCounts.total}`
    : null;
  const hasMeta =
    (task.priority && task.priority !== "no-priority") ||
    task.dueDate ||
    subtasks;
  return (
    <Touch
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={{
        gap: 10,
        padding: 14,
        borderRadius: 10,
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: overdue ? c.dangerRing : c.hairline,
        ...(overdue
          ? {
              shadowColor: c.dangerRing,
              shadowOpacity: 0.25,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 0 },
            }
          : {
              shadowColor: "#000",
              shadowOpacity: 0.04,
              shadowRadius: 1,
              shadowOffset: { width: 0, height: 1 },
            }),
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: 22,
        }}
      >
        <Txt variant="mono" tone="muted">
          {ticketId(projectSlug, task.number)}
        </Txt>
        {task.assigneeName ? (
          <Avatar
            name={task.assigneeName}
            image={task.assigneeImage}
            size={22}
          />
        ) : null}
      </View>
      <Txt variant="card" color={c.ink}>
        {task.title}
      </Txt>
      {task.labels?.length ? (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            columnGap: 12,
            rowGap: 4,
          }}
        >
          {task.labels.map((l) => (
            <LabelTag key={l.id} name={l.name} color={l.color} />
          ))}
        </View>
      ) : null}
      {hasMeta ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            paddingTop: 2,
          }}
        >
          {task.priority && task.priority !== "no-priority" ? (
            <PriorityIcon priority={task.priority} />
          ) : null}
          {subtasks ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
            >
              <ListTree size={14} color={c.muted} strokeWidth={2} />
              <Txt variant="caption" tone="muted">
                {subtasks}
              </Txt>
            </View>
          ) : null}
          {task.dueDate ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
            >
              <CalendarDays
                size={14}
                color={overdue ? c.danger : c.muted}
                strokeWidth={2}
              />
              <Txt
                variant="caption"
                weight={overdue ? "medium" : "regular"}
                color={overdue ? c.danger : c.muted}
              >
                {formatDate(task.dueDate)}
                {overdue ? `, ${late}d overdue` : ""}
              </Txt>
            </View>
          ) : null}
        </View>
      ) : null}
    </Touch>
  );
}
