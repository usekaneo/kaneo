import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
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
import { useWorkspaceLabels, useWorkspaces } from "@/lib/hooks";
import { qk, useAction } from "@/lib/query";
import { sessionStore, useRequiredSession } from "@/lib/session";
import { hasRole } from "@/lib/style";
import { useWorkspaceCapabilities } from "@/lib/use-workspace-capabilities";
import {
  getWorkspaceDescription,
  workspaceDescriptionUpdate,
} from "@/lib/workspace-description";
import { useColors } from "@/theme";

export default function WorkspaceSettingsScreen() {
  const { workspaceId } = useLocalSearchParams<{ workspaceId: string }>();
  const { t } = useTranslation(["mobile"]);
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
  const capabilities = useWorkspaceCapabilities(workspaceId);
  const canEdit = capabilities.data?.manageWorkspace === true;
  const canDelete = capabilities.data?.deleteWorkspace === true;
  const isOwner = hasRole(role, "owner");
  const [confirm, setConfirm] = useState<"leave" | "delete" | null>(null);
  const workspaceName =
    workspace?.name ?? t("mobile:workspaceSettings.thisWorkspace");

  const leaveOrDelete = async (kind: "leave" | "delete") => {
    if (kind === "delete" && !canDelete) return;
    const ok = await run(
      () =>
        kind === "delete"
          ? api.deleteWorkspace(workspaceId)
          : api.leaveWorkspace(workspaceId),
      {
        success:
          kind === "delete"
            ? t("mobile:workspaceSettings.toast.deleted")
            : t("mobile:workspaceSettings.toast.left"),
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
        refreshing={org.isRefetching || capabilities.isRefetching}
        onRefresh={() => {
          void org.refetch();
          void capabilities.refetch();
        }}
      >
        <PageHeader
          title={t("mobile:workspaceSettings.title")}
          description={t("mobile:workspaceSettings.description", {
            name: workspaceName,
          })}
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
            <Section
              title={t("mobile:workspaceSettings.general.title")}
              style={{ paddingBottom: 24 }}
            >
              <GeneralForm
                key={`${org.data.id}-${org.data.name}`}
                name={org.data.name}
                description={getWorkspaceDescription(org.data)}
                slug={org.data.slug}
                canEdit={canEdit}
                busy={busy}
                onSave={(name, description) =>
                  canEdit &&
                  run(
                    () =>
                      api.updateWorkspace(workspaceId, {
                        name,
                        ...workspaceDescriptionUpdate(
                          description,
                          org.data.metadata,
                        ),
                      }),
                    { success: t("mobile:workspaceSettings.toast.updated") },
                  )
                }
              />
            </Section>
            <Section
              title={t("mobile:workspaceSettings.manage.title")}
              style={{ paddingBottom: 24 }}
            >
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
                    {t("mobile:workspaceSettings.manage.members")}
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
                    {t("mobile:workspaceSettings.manage.labels")}
                  </Txt>
                  <Txt variant="bodySm" tone="muted">
                    {labels.data?.length ?? ""}
                  </Txt>
                  <ChevronRight size={16} color={c.placeholder} />
                </GroupRow>
              </Group>
            </Section>
            <Section title={t("mobile:workspaceSettings.danger.title")}>
              <Group>
                {!isOwner ? (
                  <GroupRow last={!canDelete}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt variant="body">
                        {t("mobile:workspaceSettings.danger.leave")}
                      </Txt>
                      <Txt variant="caption" tone="faint">
                        {t("mobile:workspaceSettings.danger.leaveHint")}
                      </Txt>
                    </View>
                    <Button
                      label={t("mobile:workspaceSettings.danger.leaveButton")}
                      kind="secondary"
                      size="sm"
                      onPress={() => setConfirm("leave")}
                    />
                  </GroupRow>
                ) : null}
                {canDelete ? (
                  <GroupRow last>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt variant="body">
                        {t("mobile:workspaceSettings.danger.delete")}
                      </Txt>
                      <Txt variant="caption" tone="faint">
                        {t("mobile:workspaceSettings.danger.deleteHint")}
                      </Txt>
                    </View>
                    <Button
                      label={t("mobile:common.delete")}
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
        visible={!!confirm && (confirm !== "delete" || canDelete)}
        title={
          confirm === "delete"
            ? t("mobile:workspaceSettings.confirm.deleteTitle")
            : t("mobile:workspaceSettings.confirm.leaveTitle")
        }
        message={
          confirm === "delete"
            ? t("mobile:workspaceSettings.confirm.deleteMessage", {
                name: workspaceName,
              })
            : t("mobile:workspaceSettings.confirm.leaveMessage")
        }
        confirmLabel={
          confirm === "delete"
            ? t("mobile:common.delete")
            : t("mobile:workspaceSettings.danger.leaveButton")
        }
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
  const { t } = useTranslation(["mobile"]);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  return (
    <Group style={{ padding: 14, gap: 14 }}>
      <TextField
        label={t("mobile:workspaceSettings.general.name")}
        value={name}
        onChangeText={setName}
        editable={canEdit}
      />
      <TextField
        label={t("mobile:workspaceSettings.general.description")}
        value={description}
        onChangeText={setDescription}
        multiline
        editable={canEdit}
      />
      <Txt variant="caption" tone="faint">
        <Trans
          t={t}
          i18nKey="mobile:workspaceSettings.general.slug"
          values={{ slug }}
          components={{ mono: <Txt variant="mono" /> }}
        />
      </Txt>
      {canEdit ? (
        <View style={{ alignItems: "flex-end" }}>
          <Button
            label={t("mobile:workspaceSettings.general.save")}
            size="md"
            loading={busy}
            disabled={busy || !name.trim()}
            onPress={() => onSave(name.trim(), description.trim())}
          />
        </View>
      ) : null}
    </Group>
  );
}
