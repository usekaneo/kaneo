import { CalendarDays, CalendarPlus, Tag } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { View } from "react-native";

import { Avatar, EmptyAvatar } from "@/components/avatar";
import { PriorityIcon, StatusIcon } from "@/components/icons";
import { DatePickerSheet } from "@/components/pickers";
import { OptionSheet } from "@/components/sheet";
import { Txt } from "@/components/text";
import { LabelDot, Touch } from "@/components/ui";
import { api } from "@/lib/api/endpoints";
import type { WorkspaceMember } from "@/lib/api/types";
import { daysOverdue, formatDate, isOverdue, toApiDate } from "@/lib/format";
import { useAction } from "@/lib/query";
import {
  PRIORITIES,
  priorityLabel,
  STATUS_ARCHIVED,
  STATUS_PLANNED,
} from "@/lib/style";
import { useColors } from "@/theme";

import { LabelPickerSheet } from "./label-picker";
import { statusName, type TaskDetail } from "./use-task";

type Picker =
  | "status"
  | "priority"
  | "assignee"
  | "due"
  | "start"
  | "labels"
  | null;

function PropChip({
  children,
  onPress,
  danger,
  dashed,
}: {
  children: ReactNode;
  onPress: () => void;
  danger?: boolean;
  dashed?: boolean;
}) {
  const c = useColors();
  return (
    <Touch
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        height: 32,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderStyle: dashed ? "dashed" : "solid",
        borderColor: danger
          ? c.dangerBorder
          : dashed
            ? c.fillStrong
            : c.hairline,
        backgroundColor: danger ? c.dangerSoft : "transparent",
      }}
    >
      {children}
    </Touch>
  );
}

