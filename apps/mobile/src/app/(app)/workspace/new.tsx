import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { BackButton, Screen } from "@/components/screen";
import { Txt } from "@/components/text";
import { Button, TextField } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import type { Workspace } from "@/lib/api/types";
import { slugify } from "@/lib/format";
import { useAction } from "@/lib/query";
import { sessionStore } from "@/lib/session";

export default function NewWorkspaceScreen() {
  const { run, busy } = useAction();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const create = async () => {
    const workspace = await run(async () => {
      // Slugs must be unique per instance; add a short suffix rather than asking the person to pick one.
      const base = (slugify(name) || "workspace").slice(0, 40);
      let lastError: unknown;
      for (let attempt = 0; attempt < 4; attempt++) {
        const slug =
          attempt === 0
            ? base
            : `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
        try {
          return await api.createWorkspace({
            name: name.trim(),
            slug,
            ...(description.trim()
              ? { metadata: { description: description.trim() } }
              : {}),
          });
        } catch (e) {
          lastError = e;
          if (
            !(e instanceof ApiError) ||
            !/slug/i.test(JSON.stringify(e.body ?? e.message))
          )
            throw e;
        }
      }
      throw lastError;
    });
    if (workspace) {
      await sessionStore.updatePrefs({
        lastWorkspaceId: (workspace as Workspace).id,
      });
      router.dismissTo("/");
    }
  };

  return (
    <Screen surface>
      <View style={{ height: 52, justifyContent: "center", paddingLeft: 6 }}>
        <BackButton close />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 16,
          gap: 24,
        }}
      >
        <View style={{ gap: 6 }}>
          <Txt variant="title">New workspace</Txt>
          <Txt variant="bodySm" tone="muted" style={{ lineHeight: 20 }}>
            A home for your team’s projects. You can invite people next.
          </Txt>
        </View>
        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Design studio"
          autoFocus
        />
        <TextField
          label="Description"
          aside="Optional"
          value={description}
          onChangeText={setDescription}
          placeholder="What's this workspace for?"
          multiline
        />
        <Button
          label="Create workspace"
          disabled={!name.trim()}
          loading={busy}
          onPress={create}
        />
      </ScrollView>
    </Screen>
  );
}
