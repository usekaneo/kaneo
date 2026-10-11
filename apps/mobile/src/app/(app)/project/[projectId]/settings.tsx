import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import { StatusIcon } from "@/components/icons";
import { TextInputSheet } from "@/components/pickers";
import {
  ErrorState,
  Loading,
  PageHeader,
  Screen,
  Scroll,
} from "@/components/screen";
import { ConfirmDialog, OptionSheet, Sheet } from "@/components/sheet";
import { Txt } from "@/components/text";
import {
  Button,
  Chip,
  Group,
  GroupRow,
  IconButton,
  Section,
  Switch,
  TextField,
  Touch,
} from "@/components/ui";
import { userMessage } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import type { Column, CustomFieldDefinition } from "@/lib/api/types";
import { useWorkspaces } from "@/lib/hooks";
import { qk, useAction } from "@/lib/query";
import { useColors } from "@/theme";

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Checkbox" },
  { value: "dropdown", label: "Dropdown" },
  { value: "multiselect", label: "Multi-select" },
];

export default function ProjectSettingsScreen() {
  const { projectId, workspaceId } = useLocalSearchParams<{
    projectId: string;
    workspaceId: string;
  }>();
  const c = useColors();
  const { run, busy } = useAction();
  const project = useQuery({
    queryKey: qk.project(projectId),
    queryFn: () => api.project(projectId),
  });
  const columns = useQuery({
    queryKey: qk.columns(projectId),
    queryFn: () => api.columns(projectId),
  });
  const fields = useQuery({
    queryKey: qk.customFields(projectId),
    queryFn: () => api.customFields(projectId),
  });
  const workspaces = useWorkspaces();
  const [columnMenu, setColumnMenu] = useState<Column | null>(null);
  const [renaming, setRenaming] = useState<Column | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [addingField, setAddingField] = useState(false);
  const [fieldMenu, setFieldMenu] = useState<CustomFieldDefinition | null>(
    null,
  );
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    label: string;
    action: () => void;
  } | null>(null);
  const [movePicker, setMovePicker] = useState(false);

  const p = project.data;
  const sortedColumns = [...(columns.data ?? [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );
  const sortedFields = [...(fields.data ?? [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );

  const save = (patch: { name?: string; slug?: string; isPublic?: boolean }) =>
    p &&
    run(
      () =>
        api.updateProject(projectId, {
          name: patch.name ?? p.name,
          icon: p.icon ?? "Layout",
          slug: (patch.slug ?? p.slug).toUpperCase(),
          // Required by the API; the app doesn't edit it, so send back what's there.
          description: p.description ?? "",
          isPublic: patch.isPublic ?? !!p.isPublic,
        }),
      { success: patch.isPublic === undefined ? "Project updated" : undefined },
    );

  const move = (column: Column, delta: number) => {
    const list = [...sortedColumns];
    const i = list.findIndex((x) => x.id === column.id);
    const j = i + delta;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    void run(() =>
      api.reorderColumns(
        projectId,
        list.map((col, index) => ({ id: col.id, position: index })),
      ),
    );
  };

  return (
    <Screen>
      <Scroll
        bottomPadding={40}
        refreshing={project.isRefetching}
        onRefresh={() =>
          void Promise.all([
            project.refetch(),
            columns.refetch(),
            fields.refetch(),
          ])
        }
      >
        <PageHeader
          title={p?.name ?? "Project"}
          description="Project settings"
        />
        {project.isLoading ? (
          <Loading />
        ) : !p ? (
          <ErrorState
            message={userMessage(project.error)}
            onRetry={() => void project.refetch()}
          />
        ) : (
          <>
            <Section title="General" style={{ paddingBottom: 22 }}>
              <Group>
                <GeneralForm
                  key={`${p.id}-${p.name}-${p.slug}`}
                  name={p.name}
                  slug={p.slug}
                  busy={busy}
                  onSave={(name, slug) => save({ name, slug })}
                />
                <GroupRow last>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt variant="body">Public board</Txt>
                    <Txt variant="caption" tone="faint">
                      Anyone with the link can view the board
                    </Txt>
                  </View>
                  <Switch
                    value={!!p.isPublic}
                    onChange={(v) => save({ isPublic: v })}
                  />
                </GroupRow>
              </Group>
            </Section>

            <Section
              title="Columns"
              style={{ paddingBottom: 22 }}
              aside={
                <Touch onPress={() => setAddingColumn(true)} hitSlop={8}>
                  <Txt variant="meta" weight="medium" tone="muted">
                    Add column
                  </Txt>
                </Touch>
              }
            >
              <Group>
                {sortedColumns.map((col, i) => (
                  <GroupRow
                    key={col.id}
                    last={i === sortedColumns.length - 1}
                    onPress={() => setColumnMenu(col)}
                  >
                    <StatusIcon
                      status={col.slug}
                      icon={col.icon}
                      isFinal={col.isFinal}
                      size={14}
                    />
                    <Txt variant="body" style={{ flex: 1 }}>
                      {col.name}
                    </Txt>
                    {col.isFinal ? (
                      <View
                        style={{
                          height: 22,
                          paddingHorizontal: 8,
                          borderRadius: 999,
                          backgroundColor: c.fill,
                          justifyContent: "center",
                        }}
                      >
                        <Txt variant="micro" tone="muted">
                          Done column
                        </Txt>
                      </View>
                    ) : null}
                    <IconButton
                      label="Move up"
                      size={28}
                      disabled={i === 0}
                      onPress={() => move(col, -1)}
                    >
                      <ArrowUp
                        size={14}
                        color={i === 0 ? c.fillStrong : c.faint}
                      />
                    </IconButton>
                    <IconButton
                      label="Move down"
                      size={28}
                      disabled={i === sortedColumns.length - 1}
                      onPress={() => move(col, 1)}
                    >
                      <ArrowDown
                        size={14}
                        color={
                          i === sortedColumns.length - 1
                            ? c.fillStrong
                            : c.faint
                        }
                      />
                    </IconButton>
                  </GroupRow>
                ))}
              </Group>
            </Section>

            <Section
              title="Custom fields"
              style={{ paddingBottom: 22 }}
              aside={
                <Touch onPress={() => setAddingField(true)} hitSlop={8}>
                  <Txt variant="meta" weight="medium" tone="muted">
                    Add field
                  </Txt>
                </Touch>
              }
            >
              <Group>
                {sortedFields.length === 0 ? (
                  <GroupRow last>
                    <Txt variant="bodySm" tone="faint">
                      No custom fields
                    </Txt>
                  </GroupRow>
                ) : (
                  sortedFields.map((f, i) => (
                    <GroupRow
                      key={f.id}
                      last={i === sortedFields.length - 1}
                      onPress={() => setFieldMenu(f)}
                    >
                      <Txt variant="body" style={{ flex: 1 }}>
                        {f.name}
                        {f.required ? " *" : ""}
                      </Txt>
                      <Txt variant="meta" tone="faint">
                        {FIELD_TYPES.find((t) => t.value === f.type)?.label ??
                          f.type}
                      </Txt>
                    </GroupRow>
                  ))
                )}
              </Group>
            </Section>

            <Section>
              <Group>
                <GroupRow
                  onPress={() =>
                    p.archivedAt
                      ? run(() => api.unarchiveProject(projectId), {
                          success: "Project restored",
                        })
                      : setConfirm({
                          title: "Archive project?",
                          message:
                            "It disappears from the project list. You can restore it later.",
                          label: "Archive",
                          action: async () => {
                            const ok = await run(
                              () => api.archiveProject(projectId),
                              { success: "Project archived" },
                            );
                            if (ok !== undefined) router.dismissTo("/");
                          },
                        })
                  }
                >
                  <Txt variant="body" style={{ flex: 1 }}>
                    {p.archivedAt ? "Restore project" : "Archive project"}
                  </Txt>
                </GroupRow>
                <GroupRow onPress={() => setMovePicker(true)}>
                  <Txt variant="body" style={{ flex: 1 }}>
                    Move to another workspace
                  </Txt>
                  <ChevronRight size={16} color={c.placeholder} />
                </GroupRow>
                <GroupRow
                  last
                  onPress={() =>
                    setConfirm({
                      title: "Delete project?",
                      message:
                        "All tasks, comments and time entries in this project will be permanently deleted.",
                      label: "Delete",
                      action: async () => {
                        const ok = await run(
                          () => api.deleteProject(projectId),
                          { success: "Project deleted" },
                        );
                        if (ok !== undefined) router.dismissTo("/");
                      },
                    })
                  }
                >
                  <Txt variant="body" tone="danger">
                    Delete project
                  </Txt>
                </GroupRow>
              </Group>
            </Section>
          </>
        )}
      </Scroll>

      <OptionSheet
        visible={!!columnMenu}
        onClose={() => setColumnMenu(null)}
        title={columnMenu?.name ?? "Column"}
        options={[
          { value: "rename", label: "Rename" },
          {
            value: "final",
            label: columnMenu?.isFinal
              ? "Unmark as done column"
              : "Mark as done column",
          },
          { value: "delete", label: "Delete column", tone: "danger" as const },
        ]}
        onSelect={(v) => {
          const col = columnMenu;
          if (!col) return;
          if (v === "rename") setRenaming(col);
          if (v === "final")
            void run(() => api.updateColumn(col.id, { isFinal: !col.isFinal }));
          if (v === "delete")
            setConfirm({
              title: `Delete “${col.name}”?`,
              message: "Tasks in this column may need to be moved first.",
              label: "Delete",
              action: () =>
                void run(() => api.deleteColumn(col.id), {
                  success: "Column deleted",
                }),
            });
        }}
      />
      <TextInputSheet
        visible={!!renaming}
        onClose={() => setRenaming(null)}
        title="Rename column"
        initial={renaming?.name ?? ""}
        onSubmit={(value) =>
          renaming && run(() => api.updateColumn(renaming.id, { name: value }))
        }
      />
      <AddColumnSheet
        visible={addingColumn}
        onClose={() => setAddingColumn(false)}
        onAdd={(colName, isFinal) =>
          run(() => api.createColumn(projectId, { name: colName, isFinal }))
        }
      />
      <AddFieldSheet
        visible={addingField}
        onClose={() => setAddingField(false)}
        onAdd={(body) =>
          run(() => api.createCustomField({ projectId, ...body }))
        }
      />
      <OptionSheet
        visible={!!fieldMenu}
        onClose={() => setFieldMenu(null)}
        title={fieldMenu?.name ?? "Field"}
        options={[
          { value: "delete", label: "Delete field", tone: "danger" as const },
        ]}
        onSelect={() =>
          fieldMenu &&
          setConfirm({
            title: `Delete “${fieldMenu.name}”?`,
            message: "Values stored in this field are deleted from every task.",
            label: "Delete",
            action: () =>
              void run(() => api.deleteCustomField(fieldMenu.id), {
                success: "Field deleted",
              }),
          })
        }
      />
      <OptionSheet
        visible={movePicker}
        onClose={() => setMovePicker(false)}
        title="Move to workspace"
        options={(workspaces.data ?? [])
          .filter((w) => w.id !== workspaceId)
          .map((w) => ({ value: w.id, label: w.name }))}
        onSelect={async (id) => {
          const ok = await run(() => api.moveProject(projectId, id), {
            success: "Project moved",
          });
          if (ok !== undefined) router.dismissTo("/");
        }}
      />
      <ConfirmDialog
        visible={!!confirm}
        title={confirm?.title ?? ""}
        message={confirm?.message}
        confirmLabel={confirm?.label ?? "OK"}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm?.action()}
      />
    </Screen>
  );
}

function GeneralForm({
  name: initialName,
  slug,
  busy,
  onSave,
}: {
  name: string;
  slug: string;
  busy: boolean;
  onSave: (name: string, slug: string) => void;
}) {
  const c = useColors();
  const [name, setName] = useState(initialName);
  const [key, setKey] = useState(slug.toUpperCase());
  const dirty =
    name.trim() !== initialName || key.trim() !== slug.toUpperCase();
  return (
    <View
      style={{
        padding: 14,
        gap: 14,
        borderBottomWidth: 1,
        borderBottomColor: c.divider,
      }}
    >
      <TextField label="Name" value={name} onChangeText={setName} />
      <TextField
        label="Key"
        aside="Changes future and existing task IDs"
        value={key}
        onChangeText={(v) =>
          setKey(
            v
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "")
              .slice(0, 5),
          )
        }
        autoCapitalize="characters"
        mono
      />
      {dirty ? (
        <View style={{ alignItems: "flex-end" }}>
          <Button
            label="Save changes"
            size="md"
            loading={busy}
            disabled={!name.trim() || !key.trim()}
            onPress={() => onSave(name.trim(), key.trim())}
          />
        </View>
      ) : null}
    </View>
  );
}

function AddColumnSheet({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (name: string, isFinal: boolean) => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="New column">
      <AddColumnForm onClose={onClose} onAdd={onAdd} />
    </Sheet>
  );
}

function AddColumnForm({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (name: string, isFinal: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [isFinal, setIsFinal] = useState(false);
  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 14 }}>
      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Blocked"
        autoFocus
      />
      <Group>
        <GroupRow last>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="body">Done column</Txt>
            <Txt variant="caption" tone="faint">
              Tasks here count as finished
            </Txt>
          </View>
          <Switch value={isFinal} onChange={setIsFinal} />
        </GroupRow>
      </Group>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button label="Cancel" kind="secondary" grow onPress={onClose} />
        <Button
          label="Add column"
          grow
          disabled={!name.trim()}
          onPress={() => {
            onAdd(name.trim(), isFinal);
            onClose();
          }}
        />
      </View>
    </View>
  );
}

