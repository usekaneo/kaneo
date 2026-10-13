import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  ExternalLink,
  UserRound,
  Users,
} from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { View } from "react-native";

import { Avatar, EmptyAvatar } from "@/components/avatar";
import { PriorityIcon, StatusIcon } from "@/components/icons";
import { OptionSheet, Sheet } from "@/components/sheet";
import { Txt } from "@/components/text";
import {
  Button,
  Chip,
  Divider,
  LabelDot,
  Switch,
  Touch,
} from "@/components/ui";
import type { BoardTask, Label, WorkspaceMember } from "@/lib/api/types";
import { ticketId } from "@/lib/format";
import {
  PRIORITIES,
  priorityLabel,
  STATUS_ARCHIVED,
  STATUS_PLANNED,
} from "@/lib/style";
import { useColors } from "@/theme";

import {
  emptyFilters,
  UNASSIGNED,
  type BoardFilters,
  type Lane,
} from "./model";

const toggle = (list: string[], v: string) =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

export function FilterSheet({
  visible,
  onClose,
  filters,
  setFilters,
  members,
  labels,
  currentUserId,
  showPlanned,
  setShowPlanned,
  showArchived,
  setShowArchived,
  matching,
}: {
  visible: boolean;
  onClose: () => void;
  filters: BoardFilters;
  setFilters: (f: BoardFilters) => void;
  members: WorkspaceMember[];
  labels: Label[];
  currentUserId: string;
  showPlanned: boolean;
  setShowPlanned: (v: boolean) => void;
  showArchived: boolean;
  setShowArchived: (v: boolean) => void;
  matching: number;
}) {
  const me = members.find((m) => m.id === currentUserId);
  const others = members.filter((m) => m.id !== currentUserId);
  const group = (title: string, children: ReactNode) => (
    <View style={{ gap: 8 }}>
      <Txt variant="caption" weight="medium" tone="muted">
        {title}
      </Txt>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {children}
      </View>
    </View>
  );
  const assignee = (id: string) => () =>
    setFilters({ ...filters, assignees: toggle(filters.assignees, id) });

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Filters"
      aside={
        <Touch
          onPress={() => setFilters({ ...emptyFilters, query: filters.query })}
          hitSlop={8}
        >
          <Txt variant="bodySm" weight="medium" tone="muted">
            Reset
          </Txt>
        </Touch>
      }
    >
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: 12,
          gap: 18,
        }}
      >
        {group(
          "Assignee",
          <>
            {me ? (
              <Chip
                label="Me"
                selected={filters.assignees.includes(me.id)}
                onPress={assignee(me.id)}
                leading={<Avatar name={me.name} image={me.image} size={20} />}
              />
            ) : null}
            {others.map((m) => (
              <Chip
                key={m.id}
                label={m.name.split(" ")[0]}
                selected={filters.assignees.includes(m.id)}
                onPress={assignee(m.id)}
                leading={<Avatar name={m.name} image={m.image} size={20} />}
              />
            ))}
            <Chip
              label="Unassigned"
              dashed={!filters.assignees.includes(UNASSIGNED)}
              selected={filters.assignees.includes(UNASSIGNED)}
              onPress={assignee(UNASSIGNED)}
            />
          </>,
        )}
        {group(
          "Priority",
          PRIORITIES.filter((p) => p.value !== "no-priority")
            .reverse()
            .map((p) => {
              const selected = filters.priorities.includes(p.value);
              return (
                <Chip
                  key={p.value}
                  label={p.label}
                  selected={selected}
                  onPress={() =>
                    setFilters({
                      ...filters,
                      priorities: toggle(filters.priorities, p.value),
                    })
                  }
                  leading={<PriorityIcon priority={p.value} />}
                />
              );
            }),
        )}
        {labels.length
          ? group(
              "Labels",
              labels.map((l) => (
                <Chip
                  key={l.id}
                  label={l.name}
                  selected={filters.labels.includes(l.name)}
                  onPress={() =>
                    setFilters({
                      ...filters,
                      labels: toggle(filters.labels, l.name),
                    })
                  }
                  leading={<LabelDot color={l.color} />}
                />
              )),
            )
          : null}
        <View>
          <Divider />
          <ToggleRow
            label="Overdue only"
            value={filters.overdueOnly}
            onChange={(v) => setFilters({ ...filters, overdueOnly: v })}
          />
          <Divider />
          <ToggleRow
            label="Show planned"
            hint="Tasks not on the board yet"
            value={showPlanned}
            onChange={setShowPlanned}
          />
          <Divider />
          <ToggleRow
            label="Show archived"
            value={showArchived}
            onChange={setShowArchived}
          />
        </View>
        <Button
          label={`Show ${matching} task${matching === 1 ? "" : "s"}`}
          onPress={onClose}
        />
      </View>
    </Sheet>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Touch
      onPress={() => onChange(!value)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 52,
        paddingVertical: 8,
        gap: 12,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="bodySm">{label}</Txt>
        {hint ? (
          <Txt variant="caption" tone="faint">
            {hint}
          </Txt>
        ) : null}
      </View>
      <Switch value={value} onChange={onChange} />
    </Touch>
  );
}

