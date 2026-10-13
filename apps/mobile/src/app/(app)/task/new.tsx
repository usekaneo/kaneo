import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Plus,
} from "lucide-react-native";
import { useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from "react-native";

import { Avatar, EmptyAvatar } from "@/components/avatar";
import { PriorityIcon, ProjectIcon, StatusIcon } from "@/components/icons";
import { DatePickerSheet, TextInputSheet } from "@/components/pickers";
import { BackButton, Screen } from "@/components/screen";
import { MultiSelectSheet, OptionSheet, Sheet } from "@/components/sheet";
import { Txt } from "@/components/text";
import { Checkbox, LabelDot, Switch, Touch } from "@/components/ui";
import { api } from "@/lib/api/endpoints";
import type { CustomFieldDefinition, Json } from "@/lib/api/types";
import { formatDate, toApiDate, toIsoDay, type Day } from "@/lib/format";
import { useMembers, useWorkspaceLabels } from "@/lib/hooks";
import { qk, useAction } from "@/lib/query";
import { useRequiredSession } from "@/lib/session";
import { PRIORITIES, priorityLabel, STATUS_PLANNED } from "@/lib/style";
import { font, useColors } from "@/theme";

type Picker =
  | "status"
  | "priority"
  | "assignee"
  | "start"
  | "due"
  | "labels"
  | "project"
  | null;

function options(value: Json | undefined): string[] {
  if (Array.isArray(value))
    return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string") {
    try {
      return options(JSON.parse(value) as Json);
    } catch {
      return [];
    }
  }
  return [];
}

function dayIso(day: Day | null) {
  return day ? new Date(day.y, day.m, day.d).toISOString() : null;
}

