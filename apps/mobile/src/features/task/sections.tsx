import * as WebBrowser from "expo-web-browser";
import { CornerLeftUp, Link2, Play, Plus, X } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { TextInput, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { Avatar } from "@/components/avatar";
import { PriorityIcon, StatusIcon } from "@/components/icons";
import { MarkdownText } from "@/components/markdown";
import {
  Calendar,
  DatePickerSheet,
  TextInputSheet,
} from "@/components/pickers";
import {
  ConfirmDialog,
  MultiSelectSheet,
  OptionSheet,
  SearchField,
  Sheet,
} from "@/components/sheet";
import { Txt } from "@/components/text";
import {
  Button,
  Checkbox,
  IconButton,
  Switch,
  TextField,
  Touch,
} from "@/components/ui";
import { api } from "@/lib/api/endpoints";
import type {
  Activity,
  CustomFieldDefinition,
  Json,
  RelatedTask,
  SearchResult,
  TaskRelation,
  TimeEntry,
  WorkspaceMember,
} from "@/lib/api/types";
import { describeActivity } from "@/lib/describe";
import {
  formatClock,
  formatDate,
  formatDateTime,
  formatDuration,
  relativeLong,
  toIsoDay,
  type Day,
} from "@/lib/format";
import { qk, useAction } from "@/lib/query";
import { font, useColors } from "@/theme";

import { entrySeconds, type TaskExtras } from "./use-task";

export function SectionTitle({
  title,
  count,
  onAdd,
  addLabel,
  trailing,
}: {
  title: string;
  count?: string;
  onAdd?: () => void;
  addLabel?: string;
  trailing?: ReactNode;
}) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: 28,
        paddingBottom: 4,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
        <Txt variant="bodySm" weight="semibold">
          {title}
        </Txt>
        {count ? (
          <Txt variant="mono" tone="faint">
            {count}
          </Txt>
        ) : null}
      </View>
      {trailing}
      {onAdd ? (
        <IconButton
          label={addLabel ?? `Add to ${title}`}
          onPress={onAdd}
          size={28}
        >
          <Plus size={16} color={c.muted} strokeWidth={2} />
        </IconButton>
      ) : null}
    </View>
  );
}

function stringList(value: Json | undefined | null): string[] {
  if (Array.isArray(value))
    return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string") {
    try {
      return stringList(JSON.parse(value) as Json);
    } catch {
      return [];
    }
  }
  return [];
}

// --- Custom fields ---

const MAX_FIELD_CHIPS = 4;

function FieldChip({ label }: { label: string }) {
  const c = useColors();
  return (
    <View
      style={{
        maxWidth: "100%",
        paddingHorizontal: 8,
        height: 24,
        justifyContent: "center",
        borderRadius: 6,
        backgroundColor: c.fill,
        alignSelf: "flex-start",
      }}
    >
      <Txt variant="meta" weight="medium" numberOfLines={1}>
        {label}
      </Txt>
    </View>
  );
}

