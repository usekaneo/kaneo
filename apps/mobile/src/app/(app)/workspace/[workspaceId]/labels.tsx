import { useLocalSearchParams } from "expo-router";
import { Ellipsis, Plus } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import {
  EmptyState,
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
  LabelDot,
  TextField,
  Touch,
} from "@/components/ui";
import { userMessage } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import type { Label } from "@/lib/api/types";
import { useWorkspaceLabels } from "@/lib/hooks";
import { useAction } from "@/lib/query";
import { LABEL_COLORS, labelColor } from "@/lib/style";
import { useWorkspaceCapabilities } from "@/lib/use-workspace-capabilities";
import { inset, useColors } from "@/theme";

export default function LabelsScreen() {
  const { workspaceId } = useLocalSearchParams<{ workspaceId: string }>();
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const { run, busy } = useAction();
  const capabilities = useWorkspaceCapabilities(workspaceId);
  const canCreate = capabilities.data?.createLabels === true;
  const canUpdate = capabilities.data?.updateLabels === true;
  const canDelete = capabilities.data?.deleteLabels === true;
  const labels = useWorkspaceLabels(workspaceId);
  const [editing, setEditing] = useState<Label | "new" | null>(null);
  const [menu, setMenu] = useState<Label | null>(null);
  const [deleting, setDeleting] = useState<Label | null>(null);
  const list = labels.data ?? [];

  return (
    <Screen>
      <Scroll
        bottomPadding={40}
        refreshing={labels.isRefetching || capabilities.isRefetching}
        onRefresh={() => {
          void labels.refetch();
          void capabilities.refetch();
        }}
      >
        <PageHeader
          title={t("mobile:labels.title")}
          description={t("mobile:labels.description")}
          action={
            canCreate ? (
              <Button
                label={t("mobile:labels.new")}
                size="sm"
                icon={<Plus size={14} color={c.onPrimary} />}
                onPress={() => setEditing("new")}
                style={{ height: 36 }}
              />
            ) : undefined
          }
        />
        <View style={{ paddingHorizontal: inset }}>
          {labels.isLoading ? (
            <Loading />
          ) : labels.error ? (
            <ErrorState
              message={userMessage(labels.error)}
              onRetry={() => void labels.refetch()}
            />
          ) : list.length === 0 ? (
            <Group>
              <EmptyState
                title={t("mobile:labels.empty.title")}
                message={t("mobile:labels.empty.message")}
              />
            </Group>
          ) : (
            <Group>
              {list.map((l, i) => (
                <GroupRow
                  key={l.id}
                  last={i === list.length - 1}
                  onPress={canUpdate ? () => setEditing(l) : undefined}
                >
                  <LabelDot color={l.color} size={10} />
                  <Txt variant="body" style={{ flex: 1 }}>
                    {l.name}
                  </Txt>
                  {canUpdate || canDelete ? (
                    <Touch
                      onPress={() => setMenu(l)}
                      hitSlop={10}
                      accessibilityLabel={t("mobile:labels.actions", {
                        name: l.name,
                      })}
                    >
                      <Ellipsis size={16} color={c.placeholder} />
                    </Touch>
                  ) : null}
                </GroupRow>
              ))}
            </Group>
          )}
        </View>
      </Scroll>

      <LabelSheet
        label={(editing === "new" ? canCreate : canUpdate) ? editing : null}
        busy={busy}
        onClose={() => setEditing(null)}
        onSave={async (name, color) => {
          if (!editing || !(editing === "new" ? canCreate : canUpdate)) return;
          return run(() =>
            editing !== "new"
              ? api.updateLabel(editing.id, { name, color })
              : api.createLabel({ name, color, workspaceId }),
          );
        }}
      />
      <OptionSheet
        visible={!!menu && (canUpdate || canDelete)}
        onClose={() => setMenu(null)}
        title={menu?.name ?? t("mobile:labels.fallbackTitle")}
        options={[
          ...(canUpdate
            ? [{ value: "edit", label: t("mobile:labels.edit") }]
            : []),
          ...(canDelete
            ? [
                {
                  value: "delete",
                  label: t("mobile:labels.delete"),
                  tone: "danger" as const,
                },
              ]
            : []),
        ]}
        onSelect={(v) => (v === "edit" ? setEditing(menu) : setDeleting(menu))}
      />
      <ConfirmDialog
        visible={!!deleting && canDelete}
        title={t("mobile:labels.deleteTitle", { name: deleting?.name })}
        message={t("mobile:labels.deleteMessage")}
        confirmLabel={t("mobile:common.delete")}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          canDelete &&
          deleting &&
          run(() => api.deleteLabel(deleting.id), {
            success: t("mobile:labels.toast.deleted"),
          })
        }
      />
    </Screen>
  );
}

function LabelSheet({
  label,
  busy,
  onClose,
  onSave,
}: {
  label: Label | "new" | null;
  busy: boolean;
  onClose: () => void;
  onSave: (name: string, color: string) => Promise<Label | undefined>;
}) {
  const { t } = useTranslation(["mobile"]);
  return (
    <Sheet
      visible={!!label}
      onClose={onClose}
      title={label === "new" ? t("mobile:labels.new") : t("mobile:labels.edit")}
    >
      {label ? (
        <LabelForm
          initial={label === "new" ? null : label}
          busy={busy}
          onSave={async (name, color) => {
            const saved = await onSave(name, color);
            if (saved !== undefined) onClose();
          }}
        />
      ) : null}
    </Sheet>
  );
}

function LabelForm({
  initial,
  busy,
  onSave,
}: {
  initial: Label | null;
  busy: boolean;
  onSave: (name: string, color: string) => Promise<void>;
}) {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState<string>(
    initial?.color ?? LABEL_COLORS[2].value,
  );

  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 16 }}>
      <TextField
        label={t("mobile:labels.form.name")}
        value={name}
        onChangeText={setName}
        autoFocus
        leading={<LabelDot color={color} size={10} />}
      />
      <View style={{ gap: 8 }}>
        <Txt variant="meta" weight="medium" tone="body">
          {t("mobile:labels.form.color")}
        </Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {LABEL_COLORS.map((opt) => {
            const active = labelColor(color) === opt.color;
            return (
              <Touch
                key={opt.value}
                onPress={() => setColor(opt.value)}
                accessibilityLabel={opt.label}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: active ? 2 : 0,
                  borderColor: c.ink,
                }}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: opt.color,
                  }}
                />
              </Touch>
            );
          })}
        </View>
      </View>
      <Button
        label={t("mobile:common.save")}
        loading={busy}
        disabled={busy || !name.trim()}
        onPress={() => onSave(name.trim(), color)}
      />
    </View>
  );
}
