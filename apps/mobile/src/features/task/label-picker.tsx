import { Plus } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { SearchField, Sheet } from "@/components/sheet";
import { Txt } from "@/components/text";
import { Checkbox, LabelDot, Touch } from "@/components/ui";
import { api } from "@/lib/api/endpoints";
import type { Label } from "@/lib/api/types";
import { useWorkspaceLabels } from "@/lib/hooks";
import { useAction } from "@/lib/query";
import { LABEL_COLORS } from "@/lib/style";
import { useColors } from "@/theme";

/** Toggle workspace labels on a task, or create a new one from the search text. */
export function LabelPickerSheet({
  visible,
  onClose,
  taskId,
  attached,
  workspaceId,
}: {
  visible: boolean;
  onClose: () => void;
  taskId: string;
  attached: Label[];
  workspaceId?: string | null;
}) {
  const { t } = useTranslation(["mobile"]);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t("mobile:taskFields.labels")}
      aside={
        <Touch onPress={onClose} hitSlop={8}>
          <Txt variant="bodySm" weight="semibold">
            {t("mobile:taskFields.done")}
          </Txt>
        </Touch>
      }
    >
      <LabelPickerBody
        taskId={taskId}
        attached={attached}
        workspaceId={workspaceId}
      />
    </Sheet>
  );
}

function LabelPickerBody({
  taskId,
  attached,
  workspaceId,
}: {
  taskId: string;
  attached: Label[];
  workspaceId?: string | null;
}) {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const { run } = useAction();
  const labels = useWorkspaceLabels(workspaceId);
  const [query, setQuery] = useState("");
  const [color, setColor] = useState<string>(LABEL_COLORS[2].value);

  const q = query.trim();
  const list = (labels.data ?? []).filter(
    (l) => !q || l.name.toLowerCase().includes(q.toLowerCase()),
  );
  const exact = (labels.data ?? []).some(
    (l) => l.name.toLowerCase() === q.toLowerCase(),
  );

  const toggle = (label: Label) => {
    const existing = attached.find((a) => a.name === label.name);
    void run(() =>
      existing
        ? api.detachLabel(existing.id)
        : api.attachLabel(label.id, taskId),
    );
  };

  const create = () =>
    run(async () => {
      if (!workspaceId) return;
      const created = await api.createLabel({ name: q, color, workspaceId });
      await api.attachLabel(created.id, taskId);
      setQuery("");
    });

  return (
    <>
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={t("mobile:taskFields.searchOrCreate")}
        />
      </View>
      <View style={{ paddingHorizontal: 8, paddingBottom: 8 }}>
        {list.map((l) => {
          const checked = attached.some((a) => a.name === l.name);
          return (
            <Touch
              key={l.id}
              onPress={() => toggle(l)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                height: 48,
                paddingHorizontal: 12,
              }}
            >
              <Checkbox checked={checked} onPress={() => toggle(l)} />
              <LabelDot color={l.color} size={8} />
              <Txt variant="body">{l.name}</Txt>
            </Touch>
          );
        })}
        {q && !exact ? (
          <>
            <Touch
              onPress={create}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                height: 48,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor: c.fill,
              }}
            >
              <Plus size={16} color={c.ink} strokeWidth={2} />
              <Txt variant="body">
                {t("mobile:taskFields.createLabel", { name: q })}
              </Txt>
            </Touch>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
                paddingHorizontal: 12,
                paddingTop: 12,
              }}
            >
              <Txt variant="caption" tone="faint" style={{ flex: 1 }}>
                {t("mobile:taskFields.labelColor")}
              </Txt>
              {LABEL_COLORS.slice(2).map((opt) => (
                <Touch
                  key={opt.value}
                  onPress={() => setColor(opt.value)}
                  accessibilityLabel={opt.label}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: opt.color,
                    borderWidth: color === opt.value ? 2 : 0,
                    borderColor: c.surface,
                    ...(color === opt.value
                      ? {
                          outlineWidth: 1.5,
                          outlineColor: c.ink,
                          outlineStyle: "solid" as const,
                        }
                      : null),
                  }}
                />
              ))}
            </View>
          </>
        ) : null}
        {!q && list.length === 0 ? (
          <Txt variant="meta" tone="faint" style={{ padding: 12 }}>
            {t("mobile:taskFields.noLabels")}
          </Txt>
        ) : null}
      </View>
    </>
  );
}