export function CustomFields({
  taskId,
  extras,
}: {
  taskId: string;
  extras: TaskExtras;
}) {
  const { run } = useAction();
  const [editing, setEditing] = useState<CustomFieldDefinition | null>(null);
  if (!extras.fields.length) return null;
  const valueOf = (id: string) =>
    extras.fieldValues.find((v) => v.fieldId === id)?.value ?? null;
  const set = (fieldId: string, value: string) =>
    run(() => api.setCustomFieldValue(taskId, fieldId, value));

  return (
    <View>
      <SectionTitle title="Fields" />
      {extras.fields.map((f) => {
        const value = valueOf(f.id);
        let display: ReactNode = null;
        if (f.type === "boolean") {
          display = (
            <Switch
              value={value === "true"}
              onChange={(v) => set(f.id, String(v))}
            />
          );
        } else if (f.type === "multiselect") {
          const items = stringList(value);
          const extra = items.length - MAX_FIELD_CHIPS;
          display = items.length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
              {items.slice(0, MAX_FIELD_CHIPS).map((i) => (
                <FieldChip key={i} label={i} />
              ))}
              {extra > 0 ? <FieldChip label={`+${extra}`} /> : null}
            </View>
          ) : null;
        } else if (value) {
          display =
            f.type === "dropdown" ? (
              <FieldChip label={value} />
            ) : (
              <Txt
                variant={f.type === "number" ? "monoMd" : "bodySm"}
                numberOfLines={3}
              >
                {f.type === "date" ? formatDate(value) : value}
              </Txt>
            );
        }
        return (
          <Touch
            key={f.id}
            disabled={f.type === "boolean"}
            onPress={() => setEditing(f)}
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 12,
              minHeight: 40,
              paddingVertical: 8,
            }}
          >
            <Txt
              variant="bodySm"
              tone="muted"
              style={{ width: 112, paddingTop: 2 }}
              numberOfLines={2}
            >
              {f.name}
              {f.required ? " *" : ""}
            </Txt>
            <View style={{ flex: 1, minHeight: 24, justifyContent: "center" }}>
              {display ?? (
                <Txt variant="bodySm" tone="placeholder">
                  Empty
                </Txt>
              )}
            </View>
          </Touch>
        );
      })}

      <DatePickerSheet
        visible={editing?.type === "date"}
        onClose={() => setEditing(null)}
        title={editing?.name ?? ""}
        value={editing ? valueOf(editing.id) : null}
        onPick={(day: Day | null) =>
          editing && set(editing.id, day ? toIsoDay(day) : "")
        }
      />
      <OptionSheet
        visible={editing?.type === "dropdown"}
        onClose={() => setEditing(null)}
        title={editing?.name ?? ""}
        selected={editing ? (valueOf(editing.id) ?? "") : ""}
        options={[
          { value: "", label: "None" },
          ...stringList(editing?.options).map((o) => ({ value: o, label: o })),
        ]}
        onSelect={(v) => editing && set(editing.id, v)}
      />
      <MultiSelectSheet
        visible={editing?.type === "multiselect"}
        onClose={() => setEditing(null)}
        title={editing?.name ?? ""}
        options={stringList(editing?.options)}
        selected={editing ? stringList(valueOf(editing.id)) : []}
        onSave={(values) => editing && set(editing.id, JSON.stringify(values))}
      />
      <TextInputSheet
        visible={!!editing && ["text", "number"].includes(editing.type)}
        onClose={() => setEditing(null)}
        title={editing?.name ?? ""}
        initial={editing ? (valueOf(editing.id) ?? "") : ""}
        multiline={editing?.type === "text"}
        keyboardType={editing?.type === "number" ? "decimal-pad" : "default"}
        validate={(v) => !editing?.required || v.trim().length > 0}
        onSubmit={(v) => editing && set(editing.id, v)}
      />
    </View>
  );
}

// --- Subtasks ---

export function Subtasks({
  taskId,
  relations,
  onOpen,
  onAdd,
}: {
  taskId: string;
  relations: TaskRelation[];
  onOpen: (id: string) => void;
  onAdd: () => void;
}) {
  const c = useColors();
  const { run } = useAction();
  const subtasks = relations
    .filter(
      (r) =>
        r.relationType === "subtask" &&
        r.sourceTaskId === taskId &&
        r.targetTask,
    )
    .map((r) => r.targetTask!);
  const parent = relations.find(
    (r) => r.relationType === "subtask" && r.targetTaskId === taskId,
  )?.sourceTask;
  const done = subtasks.filter((s) => s.isCompleted).length;

  const setDone = (sub: RelatedTask, isDone: boolean) =>
    run(async () => {
      const columns = [...(await api.columns(sub.projectId))].sort(
        (a, b) => (a.position ?? 0) - (b.position ?? 0),
      );
      const target = isDone
        ? ([...columns].reverse().find((col) => col.isFinal) ??
          columns[columns.length - 1])
        : columns.find((col) => !col.isFinal);
      if (target) await api.updateStatus(sub.id, target.slug);
    });

  return (
    <View>
      <SectionTitle
        title="Subtasks"
        count={subtasks.length ? `${done}/${subtasks.length}` : undefined}
        onAdd={onAdd}
        addLabel="Add subtask"
      />
      {parent ? (
        <Touch
          onPress={() => onOpen(parent.id)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            minHeight: 40,
          }}
        >
          <CornerLeftUp size={16} color={c.muted} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Txt variant="micro" tone="faint">
              Parent task
            </Txt>
            <Txt variant="bodySm" numberOfLines={1}>
              {parent.title}
            </Txt>
          </View>
        </Touch>
      ) : null}
      {subtasks.map((s) => (
        <Touch
          key={s.id}
          onPress={() => onOpen(s.id)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            minHeight: 36,
            paddingVertical: 6,
          }}
        >
          <Checkbox
            checked={!!s.isCompleted}
            onPress={() => setDone(s, !s.isCompleted)}
          />
          <Txt
            variant="bodySm"
            tone={s.isCompleted ? "faint" : "ink"}
            strike={!!s.isCompleted}
            style={{ flex: 1 }}
            numberOfLines={2}
          >
            {s.title}
          </Txt>
          {s.assigneeName ? <Avatar name={s.assigneeName} size={20} /> : null}
        </Touch>
      ))}
      {!subtasks.length && !parent ? (
        <Txt variant="meta" tone="faint">
          No subtasks
        </Txt>
      ) : null}
    </View>
  );
}

