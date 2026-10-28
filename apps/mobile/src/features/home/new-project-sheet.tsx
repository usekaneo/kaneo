import { useTranslation } from "react-i18next";
import { useState } from "react";
import { View } from "react-native";

import { Sheet } from "@/components/sheet";
import { Txt } from "@/components/text";
import { Button, TextField } from "@/components/ui";
import { api } from "@/lib/api/endpoints";
import type { Project } from "@/lib/api/types";
import { suggestProjectKey } from "@/lib/format";
import { useAction } from "@/lib/query";

export function NewProjectSheet({
  visible,
  onClose,
  workspaceId,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  workspaceId: string;
  onCreated: (project: Project) => void;
}) {
  const { t } = useTranslation(["mobile"]);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t("mobile:projectNew.newProject")}
    >
      <NewProjectForm
        workspaceId={workspaceId}
        onCreated={(p) => {
          onClose();
          onCreated(p);
        }}
      />
    </Sheet>
  );
}

function NewProjectForm({
  workspaceId,
  onCreated,
}: {
  workspaceId: string;
  onCreated: (project: Project) => void;
}) {
  const { t } = useTranslation(["mobile"]);
  const [name, setName] = useState("");
  const [key, setKey] = useState<string | null>(null);
  const { run, busy } = useAction();
  // The key follows the name until the person edits it.
  const effectiveKey = key ?? (name.trim() ? suggestProjectKey(name) : "");

  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 14 }}>
      <TextField
        label={t("mobile:projectNew.name")}
        value={name}
        onChangeText={setName}
        placeholder={t("mobile:projectNew.customerPortal")}
        autoFocus
      />
      <TextField
        label={t("mobile:projectNew.key")}
        aside={t("mobile:projectNew.usedInTaskIDs")}
        value={effectiveKey}
        onChangeText={(v) =>
          setKey(
            v
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "")
              .slice(0, 5),
          )
        }
        autoCapitalize="characters"
        autoCorrect={false}
        mono
        trailing={
          effectiveKey ? (
            <Txt variant="mono" tone="faint">
              {effectiveKey}-1, {effectiveKey}-2…
            </Txt>
          ) : null
        }
      />
      <Button
        label={t("mobile:projectNew.createProject")}
        disabled={!name.trim() || !effectiveKey}
        loading={busy}
        onPress={async () => {
          const project = await run(() =>
            api.createProject({
              name: name.trim(),
              workspaceId,
              icon: "Layout",
              slug: effectiveKey,
            }),
          );
          if (project) onCreated(project);
        }}
      />
    </View>
  );
}