export default function NewTaskScreen() {
  const params = useLocalSearchParams<{
    projectId: string;
    workspaceId: string;
    status?: string;
    parentTaskId?: string;
  }>();
  const c = useColors();
  const session = useRequiredSession();
  const { run, busy } = useAction();
  const [projectId, setProjectId] = useState(params.projectId);
  const workspaceId = params.workspaceId;

  const columns = useQuery({
    queryKey: qk.columns(projectId),
    queryFn: () => api.columns(projectId),
  });
  const fields = useQuery({
    queryKey: qk.customFields(projectId),
    queryFn: () => api.customFields(projectId),
  });
  const projects = useQuery({
    queryKey: qk.projects(workspaceId, false),
    queryFn: () => api.projects(workspaceId),
  });
  const members = useMembers(workspaceId, projectId);
  const labels = useWorkspaceLabels(workspaceId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string | null>(params.status ?? null);
  const [priority, setPriority] = useState("no-priority");
  const [assignee, setAssignee] = useState<string | null>(null);
  const [start, setStart] = useState<Day | null>(null);
  const [due, setDue] = useState<Day | null>(null);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState<Picker>(null);
  const [fieldEditing, setFieldEditing] =
    useState<CustomFieldDefinition | null>(null);

  const sortedColumns = [...(columns.data ?? [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );
  const effectiveStatus = status ?? sortedColumns[0]?.slug ?? STATUS_PLANNED;
  const statusLabel =
    effectiveStatus === STATUS_PLANNED
      ? "Planned"
      : (sortedColumns.find((col) => col.slug === effectiveStatus)?.name ??
        effectiveStatus);
  const statusIdx = sortedColumns.findIndex(
    (col) => col.slug === effectiveStatus,
  );
  const project = projects.data?.find((p) => p.id === projectId);
  const assigneeMember = members.data?.find((m) => m.id === assignee);
  const sortedFields = [...(fields.data ?? [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );
  const missingRequired = sortedFields.some(
    (f) => f.required && !fieldValues[f.id]?.trim(),
  );
  const canCreate = !!title.trim() && !busy && !missingRequired;

  const create = async () => {
    const task = await run(async () => {
      const created = await api.createTask(projectId, {
        title: title.trim(),
        description,
        startDate: start ? toApiDate(start) : null,
        dueDate: due ? toApiDate(due) : null,
        priority,
        status: effectiveStatus,
        userId: assignee,
        customFields: Object.entries(fieldValues)
          .filter(([, v]) => v.trim())
          .map(([fieldId, value]) => ({ fieldId, value })),
      });
      await Promise.all(
        labelIds.map((id) => api.attachLabel(id, created.id).catch(() => null)),
      );
      if (params.parentTaskId)
        await api.createRelation(params.parentTaskId, created.id, "subtask");
      return created;
    });
    if (task)
      router.replace({
        pathname: "/task/[taskId]",
        params: { taskId: task.id },
      });
  };

  const row = (
    label: string,
    value: ReactNode,
    onPress: () => void,
    last = false,
  ) => (
    <Touch
      key={label}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 52,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.divider,
      }}
    >
      <Txt
        variant="bodySm"
        tone="muted"
        style={{ width: 120 }}
        numberOfLines={1}
      >
        {label}
      </Txt>
      <View
        style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}
      >
        {value}
      </View>
      <ChevronRight size={16} color={c.placeholder} />
    </Touch>
  );
  const none = (text = "None") => (
    <Txt variant="bodySm" tone="placeholder">
      {text}
    </Txt>
  );
  const val = (text: string) => (
    <Txt variant="bodySm" weight="medium" numberOfLines={1}>
      {text}
    </Txt>
  );

  return (
    <Screen surface>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            height: 52,
            paddingLeft: 6,
            paddingRight: 16,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              flexShrink: 1,
            }}
          >
            <BackButton close />
            <Touch
              onPress={() => !params.parentTaskId && setPicker("project")}
              disabled={!!params.parentTaskId}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                height: 30,
                paddingHorizontal: 10,
                borderRadius: 8,
                backgroundColor: c.fill,
                flexShrink: 1,
              }}
            >
              <ProjectIcon name={project?.icon} size={14} color={c.ink2} />
              <Txt
                variant="meta"
                weight="medium"
                tone="body"
                numberOfLines={1}
                style={{ flexShrink: 1 }}
              >
                {params.parentTaskId
                  ? "New subtask"
                  : (project?.name ?? "Project")}
              </Txt>
              {!params.parentTaskId ? (
                <ChevronDown size={12} color={c.faint} />
              ) : null}
            </Touch>
          </View>
          <Touch
            onPress={create}
            disabled={!canCreate}
            style={{
              height: 36,
              paddingHorizontal: 16,
              borderRadius: 10,
              justifyContent: "center",
              backgroundColor: canCreate ? c.primary : c.fill,
            }}
          >
            <Txt
              variant="bodySm"
              weight="medium"
              color={canCreate ? c.onPrimary : c.placeholder}
            >
              Create
            </Txt>
          </Touch>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: 20,
              gap: 10,
            }}
          >
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Task title"
              placeholderTextColor={c.placeholder}
              autoFocus
              multiline
              selectionColor={c.ink}
              style={{
                fontFamily: font.semibold,
                fontSize: 22,
                lineHeight: 28,
                letterSpacing: -0.44,
                color: c.ink,
                padding: 0,
              }}
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Add a description… Markdown works."
              placeholderTextColor={c.placeholder}
              multiline
              selectionColor={c.ink}
              style={{
                fontFamily: font.regular,
                fontSize: 15,
                lineHeight: 22,
                color: c.body,
                padding: 0,
                minHeight: 44,
              }}
            />
          </View>
          <View
            style={{
              paddingHorizontal: 20,
              borderTopWidth: 1,
              borderTopColor: c.divider,
            }}
          >
            {row(
              "Status",
              <>
                <StatusIcon
                  status={effectiveStatus}
                  icon={sortedColumns[statusIdx]?.icon}
                  isFinal={sortedColumns[statusIdx]?.isFinal}
                />
                {val(statusLabel)}
              </>,
              () => setPicker("status"),
            )}
            {row(
              "Priority",
              priority === "no-priority" ? (
                none()
              ) : (
                <>
                  <PriorityIcon priority={priority} size={16} />
                  {val(priorityLabel(priority))}
                </>
              ),
              () => setPicker("priority"),
            )}
            {row(
              "Assignee",
              assigneeMember ? (
                <>
                  <Avatar
                    name={assigneeMember.name}
                    image={assigneeMember.image}
                    size={20}
                  />
                  {val(assigneeMember.name)}
                </>
              ) : (
                none("Unassigned")
              ),
              () => setPicker("assignee"),
            )}
            {row(
              "Start date",
              start ? val(formatDate(dayIso(start))) : none(),
              () => setPicker("start"),
            )}
            {row(
              "Due date",
              due ? (
                <>
                  <CalendarDays size={16} color={c.ink2} strokeWidth={2} />
                  {val(formatDate(dayIso(due)))}
                </>
              ) : (
                none()
              ),
              () => setPicker("due"),
            )}
            {row(
              "Labels",
              labelIds.length ? (
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 6,
                    paddingVertical: 10,
                    flex: 1,
                  }}
                >
                  {labelIds.map((id) => {
                    const l = labels.data?.find((x) => x.id === id);
                    if (!l) return null;
                    return (
                      <View
                        key={id}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 5,
                          height: 26,
                          paddingHorizontal: 8,
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: c.hairline,
                        }}
                      >
                        <LabelDot color={l.color} />
                        <Txt variant="caption" weight="medium">
                          {l.name}
                        </Txt>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: c.fillStrong,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Plus size={12} color={c.muted} />
                </View>
              ),
              () => setPicker("labels"),
              sortedFields.length === 0,
            )}
            {sortedFields.map((f, i) => {
              const value = fieldValues[f.id];
              const last = i === sortedFields.length - 1;
              if (f.type === "boolean") {
                return (
                  <View
                    key={f.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      minHeight: 52,
                      borderBottomWidth: last ? 0 : 1,
                      borderBottomColor: c.divider,
                    }}
                  >
                    <Txt variant="bodySm" tone="muted" style={{ width: 120 }}>
                      {f.name}
                    </Txt>
                    <View style={{ flex: 1 }} />
                    <Switch
                      value={value === "true"}
                      onChange={(v) =>
                        setFieldValues({ ...fieldValues, [f.id]: String(v) })
                      }
                    />
                  </View>
                );
              }
              const shown =
                f.type === "multiselect"
                  ? options(value ?? null).join(", ")
                  : f.type === "date" && value
                    ? formatDate(value)
                    : value;
              return row(
                `${f.name}${f.required ? " *" : ""}`,
                shown
                  ? val(shown)
                  : none(f.type === "number" ? "Add a number" : "Empty"),
                () => setFieldEditing(f),
                last,
              );
            })}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <OptionSheet
        visible={picker === "project"}
        onClose={() => setPicker(null)}
        title="Project"
        selected={projectId}
        options={(projects.data ?? [])
          .filter((p) => !p.archivedAt)
          .map((p) => ({
            value: p.id,
            label: p.name,
            hint: p.slug.toUpperCase(),
            leading: <ProjectIcon name={p.icon} />,
          }))}
        onSelect={(id) => {
          setProjectId(id);
          setStatus(null);
          setFieldValues({});
        }}
      />
      <OptionSheet
        visible={picker === "status"}
        onClose={() => setPicker(null)}
        title="Status"
        selected={effectiveStatus}
        options={[
          {
            value: STATUS_PLANNED,
            label: "Planned",
            leading: <StatusIcon status={STATUS_PLANNED} />,
          },
          ...sortedColumns.map((col) => ({
            value: col.slug,
            label: col.name,
            leading: (
              <StatusIcon
                status={col.slug}
                icon={col.icon}
                isFinal={col.isFinal}
              />
            ),
          })),
        ]}
        onSelect={setStatus}
      />
      <OptionSheet
        visible={picker === "priority"}
        onClose={() => setPicker(null)}
        title="Priority"
        selected={priority}
        options={[...PRIORITIES].reverse().map((p) => ({
          value: p.value as string,
          label: p.label,
          leading: <PriorityIcon priority={p.value} size={16} />,
        }))}
        onSelect={setPriority}
      />
      <OptionSheet
        visible={picker === "assignee"}
        onClose={() => setPicker(null)}
        title="Assignee"
        searchable
        searchPlaceholder="Search people"
        selected={assignee}
        options={[
          {
            value: null as string | null,
            label: "Unassigned",
            leading: <EmptyAvatar size={28} />,
          },
          ...(members.data ?? []).map((m) => ({
            value: m.id as string | null,
            label: m.id === session.userId ? `${m.name} (you)` : m.name,
            hint: m.email,
            leading: <Avatar name={m.name} image={m.image} size={28} />,
          })),
        ]}
        onSelect={setAssignee}
      />
      <DatePickerSheet
        visible={picker === "start"}
        onClose={() => setPicker(null)}
        title="Start date"
        value={dayIso(start)}
        onPick={setStart}
      />
      <DatePickerSheet
        visible={picker === "due"}
        onClose={() => setPicker(null)}
        title="Due date"
        value={dayIso(due)}
        onPick={setDue}
      />
      <Sheet
        visible={picker === "labels"}
        onClose={() => setPicker(null)}
        title="Labels"
      >
        <View style={{ paddingHorizontal: 8, paddingBottom: 8 }}>
          {(labels.data ?? []).map((l) => {
            const checked = labelIds.includes(l.id);
            const toggle = () =>
              setLabelIds(
                checked
                  ? labelIds.filter((x) => x !== l.id)
                  : [...labelIds, l.id],
              );
            return (
              <Touch
                key={l.id}
                onPress={toggle}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  height: 48,
                  paddingHorizontal: 12,
                }}
              >
                <Checkbox checked={checked} onPress={toggle} />
                <LabelDot color={l.color} size={8} />
                <Txt variant="body">{l.name}</Txt>
              </Touch>
            );
          })}
          {!labels.data?.length ? (
            <Txt variant="meta" tone="faint" style={{ padding: 12 }}>
              No labels in this workspace yet.
            </Txt>
          ) : null}
        </View>
      </Sheet>

      <DatePickerSheet
        visible={fieldEditing?.type === "date"}
        onClose={() => setFieldEditing(null)}
        title={fieldEditing?.name ?? ""}
        value={fieldEditing ? fieldValues[fieldEditing.id] : null}
        onPick={(day) =>
          fieldEditing &&
          setFieldValues({
            ...fieldValues,
            [fieldEditing.id]: day ? toIsoDay(day) : "",
          })
        }
      />
      <OptionSheet
        visible={fieldEditing?.type === "dropdown"}
        onClose={() => setFieldEditing(null)}
        title={fieldEditing?.name ?? ""}
        selected={fieldEditing ? (fieldValues[fieldEditing.id] ?? "") : ""}
        options={[
          { value: "", label: "None" },
          ...options(fieldEditing?.options).map((o) => ({
            value: o,
            label: o,
          })),
        ]}
        onSelect={(v) =>
          fieldEditing &&
          setFieldValues({ ...fieldValues, [fieldEditing.id]: v })
        }
      />
      <MultiSelectSheet
        visible={fieldEditing?.type === "multiselect"}
        onClose={() => setFieldEditing(null)}
        title={fieldEditing?.name ?? ""}
        options={options(fieldEditing?.options)}
        selected={
          fieldEditing ? options(fieldValues[fieldEditing.id] ?? null) : []
        }
        onSave={(values) =>
          fieldEditing &&
          setFieldValues({
            ...fieldValues,
            [fieldEditing.id]: JSON.stringify(values),
          })
        }
      />
      <TextInputSheet
        visible={
          !!fieldEditing && ["text", "number"].includes(fieldEditing.type)
        }
        onClose={() => setFieldEditing(null)}
        title={fieldEditing?.name ?? ""}
        initial={fieldEditing ? (fieldValues[fieldEditing.id] ?? "") : ""}
        multiline={fieldEditing?.type === "text"}
        keyboardType={
          fieldEditing?.type === "number" ? "decimal-pad" : "default"
        }
        validate={() => true}
        onSubmit={(v) =>
          fieldEditing &&
          setFieldValues({ ...fieldValues, [fieldEditing.id]: v })
        }
      />
    </Screen>
  );
}