// --- Relations ---

export function Relations({
  taskId,
  relations,
  workspaceId,
  onOpen,
}: {
  taskId: string;
  relations: TaskRelation[];
  workspaceId?: string | null;
  onOpen: (id: string) => void;
}) {
  const c = useColors();
  const { run } = useAction();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<TaskRelation | null>(null);
  const others = relations.filter((r) => r.relationType !== "subtask");

  return (
    <View>
      <SectionTitle
        title="Relations"
        onAdd={() => setAdding(true)}
        addLabel="Link a task"
      />
      {others.map((r) => {
        const outgoing = r.sourceTaskId === taskId;
        const other = outgoing ? r.targetTask : r.sourceTask;
        if (!other) return null;
        const kind =
          r.relationType === "blocks"
            ? outgoing
              ? "Blocks"
              : "Blocked by"
            : "Related";
        return (
          <Touch
            key={r.id}
            onPress={() => onOpen(other.id)}
            onLongPress={() => setRemoving(r)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              minHeight: 40,
            }}
          >
            <Txt
              variant="caption"
              weight="medium"
              tone={kind === "Related" ? "muted" : "danger"}
              style={{ width: 72 }}
            >
              {kind}
            </Txt>
            <StatusIcon
              status={other.isCompleted ? "done" : "to-do"}
              size={14}
            />
            <Txt
              variant="bodySm"
              tone={other.isCompleted ? "faint" : "ink"}
              strike={!!other.isCompleted}
              numberOfLines={1}
              style={{ flex: 1 }}
            >
              {other.title}
            </Txt>
            <IconButton
              label="Remove relation"
              size={28}
              onPress={() => setRemoving(r)}
            >
              <X size={14} color={c.faint} />
            </IconButton>
          </Touch>
        );
      })}
      {!others.length ? (
        <Txt variant="meta" tone="faint">
          No related tasks
        </Txt>
      ) : null}
      <AddRelationSheet
        visible={adding}
        onClose={() => setAdding(false)}
        taskId={taskId}
        workspaceId={workspaceId}
      />
      <ConfirmDialog
        visible={!!removing}
        title="Remove relation?"
        message="The tasks stay; only the link between them is removed."
        confirmLabel="Remove"
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && run(() => api.deleteRelation(removing.id))}
      />
    </View>
  );
}

function AddRelationSheet({
  visible,
  onClose,
  taskId,
  workspaceId,
}: {
  visible: boolean;
  onClose: () => void;
  taskId: string;
  workspaceId?: string | null;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Link a task">
      <AddRelationBody
        onClose={onClose}
        taskId={taskId}
        workspaceId={workspaceId}
      />
    </Sheet>
  );
}