export function QuickActionsSheet({
  task,
  lane,
  lanes,
  projectSlug,
  members,
  currentUserId,
  onClose,
  onMove,
  onAssign,
  onPriority,
  onReorder,
  onOpen,
}: {
  task: BoardTask | null;
  lane: Lane | null;
  lanes: Lane[];
  projectSlug?: string;
  members: WorkspaceMember[];
  currentUserId: string;
  onClose: () => void;
  onMove: (status: string) => void;
  onAssign: (userId: string | null) => void;
  onPriority: (priority: string) => void;
  onReorder: (toTop: boolean) => void;
  onOpen: () => void;
}) {
  const c = useColors();
  const [picker, setPicker] = useState<"assignee" | "priority" | null>(null);
  const targets = lanes.filter((l) => l.status !== STATUS_ARCHIVED);
  const assignee = members.find(
    (m) => m.id === (task?.assigneeId ?? task?.userId),
  );
  const act = (fn: () => void) => () => {
    onClose();
    fn();
  };
  const row = (
    icon: ReactNode,
    label: string,
    onPress: () => void,
    value?: string,
  ) => (
    <Touch
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        height: 48,
        paddingHorizontal: 12,
      }}
    >
      {icon}
      <Txt variant="body" style={{ flex: 1 }}>
        {label}
      </Txt>
      {value ? (
        <>
          <Txt variant="bodySm" tone="muted">
            {value}
          </Txt>
          <ChevronRight size={16} color={c.placeholder} />
        </>
      ) : null}
    </Touch>
  );

  return (
    <>
      <Sheet visible={!!task && !picker} onClose={onClose}>
        {task ? (
          <>
            <View
              style={{
                paddingHorizontal: 20,
                paddingTop: 10,
                paddingBottom: 16,
                gap: 4,
                borderBottomWidth: 1,
                borderBottomColor: c.divider,
              }}
            >
              <Txt variant="mono" tone="muted">
                {ticketId(projectSlug, task.number)}
              </Txt>
              <Txt variant="section" style={{ fontSize: 17, lineHeight: 22 }}>
                {task.title}
              </Txt>
            </View>
            <View
              style={{
                paddingHorizontal: 20,
                paddingTop: 16,
                paddingBottom: 8,
                gap: 8,
              }}
            >
              <Txt variant="caption" weight="medium" tone="muted">
                Move to
              </Txt>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {targets.slice(0, 5).map((l) => {
                  const current = l.status === lane?.status;
                  return (
                    <Touch
                      key={l.status}
                      onPress={act(() => onMove(l.status))}
                      disabled={current}
                      style={{
                        flex: 1,
                        height: 64,
                        borderRadius: 10,
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        paddingHorizontal: 4,
                        borderWidth: current ? 1.5 : 1,
                        borderColor: current ? c.ink : c.hairline,
                        backgroundColor: current ? c.fill : "transparent",
                      }}
                    >
                      <StatusIcon
                        status={l.status}
                        icon={l.icon}
                        isFinal={l.isFinal}
                      />
                      <Txt
                        variant="caption"
                        weight={current ? "semibold" : "medium"}
                        numberOfLines={1}
                      >
                        {l.name}
                      </Txt>
                    </Touch>
                  );
                })}
              </View>
              {targets.length > 5 ? (
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                >
                  {targets.slice(5).map((l) => (
                    <Chip
                      key={l.status}
                      label={l.name}
                      onPress={act(() => onMove(l.status))}
                    />
                  ))}
                </View>
              ) : null}
            </View>
            <View style={{ padding: 8 }}>
              {task.assigneeId !== currentUserId
                ? row(
                    <UserRound size={18} color={c.ink2} />,
                    "Assign to me",
                    act(() => onAssign(currentUserId)),
                  )
                : null}
              {row(
                <Users size={18} color={c.ink2} />,
                "Assignee",
                () => setPicker("assignee"),
                assignee?.name ?? task.assigneeName ?? "Unassigned",
              )}
              {row(
                <PriorityIcon
                  priority={
                    task.priority === "no-priority" ? "high" : task.priority
                  }
                  size={18}
                />,
                "Priority",
                () => setPicker("priority"),
                priorityLabel(task.priority),
              )}
              {lane &&
              lane.status !== STATUS_PLANNED &&
              lane.status !== STATUS_ARCHIVED ? (
                <>
                  {row(
                    <ArrowUp size={18} color={c.ink2} />,
                    "Send to top of column",
                    act(() => onReorder(true)),
                  )}
                  {row(
                    <ArrowDown size={18} color={c.ink2} />,
                    "Send to bottom of column",
                    act(() => onReorder(false)),
                  )}
                </>
              ) : null}
              {row(
                <ExternalLink size={18} color={c.ink2} />,
                "Open task",
                act(onOpen),
              )}
            </View>
          </>
        ) : null}
      </Sheet>
      <OptionSheet
        visible={picker === "assignee"}
        onClose={() => {
          setPicker(null);
          onClose();
        }}
        title="Assignee"
        searchable
        searchPlaceholder="Search people"
        selected={task?.assigneeId ?? task?.userId ?? null}
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
        onSelect={onAssign}
      />
      <OptionSheet
        visible={picker === "priority"}
        onClose={() => {
          setPicker(null);
          onClose();
        }}
        title="Priority"
        selected={task?.priority ?? "no-priority"}
        options={PRIORITIES.map((p) => ({
          value: p.value as string,
          label: p.label,
          leading: <PriorityIcon priority={p.value} size={16} />,
        }))}
        onSelect={onPriority}
      />
    </>
  );
}