function AddFieldSheet({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (body: {
    name: string;
    type: string;
    required: boolean;
    options?: string[];
  }) => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="New custom field">
      <AddFieldForm onClose={onClose} onAdd={onAdd} />
    </Sheet>
  );
}

function AddFieldForm({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (body: {
    name: string;
    type: string;
    required: boolean;
    options?: string[];
  }) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("text");
  const [optionsText, setOptionsText] = useState("");
  const [required, setRequired] = useState(false);
  const needsOptions = type === "dropdown" || type === "multiselect";
  const options = optionsText
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 16 }}>
      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Platform"
        autoFocus
      />
      <View style={{ gap: 8 }}>
        <Txt variant="meta" weight="medium" tone="body">
          Type
        </Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {FIELD_TYPES.map((t) => (
            <Chip
              key={t.value}
              label={t.label}
              selected={type === t.value}
              onPress={() => setType(t.value)}
            />
          ))}
        </View>
      </View>
      {needsOptions ? (
        <TextField
          label="Options"
          aside="Separate with commas"
          value={optionsText}
          onChangeText={setOptionsText}
          placeholder="Android, iOS, Web"
        />
      ) : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Txt variant="bodySm">Required</Txt>
        <Switch value={required} onChange={setRequired} />
      </View>
      <Button
        label="Add field"
        disabled={!name.trim() || (needsOptions && options.length === 0)}
        onPress={() => {
          onAdd({
            name: name.trim(),
            type,
            required,
            options: needsOptions ? options : undefined,
          });
          onClose();
        }}
      />
    </View>
  );
}