function AddRelationBody({
  onClose,
  taskId,
  workspaceId,
}: {
  onClose: () => void;
  taskId: string;
  workspaceId?: string | null;
}) {
  const { run } = useAction();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [type, setType] = useState<"related" | "blocks">("related");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);
  const search = useQuery({
    queryKey: qk.search(workspaceId ?? "", debounced, "tasks"),
    queryFn: () => api.search(debounced, workspaceId!, "tasks"),
    enabled: !!debounced && !!workspaceId,
  });
  const results: SearchResult[] = debounced
    ? (search.data?.results ?? []).filter((x) => x.id !== taskId)
    : [];

  return (
    <>
      <View style={{ paddingHorizontal: 20, gap: 10, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {(["related", "blocks"] as const).map((t) => (
            <Button
              key={t}
              label={t === "related" ? "Related to" : "Blocks"}
              kind={type === t ? "primary" : "secondary"}
              size="sm"
              grow
              onPress={() => setType(t)}
            />
          ))}
        </View>
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Search tasks by title or number"
          autoFocus
        />
      </View>
      <View style={{ paddingHorizontal: 8, paddingBottom: 8 }}>
        {results.map((r) => (
          <Touch
            key={r.id}
            onPress={() => {
              void run(() => api.createRelation(taskId, r.id, type));
              onClose();
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              minHeight: 48,
              paddingHorizontal: 12,
            }}
          >
            <PriorityIcon priority={r.priority} />
            <View style={{ flex: 1 }}>
              <Txt variant="bodySm" numberOfLines={1}>
                {r.title}
              </Txt>
              {r.projectName ? (
                <Txt variant="caption" tone="faint">
                  {r.projectName}
                </Txt>
              ) : null}
            </View>
          </Touch>
        ))}
      </View>
    </>
  );
}

// --- Links ---

export function Links({
  taskId,
  extras,
}: {
  taskId: string;
  extras: TaskExtras;
}) {
  const c = useColors();
  const { run } = useAction();
  const [adding, setAdding] = useState(false);

  return (
    <View>
      <SectionTitle
        title="Links"
        onAdd={() => setAdding(true)}
        addLabel="Add link"
      />
      <View style={{ gap: 6 }}>
        {extras.links.map((l) => {
          const synced = !!l.integrationId;
          return (
            <Touch
              key={l.id}
              onPress={() => WebBrowser.openBrowserAsync(l.url)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                minHeight: 48,
                paddingLeft: 12,
                paddingRight: synced ? 12 : 4,
                paddingVertical: 8,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: c.hairline,
              }}
            >
              {synced ? (
                <GitGlyph color={c.successFg} />
              ) : (
                <Link2 size={16} color={c.muted} strokeWidth={2} />
              )}
              <View style={{ flex: 1 }}>
                <Txt variant="bodySm" weight="medium" numberOfLines={1}>
                  {l.title ?? l.url}
                </Txt>
                <Txt variant="mono" tone="muted" numberOfLines={1}>
                  {synced
                    ? l.resourceType.replace(/_/g, " ")
                    : l.url.replace(/^https?:\/\//, "")}
                </Txt>
              </View>
              {synced ? (
                <Txt variant="micro" tone="faint">
                  Synced
                </Txt>
              ) : (
                <IconButton
                  label="Remove link"
                  size={32}
                  onPress={() =>
                    run(() => api.deleteExternalLink(taskId, l.id))
                  }
                >
                  <X size={14} color={c.faint} />
                </IconButton>
              )}
            </Touch>
          );
        })}
        {!extras.links.length ? (
          <Txt variant="meta" tone="faint">
            No links
          </Txt>
        ) : null}
      </View>
      <Sheet visible={adding} onClose={() => setAdding(false)} title="Add link">
        <AddLinkForm
          onCancel={() => setAdding(false)}
          onAdd={(url, title) => {
            void run(() => api.createExternalLink(taskId, url, title));
            setAdding(false);
          }}
        />
      </Sheet>
    </View>
  );
}

function AddLinkForm({
  onCancel,
  onAdd,
}: {
  onCancel: () => void;
  onAdd: (url: string, title: string | null) => void;
}) {
  const c = useColors();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 14 }}>
      <TextField
        label="URL"
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        mono
        autoFocus
        leading={<Link2 size={16} color={c.muted} strokeWidth={2} />}
      />
      <TextField
        label="Title"
        aside="Optional"
        value={title}
        onChangeText={setTitle}
      />
      <View style={{ flexDirection: "row", gap: 8, paddingTop: 4 }}>
        <Button label="Cancel" kind="secondary" grow onPress={onCancel} />
        <Button
          label="Add link"
          grow
          disabled={!url.trim()}
          onPress={() =>
            onAdd(
              /^https?:\/\//i.test(url.trim())
                ? url.trim()
                : `https://${url.trim()}`,
              title.trim() || null,
            )
          }
        />
      </View>
    </View>
  );
}

