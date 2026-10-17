import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import {
  ErrorState,
  Loading,
  PageHeader,
  Screen,
  Scroll,
} from "@/components/screen";
import { ConfirmDialog } from "@/components/sheet";
import { Txt } from "@/components/text";
import { Button, Group, GroupRow, Section, TextField } from "@/components/ui";
import { userMessage } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import { workspaceDescription } from "@/lib/describe";
import { useWorkspaceLabels, useWorkspaces } from "@/lib/hooks";
import { qk, useAction } from "@/lib/query";
import { sessionStore, useRequiredSession } from "@/lib/session";
import { canManageWorkspace, hasRole } from "@/lib/style";
import { useColors } from "@/theme";

export default function WorkspaceSettingsScreen() {
  const { workspaceId } = useLocalSearchParams<{ workspaceId: string }>();
  const c = useColors();
  const session = useRequiredSession();
  const { run, busy } = useAction();
  const org = useQuery({
    queryKey: qk.fullWorkspace(workspaceId),
    queryFn: () => api.fullWorkspace(workspaceId),
  });
  const workspaces = useWorkspaces();
  const labels = useWorkspaceLabels(workspaceId);
  const workspace = workspaces.data?.find((w) => w.id === workspaceId);
  const role =
    workspace?.role ??
    org.data?.members?.find((m) => m.userId === session.userId)?.role;
  const canEdit = canManageWorkspace(role);
  const isOwner = hasRole(role, "owner");
  const [confirm, setConfirm] = useState<"leave" | "delete" | null>(null);

  const leaveOrDelete = async (kind: "leave" | "delete") => {
    const ok = await run(
      () =>
        kind === "delete"
          ? api.deleteWorkspace(workspaceId)
          : api.leaveWorkspace(workspaceId),
      {
        success:
          kind === "delete" ? "Workspace deleted" : "You left the workspace",
      },
    );
    if (ok !== undefined) {
      await sessionStore.updatePrefs({ lastWorkspaceId: null });
      router.dismissTo("/");
    }
  };

  return (
    <Screen>
      <Scroll
        bottomPadding={40}
        refreshing={org.isRefetching}
        onRefresh={() => void org.refetch()}
      >
        <PageHeader
          title="Workspace"
          description={`Settings for everyone in ${workspace?.name ?? "this workspace"}.`}
        />
        {org.isLoading ? (
          <Loading />
        ) : !org.data ? (
          <ErrorState
            message={userMessage(org.error)}
            onRetry={() => void org.refetch()}
          />
        ) : (
          <>
            <Section title="General" style={{ paddingBottom: 24 }}>
              <GeneralForm
                key={`${org.data.id}-${org.data.name}`}
                name={org.data.name}
                description={workspaceDescription(org.data.metadata)}
                slug={org.data.slug}
                canEdit={canEdit}
                busy={busy}
                onSave={(name, description) =>
                  run(
                    () =>
                      api.updateWorkspace(workspaceId, {
                        name,
                        metadata: { description },
                      }),
                    { success: "Workspace updated" },
                  )
                }
              />
            </Section>
            <Section title="Manage" style={{ paddingBottom: 24 }}>
              <Group>
                <GroupRow
                  onPress={() =>
                    router.push({
                      pathname: "/workspace/[workspaceId]/members",
                      params: { workspaceId },
                    })
                  }
                >
                  <Txt variant="body" style={{ flex: 1 }}>
                    Members
                  </Txt>
                  <Txt variant="bodySm" tone="muted">
                    {org.data.members?.length ?? 0}
                  </Txt>
                  <ChevronRight size={16} color={c.placeholder} />
                </GroupRow>
                <GroupRow
                  last
                  onPress={() =>
                    router.push({
                      pathname: "/workspace/[workspaceId]/labels",
                      params: { workspaceId },
                    })
                  }
                >
                  <Txt variant="body" style={{ flex: 1 }}>
                    Labels
                  </Txt>
                  <Txt variant="bodySm" tone="muted">
                    {labels.data?.length ?? ""}
                  </Txt>
                  <ChevronRight size={16} color={c.placeholder} />
                </GroupRow>
              </Group>
            </Section>
            <Section title="Danger zone">
              <Group>
                {!isOwner ? (
                  <GroupRow last={!isOwner}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt variant="body">Leave workspace</Txt>
                      <Txt variant="caption" tone="faint">
                        You can rejoin with a new invitation
                      </Txt>
                    </View>
                    <Button
                      label="Leave"
                      kind="secondary"
                      size="sm"
                      onPress={() => setConfirm("leave")}
                    />
                  </GroupRow>
                ) : null}
                {isOwner ? (
                  <GroupRow last>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt variant="body">Delete workspace</Txt>
                      <Txt variant="caption" tone="faint">
                        Deletes all projects and tasks in it
                      </Txt>
                    </View>
                    <Button
                      label="Delete"
                      kind="dangerOutline"
                      size="sm"
                      onPress={() => setConfirm("delete")}
                    />
                  </GroupRow>
                ) : null}
              </Group>
            </Section>
          </>
        )}
      </Scroll>
      <ConfirmDialog
        visible={!!confirm}
        title={confirm === "delete" ? "Delete workspace?" : "Leave workspace?"}
        message={
          confirm === "delete"
            ? `Every project, task and comment in ${workspace?.name ?? "this workspace"} will be permanently deleted.`
            : "You will lose access until someone invites you again."
        }
        confirmLabel={confirm === "delete" ? "Delete" : "Leave"}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && leaveOrDelete(confirm)}
      />
    </Screen>
  );
}

function GeneralForm({
  name: initialName,
  description: initialDescription,
  slug,
  canEdit,
  busy,
  onSave,
}: {
  name: string;
  description: string;
  slug: string;
  canEdit: boolean;
  busy: boolean;
  onSave: (name: string, description: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  return (
    <Group style={{ padding: 14, gap: 14 }}>
      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        editable={canEdit}
      />
      <TextField
        label="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        editable={canEdit}
      />
      <Txt variant="caption" tone="faint">
        Slug: <Txt variant="mono">{slug}</Txt>
      </Txt>
      {canEdit ? (
        <View style={{ alignItems: "flex-end" }}>
          <Button
            label="Save changes"
            size="md"
            loading={busy}
            disabled={!name.trim()}
            onPress={() => onSave(name.trim(), description.trim())}
          />
        </View>
      ) : null}
    </Group>
  );
}