export function Properties({
  detail,
  members,
  currentUserId,
  workspaceId,
}: {
  detail: TaskDetail;
  members: WorkspaceMember[];
  currentUserId: string;
  workspaceId?: string | null;
}) {
  const c = useColors();
  const { run } = useAction();
  const [picker, setPicker] = useState<Picker>(null);
  const { task, columns, labels } = detail;
  const assignee = members.find(
    (m) => m.id === (task.assigneeId ?? task.userId),
  );
  const assigneeName = assignee?.name ?? task.assigneeName;
  const overdue = isOverdue(task.dueDate);
  const late = daysOverdue(task.dueDate);
  const column = columns.find((col) => col.slug === task.status);
  const close = () => setPicker(null);

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <PropChip onPress={() => setPicker("status")}>
        <StatusIcon
          status={task.status}
          icon={column?.icon}
          isFinal={column?.isFinal}
          size={14}
        />
        <Txt variant="meta" weight="medium">
          {statusName(task.status, columns)}
        </Txt>
      </PropChip>
      <PropChip
        onPress={() => setPicker("priority")}
        dashed={!task.priority || task.priority === "no-priority"}
      >
        <PriorityIcon priority={task.priority} />
        <Txt
          variant="meta"
          weight="medium"
          tone={
            !task.priority || task.priority === "no-priority" ? "muted" : "ink"
          }
        >
          {task.priority && task.priority !== "no-priority"
            ? priorityLabel(task.priority)
            : "Priority"}
        </Txt>
      </PropChip>
      <PropChip
        onPress={() => setPicker("due")}
        danger={overdue}
        dashed={!task.dueDate}
      >
        <CalendarDays
          size={14}
          color={overdue ? c.danger : task.dueDate ? c.ink2 : c.muted}
          strokeWidth={2}
        />
        <Txt
          variant="meta"
          weight="medium"
          color={overdue ? c.danger : task.dueDate ? c.ink : c.muted}
        >
          {task.dueDate
            ? `${formatDate(task.dueDate)}${overdue ? `, ${late} day${late === 1 ? "" : "s"} overdue` : ""}`
            : "Due date"}
        </Txt>
      </PropChip>
      <PropChip onPress={() => setPicker("assignee")} dashed={!assigneeName}>
        {assigneeName ? (
          <Avatar name={assigneeName} image={assignee?.image} size={20} />
        ) : (
          <EmptyAvatar size={18} />
        )}
        <Txt
          variant="meta"
          weight="medium"
          tone={assigneeName ? "ink" : "muted"}
        >
          {assigneeName ?? "Assignee"}
        </Txt>
      </PropChip>
      <PropChip onPress={() => setPicker("labels")} dashed={!labels.length}>
        {labels.length ? (
          labels.map((l) => (
            <View
              key={l.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                marginRight: 4,
              }}
            >
              <LabelDot color={l.color} />
              <Txt variant="meta" weight="medium">
                {l.name}
              </Txt>
            </View>
          ))
        ) : (
          <>
            <Tag size={14} color={c.muted} strokeWidth={2} />
            <Txt variant="meta" weight="medium" tone="muted">
              Labels
            </Txt>
          </>
        )}
      </PropChip>
      <PropChip onPress={() => setPicker("start")} dashed={!task.startDate}>
        {task.startDate ? (
          <CalendarDays size={14} color={c.ink2} strokeWidth={2} />
        ) : (
          <CalendarPlus size={14} color={c.muted} strokeWidth={2} />
        )}
        <Txt
          variant="meta"
          weight="medium"
          tone={task.startDate ? "ink" : "muted"}
        >
          {task.startDate
            ? `Starts ${formatDate(task.startDate)}`
            : "Start date"}
        </Txt>
      </PropChip>

      <OptionSheet
        visible={picker === "status"}
        onClose={close}
        title="Status"
        selected={task.status}
        options={[
          {
            value: STATUS_PLANNED,
            label: "Backlog",
            leading: <StatusIcon status={STATUS_PLANNED} />,
          },
          ...columns.map((col) => ({
            value: col.slug,
            label: col.name,
            hint: col.isFinal ? "Done column" : null,
            leading: (
              <StatusIcon
                status={col.slug}
                icon={col.icon}
                isFinal={col.isFinal}
              />
            ),
          })),
          {
            value: STATUS_ARCHIVED,
            label: "Archived",
            leading: <StatusIcon status={STATUS_ARCHIVED} />,
          },
        ]}
        onSelect={(status) => run(() => api.updateStatus(task.id, status))}
      />
      <OptionSheet
        visible={picker === "priority"}
        onClose={close}
        title="Priority"
        selected={task.priority ?? "no-priority"}
        options={[...PRIORITIES].reverse().map((p) => ({
          value: p.value as string,
          label: p.label,
          leading: <PriorityIcon priority={p.value} size={16} />,
        }))}
        onSelect={(priority) =>
          run(() => api.updatePriority(task.id, priority))
        }
      />
      <OptionSheet
        visible={picker === "assignee"}
        onClose={close}
        title="Assignee"
        searchable
        searchPlaceholder="Search people"
        selected={task.assigneeId ?? task.userId ?? null}
        options={[
          {
            value: null as string | null,
            label: "Unassigned",
            leading: <EmptyAvatar size={28} />,
          },
          ...members.map((m) => ({
            value: m.id as string | null,
            label: m.id === currentUserId ? `${m.name} (you)` : m.name,
            hint: m.email,
            leading: <Avatar name={m.name} image={m.image} size={28} />,
          })),
        ]}
        onSelect={(userId) => run(() => api.updateAssignee(task.id, userId))}
      />
      <DatePickerSheet
        visible={picker === "due"}
        onClose={close}
        title="Due date"
        value={task.dueDate}
        onPick={(day) =>
          run(() => api.updateDueDate(task.id, day ? toApiDate(day) : null))
        }
      />
      <DatePickerSheet
        visible={picker === "start"}
        onClose={close}
        title="Start date"
        value={task.startDate}
        // Start date has no dedicated route; the full update replaces every field, so send them all.
        onPick={(day) =>
          run(() =>
            api.updateTask(task.id, {
              title: task.title,
              description: null,
              startDate: day ? toApiDate(day) : null,
              dueDate: task.dueDate ?? null,
              priority: task.priority || "no-priority",
              status: task.status,
              projectId: task.projectId,
              position: Math.max(0, Math.floor(task.position ?? 0)),
              userId: task.userId ?? null,
            }),
          )
        }
      />
      <LabelPickerSheet
        visible={picker === "labels"}
        onClose={close}
        taskId={task.id}
        attached={labels}
        workspaceId={workspaceId}
      />
    </View>
  );
}