function GitGlyph({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Circle
        cx={18}
        cy={18}
        r={3}
        fill="none"
        stroke={color}
        strokeWidth={2}
      />
      <Circle cx={6} cy={6} r={3} fill="none" stroke={color} strokeWidth={2} />
      <Path
        d="M13 6h3a2 2 0 0 1 2 2v7M6 9v12"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// --- Time tracking ---

export function TimeTracking({
  taskId,
  ticket,
  title,
  entries,
  currentUserId,
}: {
  taskId: string;
  ticket: string;
  title: string;
  entries: TimeEntry[];
  currentUserId: string;
}) {
  const c = useColors();
  const { run } = useAction();
  const [now, setNow] = useState(() => Date.now());
  const [logging, setLogging] = useState<TimeEntry | "new" | null>(null);
  const running = entries.find((e) => !e.endTime && e.userId === currentUserId);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  const total = entries.reduce((sum, e) => sum + entrySeconds(e, now), 0);

  return (
    <View style={{ gap: 10 }}>
      <SectionTitle
        title="Time"
        count={total ? `${formatDuration(total)} total` : undefined}
        trailing={
          <Touch onPress={() => setLogging("new")} hitSlop={8}>
            <Txt variant="meta" weight="medium" tone="muted">
              Log time
            </Txt>
          </Touch>
        }
      />
      {running ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            height: 52,
            paddingLeft: 14,
            paddingRight: 6,
            borderRadius: 12,
            backgroundColor: c.primary,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: c.dangerRing,
            }}
          />
          <Txt
            style={{
              fontFamily: font.monoMedium,
              fontSize: 18,
              lineHeight: 22,
              flex: 1,
            }}
            color={c.onPrimary}
          >
            {formatClock(entrySeconds(running, now))}
          </Txt>
          <Touch
            onPress={() =>
              run(() =>
                api.updateTimeEntry(running.id, {
                  startTime: running.startTime,
                  endTime: new Date().toISOString(),
                }),
              )
            }
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              height: 40,
              paddingHorizontal: 14,
              borderRadius: 9,
              backgroundColor: c.onPrimary + "1F",
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                backgroundColor: c.onPrimary,
              }}
            />
            <Txt variant="meta" weight="medium" color={c.onPrimary}>
              Stop
            </Txt>
          </Touch>
        </View>
      ) : (
        <Button
          label="Start timer"
          kind="secondary"
          size="md"
          icon={<Play size={14} color={c.ink} strokeWidth={2} />}
          onPress={() =>
            run(() =>
              api.createTimeEntry({
                taskId,
                startTime: new Date().toISOString(),
              }),
            )
          }
          style={{ alignSelf: "flex-start" }}
        />
      )}
      {entries.map((e) => {
        const mine = e.userId === currentUserId;
        return (
          <Touch
            key={e.id}
            disabled={!mine || !e.endTime}
            onPress={() => setLogging(e)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              minHeight: 36,
            }}
          >
            <Avatar name={e.userName ?? "Someone"} size={20} />
            <View style={{ flex: 1 }}>
              <Txt variant="bodySm" tone="body" numberOfLines={1}>
                {formatDateTime(e.startTime)}
                {!e.endTime ? " (running)" : ""}
              </Txt>
              {e.description ? (
                <Txt variant="caption" tone="muted" numberOfLines={2}>
                  {e.description}
                </Txt>
              ) : null}
            </View>
            <Txt variant="monoMd" tone="muted" style={{ fontSize: 12 }}>
              {formatDuration(entrySeconds(e, now))}
            </Txt>
          </Touch>
        );
      })}
      <LogTimeSheet
        visible={!!logging}
        onClose={() => setLogging(null)}
        ticket={ticket}
        title={title}
        entry={logging === "new" ? null : logging}
        onSave={(start, minutes, note) =>
          run(
            () => {
              const end = new Date(
                start.getTime() + minutes * 60_000,
              ).toISOString();
              return logging && logging !== "new"
                ? api.updateTimeEntry(logging.id, {
                    startTime: start.toISOString(),
                    endTime: end,
                    description: note,
                  })
                : api.createTimeEntry({
                    taskId,
                    startTime: start.toISOString(),
                    endTime: end,
                    description: note || undefined,
                  });
            },
            { success: logging === "new" ? "Time logged" : undefined },
          )
        }
      />
    </View>
  );
}

