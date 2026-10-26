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
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { Avatar, EmptyAvatar } from "@/components/avatar";
import { PriorityIcon, ProjectIcon, StatusIcon } from "@/components/icons";
import { DatePickerSheet, TextInputSheet } from "@/components/pickers";
import { BackButton, Screen } from "@/components/screen";
import { MultiSelectSheet, OptionSheet, Sheet } from "@/components/sheet";
import { Txt } from "@/components/text";
import { useToast } from "@/components/toast";
import { Checkbox, LabelDot, Switch, Touch } from "@/components/ui";
import {
  customFieldsPayload,
  draftFieldValues,
  hasMissingRequired,
} from "@/features/task/new-task-fields";
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
  const { t } = useTranslation(["mobile"]);
  const params = useLocalSearchParams<{
    projectId: string;
    workspaceId: string;
    status?: string;
    parentTaskId?: string;
  }>();
  const c = useColors();
  const session = useRequiredSession();
  const { run, busy } = useAction();
  const toast = useToast();
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
  const [fieldEdits, setFieldEdits] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState<Picker>(null);
  const [fieldEditing, setFieldEditing] =
    useState<CustomFieldDefinition | null>(null);

  const sortedColumns = [...(columns.data ?? [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );
  const effectiveStatus = status ?? sortedColumns[0]?.slug ?? STATUS_PLANNED;
  const statusLabel =
    effectiveStatus === STATUS_PLANNED
      ? t("mobile:taskFields.planned")
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
  const fieldValues = draftFieldValues(sortedFields, fieldEdits);
  const canCreate =
    !!title.trim() && !busy && !hasMissingRequired(sortedFields, fieldValues);
  const setFieldValue = (id: string, value: string) =>
    setFieldEdits({ ...fieldEdits, [id]: value });

  const create = async () => {
    // Once the task exists the form must not create it again, so failed follow-ups only warn.
    const result = await run(async () => {
      const task = await api.createTask(projectId, {
        title: title.trim(),
        description,
        startDate: start ? toApiDate(start) : null,
        dueDate: due ? toApiDate(due) : null,
        priority,
        status: effectiveStatus,
        userId: assignee,
        customFields: customFieldsPayload(sortedFields, fieldValues),
      });
      const [labelResults, linked] = await Promise.all([
        Promise.allSettled(labelIds.map((id) => api.attachLabel(id, task.id))),
        params.parentTaskId
          ? api.createRelation(params.parentTaskId, task.id, "subtask").then(
              () => true,
              () => false,
            )
          : true,
      ]);
      const labelsFailed = labelResults.some((r) => r.status === "rejected");
      return { task, labelsFailed, linked };
    });
    if (!result) return;
    const { task, labelsFailed, linked } = result;
    router.replace({ pathname: "/task/[taskId]", params: { taskId: task.id } });
    if (!linked)
      toast.show(
        labelsFailed
          ? t("mobile:taskNew.labelsAndParentFailed")
          : t("mobile:taskNew.parentFailed"),
        "error",
      );
    else if (labelsFailed)
      toast.show(t("mobile:taskNew.labelsFailed"), "error");
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
  const none = (text = t("mobile:taskFields.none")) => (
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
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
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
                  ? t("mobile:taskNew.newSubtask")
                  : (project?.name ?? t("mobile:taskNew.project"))}
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
              {t("mobile:taskNew.create")}
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
              placeholder={t("mobile:taskNew.taskTitle")}
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
              placeholder={t("mobile:editor.placeholder")}
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
              t("mobile:taskFields.status"),
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
              t("mobile:taskFields.priority"),
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
              t("mobile:taskFields.assignee"),
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
                none(t("mobile:taskFields.unassigned"))
              ),
              () => setPicker("assignee"),
            )}
            {row(
              t("mobile:taskFields.startDate"),
              start ? val(formatDate(dayIso(start))) : none(),
              () => setPicker("start"),
            )}
            {row(
              t("mobile:taskFields.dueDate"),
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
              t("mobile:taskFields.labels"),
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
                      onChange={(v) => setFieldValue(f.id, String(v))}
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
                  : none(
                      f.type === "number"
                        ? t("mobile:taskFields.addNumber")
                        : t("mobile:taskFields.empty"),
                    ),
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
        title={t("mobile:taskNew.project")}
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
          setFieldEdits({});
        }}
      />
      <OptionSheet
        visible={picker === "status"}
        onClose={() => setPicker(null)}
        title={t("mobile:taskFields.status")}
        selected={effectiveStatus}
        options={[
          {
            value: STATUS_PLANNED,
            label: t("mobile:taskFields.planned"),
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
        title={t("mobile:taskFields.priority")}
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
        title={t("mobile:taskFields.assignee")}
        searchable
        searchPlaceholder={t("mobile:taskFields.searchPeople")}
        selected={assignee}
        options={[
          {
            value: null as string | null,
            label: t("mobile:taskFields.unassigned"),
            leading: <EmptyAvatar size={28} />,
          },
          ...(members.data ?? []).map((m) => ({
            value: m.id as string | null,
            label:
              m.id === session.userId
                ? t("mobile:taskFields.you", { name: m.name })
                : m.name,
            hint: m.email,
            leading: <Avatar name={m.name} image={m.image} size={28} />,
          })),
        ]}
        onSelect={setAssignee}
      />
      <DatePickerSheet
        visible={picker === "start"}
        onClose={() => setPicker(null)}
        title={t("mobile:taskFields.startDate")}
        value={dayIso(start)}
        onPick={setStart}
      />
      <DatePickerSheet
        visible={picker === "due"}
        onClose={() => setPicker(null)}
        title={t("mobile:taskFields.dueDate")}
        value={dayIso(due)}
        onPick={setDue}
      />
      <Sheet
        visible={picker === "labels"}
        onClose={() => setPicker(null)}
        title={t("mobile:taskFields.labels")}
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
              {t("mobile:taskNew.noLabels")}
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
          setFieldValue(fieldEditing.id, day ? toIsoDay(day) : "")
        }
      />
      <OptionSheet
        visible={fieldEditing?.type === "dropdown"}
        onClose={() => setFieldEditing(null)}
        title={fieldEditing?.name ?? ""}
        selected={fieldEditing ? (fieldValues[fieldEditing.id] ?? "") : ""}
        options={[
          { value: "", label: t("mobile:taskFields.none") },
          ...options(fieldEditing?.options).map((o) => ({
            value: o,
            label: o,
          })),
        ]}
        onSelect={(v) => fieldEditing && setFieldValue(fieldEditing.id, v)}
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
          fieldEditing && setFieldValue(fieldEditing.id, JSON.stringify(values))
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
        onSubmit={(v) => fieldEditing && setFieldValue(fieldEditing.id, v)}
      />
    </Screen>
  );
}
