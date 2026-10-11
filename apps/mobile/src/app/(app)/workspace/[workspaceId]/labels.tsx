import { useLocalSearchParams } from "expo-router";
import { Ellipsis, Plus } from "lucide-react-native";
import { useState } from "react";
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
import { inset, useColors } from "@/theme";

export default function LabelsScreen() {
  const { workspaceId } = useLocalSearchParams<{ workspaceId: string }>();
  const c = useColors();
  const { run } = useAction();
  const labels = useWorkspaceLabels(workspaceId);
  const [editing, setEditing] = useState<Label | "new" | null>(null);
  const [menu, setMenu] = useState<Label | null>(null);
  const [deleting, setDeleting] = useState<Label | null>(null);
  const list = labels.data ?? [];

  return (
    <Screen>
      <Scroll
        bottomPadding={40}
        refreshing={labels.isRefetching}
        onRefresh={() => void labels.refetch()}
      >
        <PageHeader
          title="Labels"
          description="Labels help you group and filter tasks."
          action={
            <Button
              label="New label"
              size="sm"
              icon={<Plus size={14} color={c.onPrimary} />}
              onPress={() => setEditing("new")}
              style={{ height: 36 }}
            />
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
                title="No labels"
                message="Create labels to group and filter tasks across projects."
              />
            </Group>
          ) : (
            <Group>
              {list.map((l, i) => (
                <GroupRow
                  key={l.id}
                  last={i === list.length - 1}
                  onPress={() => setEditing(l)}
                >
                  <LabelDot color={l.color} size={10} />
                  <Txt variant="body" style={{ flex: 1 }}>
                    {l.name}
                  </Txt>
                  <Touch
                    onPress={() => setMenu(l)}
                    hitSlop={10}
                    accessibilityLabel={`Actions for ${l.name}`}
                  >
                    <Ellipsis size={16} color={c.placeholder} />
                  </Touch>
                </GroupRow>
              ))}
            </Group>
          )}
        </View>
      </Scroll>

      <LabelSheet
        label={editing}
        onClose={() => setEditing(null)}
        onSave={(name, color) =>
          run(() =>
            editing && editing !== "new"
              ? api.updateLabel(editing.id, { name, color })
              : api.createLabel({ name, color, workspaceId }),
          )
        }
      />
      <OptionSheet
        visible={!!menu}
        onClose={() => setMenu(null)}
        title={menu?.name ?? "Label"}
        options={[
          { value: "edit", label: "Edit label" },
          { value: "delete", label: "Delete label", tone: "danger" as const },
        ]}
        onSelect={(v) => (v === "edit" ? setEditing(menu) : setDeleting(menu))}
      />
      <ConfirmDialog
        visible={!!deleting}
        title={`Delete “${deleting?.name}”?`}
        message="The label is removed from every task in this workspace."
        confirmLabel="Delete"
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          run(() => api.deleteLabel(deleting.id), { success: "Label deleted" })
        }
      />
    </Screen>
  );
}

function LabelSheet({
  label,
  onClose,
  onSave,
}: {
  label: Label | "new" | null;
  onClose: () => void;
  onSave: (name: string, color: string) => void;
}) {
  return (
    <Sheet
      visible={!!label}
      onClose={onClose}
      title={label === "new" ? "New label" : "Edit label"}
    >
      {label ? (
        <LabelForm
          initial={label === "new" ? null : label}
          onSave={(name, color) => {
            onSave(name, color);
            onClose();
          }}
        />
      ) : null}
    </Sheet>
  );
}

function LabelForm({
  initial,
  onSave,
}: {
  initial: Label | null;
  onSave: (name: string, color: string) => void;
}) {
  const c = useColors();
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState<string>(
    initial?.color ?? LABEL_COLORS[2].value,
  );

  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 16 }}>
      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        autoFocus
        leading={<LabelDot color={color} size={10} />}
      />
      <View style={{ gap: 8 }}>
        <Txt variant="meta" weight="medium" tone="body">
          Color
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
        label="Save"
        disabled={!name.trim()}
        onPress={() => onSave(name.trim(), color)}
      />
    </View>
  );
}