function LogTimeSheet({
  visible,
  onClose,
  ticket,
  title,
  entry,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  ticket: string;
  title: string;
  entry: TimeEntry | null;
  onSave: (start: Date, minutes: number, note: string) => void;
}) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={entry ? "Edit time entry" : "Log time"}
    >
      <LogTimeForm
        ticket={ticket}
        title={title}
        entry={entry}
        onSave={(start, minutes, note) => {
          onSave(start, minutes, note);
          onClose();
        }}
      />
    </Sheet>
  );
}

function initialEntry(entry: TimeEntry | null) {
  const secs = entry ? entrySeconds(entry, Date.now()) : 1800;
  const start = entry ? new Date(entry.startTime) : new Date();
  return {
    hours: String(Math.floor(secs / 3600)),
    minutes: String(Math.floor((secs % 3600) / 60)),
    day: {
      y: start.getFullYear(),
      m: start.getMonth(),
      d: start.getDate(),
    } as Day,
  };
}

function LogTimeForm({
  ticket,
  title,
  entry,
  onSave,
}: {
  ticket: string;
  title: string;
  entry: TimeEntry | null;
  onSave: (start: Date, minutes: number, note: string) => void;
}) {
  const c = useColors();
  const [initial] = useState(() => initialEntry(entry));
  const [hours, setHours] = useState(initial.hours);
  const [minutes, setMinutes] = useState(initial.minutes);
  const [day, setDay] = useState<Day>(initial.day);
  const [picking, setPicking] = useState(false);
  const [note, setNote] = useState(entry?.description ?? "");

  const total = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
  const label = `${Number(hours) ? `${Number(hours)}h ` : ""}${Number(minutes) || 0}m`;
  const numberInput = (
    value: string,
    set: (v: string) => void,
    unit: string,
  ) => (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
      <TextFieldBare
        value={value}
        onChange={(v) => set(v.replace(/\D/g, "").slice(0, 3))}
      />
      <Txt variant="body" tone="muted">
        {unit}
      </Txt>
    </View>
  );
  const dayIso = new Date(day.y, day.m, day.d).toISOString();

  if (picking) {
    return (
      <Calendar
        value={dayIso}
        onPick={(d) => {
          setDay(d);
          setPicking(false);
        }}
      />
    );
  }

  return (
    <>
      <View
        style={{
          paddingHorizontal: 20,
          marginTop: -8,
          paddingBottom: 16,
          flexDirection: "row",
          gap: 8,
        }}
      >
        <Txt variant="mono" tone="muted">
          {ticket}
        </Txt>
        <Txt variant="meta" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
          {title}
        </Txt>
      </View>
      <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 16 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            paddingVertical: 14,
            borderRadius: 12,
            backgroundColor: c.input,
          }}
        >
          {numberInput(hours, setHours, "h")}
          {numberInput(minutes, setMinutes, "m")}
        </View>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {[15, 30, 60, 120].map((m) => (
            <Button
              key={m}
              label={m < 60 ? `${m}m` : `${m / 60}h`}
              kind="secondary"
              size="sm"
              grow
              onPress={() => {
                setHours(String(Math.floor(m / 60)));
                setMinutes(String(m % 60));
              }}
            />
          ))}
        </View>
        <View
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: c.hairline,
            overflow: "hidden",
          }}
        >
          <Touch
            onPress={() => setPicking(true)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              height: 48,
              paddingHorizontal: 14,
              borderBottomWidth: 1,
              borderBottomColor: c.divider,
            }}
          >
            <Txt variant="body" tone="muted">
              Date
            </Txt>
            <Txt variant="body">{formatDate(dayIso)}</Txt>
          </Touch>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="What did you work on?"
            placeholderTextColor={c.placeholder}
            selectionColor={c.ink}
            maxLength={500}
            style={{
              fontFamily: font.regular,
              fontSize: 15,
              color: c.ink,
              minHeight: 48,
              paddingHorizontal: 14,
              paddingVertical: 14,
            }}
          />
        </View>
        <Button
          label={entry ? "Save" : `Log ${label}`}
          disabled={total <= 0}
          onPress={() => {
            const base = entry ? new Date(entry.startTime) : new Date();
            const start = new Date(
              day.y,
              day.m,
              day.d,
              base.getHours(),
              base.getMinutes(),
            );
            // A new entry ends now at the latest, so it starts `total` minutes earlier.
            if (!entry)
              start.setTime(
                Math.min(start.getTime(), Date.now() - total * 60_000),
              );
            onSave(start, total, note.trim());
          }}
        />
      </View>
    </>
  );
}

