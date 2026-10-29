import { useTranslation } from "react-i18next";
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
  Group,
  GroupRow,
  IconButton,
  Section,
  Switch,
  TextField,
  Touch,
} from "@/components/ui";
import { CustomFieldForm } from "@/features/project/custom-field-form";
import type { CreateFieldBody } from "@/features/project/field-form";
import { useFieldTypes } from "@/features/project/use-field-types";
import { userMessage } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import type { Column, CustomFieldDefinition } from "@/lib/api/types";
import { useWorkspaces } from "@/lib/hooks";
import { qk, useAction } from "@/lib/query";
import { useColors } from "@/theme";

export default function ProjectSettingsScreen() {
  const { t } = useTranslation(["mobile"]);
  const fieldTypes = useFieldTypes();
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
      {
        success:
          patch.isPublic === undefined
            ? t("mobile:projectSettings.projectUpdated")
            : undefined,
      },
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
          title={p?.name ?? t("mobile:projectSettings.project")}
          description={t("mobile:projectSettings.projectSettings")}
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
            <Section
              title={t("mobile:projectSettings.general")}
              style={{ paddingBottom: 22 }}
            >
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
                    <Txt variant="body">
                      {t("mobile:projectSettings.publicBoard")}
                    </Txt>
                    <Txt variant="caption" tone="faint">
                      {t(
                        "mobile:projectSettings.anyoneWithTheLinkCanViewTheBoard",
                      )}
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
              title={t("mobile:projectSettings.columns")}
              style={{ paddingBottom: 22 }}
              aside={
                <Touch onPress={() => setAddingColumn(true)} hitSlop={8}>
                  <Txt variant="meta" weight="medium" tone="muted">
                    {t("mobile:projectSettings.addColumn")}
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
                          {t("mobile:projectSettings.doneColumn")}
                        </Txt>
                      </View>
                    ) : null}
                    <IconButton
                      label={t("mobile:projectSettings.moveUp")}
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
                      label={t("mobile:projectSettings.moveDown")}
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
              title={t("mobile:projectSettings.customFields")}
              style={{ paddingBottom: 22 }}
              aside={
                <Touch onPress={() => setAddingField(true)} hitSlop={8}>
                  <Txt variant="meta" weight="medium" tone="muted">
                    {t("mobile:projectSettings.addField")}
                  </Txt>
                </Touch>
              }
            >
              <Group>
                {sortedFields.length === 0 ? (
                  <GroupRow last>
                    <Txt variant="bodySm" tone="faint">
                      {t("mobile:projectSettings.noCustomFields")}
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
                        {fieldTypes.find((t) => t.value === f.type)?.label ??
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
                          success: t("mobile:projectSettings.projectRestored"),
                        })
                      : setConfirm({
                          title: t(
                            "mobile:projectSettings.archiveProjectTitle",
                          ),
                          message: t(
                            "mobile:projectSettings.itDisappearsFromTheProjectListYouCanRestoreItLater",
                          ),
                          label: t("mobile:projectSettings.archive"),
                          action: async () => {
                            const ok = await run(
                              () => api.archiveProject(projectId),
                              {
                                success: t(
                                  "mobile:projectSettings.projectArchived",
                                ),
                              },
                            );
                            if (ok !== undefined) router.dismissTo("/");
                          },
                        })
                  }
                >
                  <Txt variant="body" style={{ flex: 1 }}>
                    {p.archivedAt
                      ? t("mobile:projectSettings.restoreProject")
                      : t("mobile:projectSettings.archiveProject")}
                  </Txt>
                </GroupRow>
                <GroupRow onPress={() => setMovePicker(true)}>
                  <Txt variant="body" style={{ flex: 1 }}>
                    {t("mobile:projectSettings.moveToAnotherWorkspace")}
                  </Txt>
                  <ChevronRight size={16} color={c.placeholder} />
                </GroupRow>
                <GroupRow
                  last
                  onPress={() =>
                    setConfirm({
                      title: t("mobile:projectSettings.deleteProjectTitle"),
                      message: t(
                        "mobile:projectSettings.allTasksCommentsAndTimeEntriesInThisProjectWillBePermanentlyDeleted",
                      ),
                      label: t("mobile:common.delete"),
                      action: async () => {
                        const ok = await run(
                          () => api.deleteProject(projectId),
                          {
                            success: t("mobile:projectSettings.projectDeleted"),
                          },
                        );
                        if (ok !== undefined) router.dismissTo("/");
                      },
                    })
                  }
                >
                  <Txt variant="body" tone="danger">
                    {t("mobile:projectSettings.deleteProject")}
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
        title={columnMenu?.name ?? t("mobile:projectSettings.column")}
        options={[
          { value: "rename", label: t("mobile:projectSettings.rename") },
          {
            value: "final",
            label: columnMenu?.isFinal
              ? t("mobile:projectSettings.unmarkAsDoneColumn")
              : t("mobile:projectSettings.markAsDoneColumn"),
          },
          {
            value: "delete",
            label: t("mobile:projectSettings.deleteColumn"),
            tone: "danger" as const,
          },
        ]}
        onSelect={(v) => {
          const col = columnMenu;
          if (!col) return;
          if (v === "rename") setRenaming(col);
          if (v === "final")
            void run(() => api.updateColumn(col.id, { isFinal: !col.isFinal }));
          if (v === "delete")
            setConfirm({
              title: t("mobile:projectSettings.deleteNamedTitle", {
                name: col.name,
              }),
              message: t(
                "mobile:projectSettings.tasksInThisColumnMayNeedToBeMovedFirst",
              ),
              label: t("mobile:common.delete"),
              action: () =>
                void run(() => api.deleteColumn(col.id), {
                  success: t("mobile:projectSettings.columnDeleted"),
                }),
            });
        }}
      />
      <TextInputSheet
        visible={!!renaming}
        onClose={() => setRenaming(null)}
        title={t("mobile:projectSettings.renameColumn")}
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
        busy={busy}
        visible={addingField}
        onClose={() => setAddingField(false)}
        onAdd={(body) =>
          run(() => api.createCustomField({ projectId, ...body }))
        }
      />
      <OptionSheet
        visible={!!fieldMenu}
        onClose={() => setFieldMenu(null)}
        title={fieldMenu?.name ?? t("mobile:projectSettings.field")}
        options={[
          {
            value: "delete",
            label: t("mobile:projectSettings.deleteField"),
            tone: "danger" as const,
          },
        ]}
        onSelect={() =>
          fieldMenu &&
          setConfirm({
            title: t("mobile:projectSettings.deleteNamedTitle", {
              name: fieldMenu.name,
            }),
            message: t(
              "mobile:projectSettings.valuesStoredInThisFieldAreDeletedFromEveryTask",
            ),
            label: t("mobile:common.delete"),
            action: () =>
              void run(() => api.deleteCustomField(fieldMenu.id), {
                success: t("mobile:projectSettings.fieldDeleted"),
              }),
          })
        }
      />
      <OptionSheet
        visible={movePicker}
        onClose={() => setMovePicker(false)}
        title={t("mobile:projectSettings.moveToWorkspace")}
        options={(workspaces.data ?? [])
          .filter((w) => w.id !== workspaceId)
          .map((w) => ({ value: w.id, label: w.name }))}
        onSelect={async (id) => {
          const ok = await run(() => api.moveProject(projectId, id), {
            success: t("mobile:projectSettings.projectMoved"),
          });
          if (ok !== undefined) router.dismissTo("/");
        }}
      />
      <ConfirmDialog
        visible={!!confirm}
        title={confirm?.title ?? ""}
        message={confirm?.message}
        confirmLabel={confirm?.label ?? t("mobile:projectSettings.ok")}
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
  const { t } = useTranslation(["mobile"]);
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
      <TextField
        label={t("mobile:projectSettings.name")}
        value={name}
        onChangeText={setName}
      />
      <TextField
        label={t("mobile:projectSettings.key")}
        aside={t("mobile:projectSettings.changesFutureAndExistingTaskIDs")}
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
            label={t("mobile:projectSettings.saveChanges")}
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
  const { t } = useTranslation(["mobile"]);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t("mobile:projectSettings.newColumn")}
    >
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
  const { t } = useTranslation(["mobile"]);
  const [name, setName] = useState("");
  const [isFinal, setIsFinal] = useState(false);
  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 14 }}>
      <TextField
        label={t("mobile:projectSettings.name")}
        value={name}
        onChangeText={setName}
        placeholder={t("mobile:projectSettings.blocked")}
        autoFocus
      />
      <Group>
        <GroupRow last>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="body">{t("mobile:projectSettings.doneColumn")}</Txt>
            <Txt variant="caption" tone="faint">
              {t("mobile:projectSettings.tasksHereCountAsFinished")}
            </Txt>
          </View>
          <Switch value={isFinal} onChange={setIsFinal} />
        </GroupRow>
      </Group>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button
          label={t("mobile:common.cancel")}
          kind="secondary"
          grow
          onPress={onClose}
        />
        <Button
          label={t("mobile:projectSettings.addColumn")}
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
  busy,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (body: CreateFieldBody) => Promise<unknown | undefined>;
  busy: boolean;
}) {
  const { t } = useTranslation(["mobile"]);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t("mobile:projectSettings.newCustomField")}
    >
      <CustomFieldForm onClose={onClose} onAdd={onAdd} busy={busy} />
    </Sheet>
  );
}