function TextFieldBare({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const c = useColors();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      keyboardType="number-pad"
      selectTextOnFocus
      selectionColor={c.ink}
      style={{
        fontFamily: font.monoMedium,
        fontSize: 40,
        lineHeight: 46,
        color: c.ink,
        minWidth: 28,
        textAlign: "right",
        padding: 0,
      }}
    />
  );
}

// --- Activity ---

export function ActivityFeed({
  activities,
  members,
  currentUserId,
  currentUserName,
  statusNames,
}: {
  activities: Activity[];
  members: WorkspaceMember[];
  currentUserId: string;
  currentUserName: string;
  statusNames: Record<string, string>;
}) {
  const c = useColors();
  const { run } = useAction();
  const [menuFor, setMenuFor] = useState<Activity | null>(null);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [deleting, setDeleting] = useState<Activity | null>(null);

  return (
    <View
      style={{
        gap: 14,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: c.divider,
      }}
    >
      <Txt variant="bodySm" weight="semibold">
        Activity
      </Txt>
      {activities.map((a) => {
        const member = members.find((m) => m.id === a.userId);
        const name =
          member?.name ??
          a.externalUserName ??
          (a.userId ? "Someone" : "Kaneo");
        if (a.type !== "comment") {
          return (
            <View
              key={a.id}
              style={{
                flexDirection: "row",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <View style={{ width: 24, alignItems: "center", paddingTop: 6 }}>
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: c.placeholder,
                  }}
                />
              </View>
              <Txt
                variant="meta"
                tone="muted"
                style={{ flex: 1, lineHeight: 18 }}
              >
                {name}{" "}
                {describeActivity(a.type, a.eventData, a.content, statusNames)}
              </Txt>
              <Txt variant="caption" tone="faint">
                {relativeLong(a.createdAt).replace(" ago", "")}
              </Txt>
            </View>
          );
        }
        const mine = a.userId === currentUserId;
        const mentionsMe =
          (a.content ?? "").includes(`id="${currentUserId}"`) ||
          (a.content ?? "").includes(`@${currentUserName}`);
        const edited = a.updatedAt && a.updatedAt !== a.createdAt;
        return (
          <View key={a.id} style={{ flexDirection: "row", gap: 12 }}>
            <Avatar name={name} image={member?.image} size={24} />
            <Touch
              disabled={!mine}
              onLongPress={() => setMenuFor(a)}
              style={{
                flex: 1,
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: mentionsMe ? c.mentionBg : c.input,
                borderWidth: mentionsMe ? 1 : 0,
                borderColor: c.mentionBorder,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                }}
              >
                <Txt variant="meta" weight="semibold">
                  {name}
                </Txt>
                <Txt variant="caption" tone="faint">
                  {relativeLong(a.createdAt)}
                  {edited ? ", edited" : ""}
                </Txt>
              </View>
              <MarkdownText size={14}>{a.content ?? ""}</MarkdownText>
            </Touch>
          </View>
        );
      })}
      <OptionSheet
        visible={!!menuFor}
        onClose={() => setMenuFor(null)}
        title="Comment"
        options={[
          { value: "edit", label: "Edit" },
          { value: "delete", label: "Delete", tone: "danger" as const },
        ]}
        onSelect={(v) =>
          v === "edit" ? setEditing(menuFor) : setDeleting(menuFor)
        }
      />
      <TextInputSheet
        visible={!!editing}
        onClose={() => setEditing(null)}
        title="Edit comment"
        initial={editing?.content ?? ""}
        multiline
        onSubmit={(text) =>
          editing && run(() => api.updateComment(editing.id, text))
        }
      />
      <ConfirmDialog
        visible={!!deleting}
        title="Delete comment?"
        message="This can't be undone."
        confirmLabel="Delete"
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && run(() => api.deleteComment(deleting.id))}
      />
    </View>
  );
}
