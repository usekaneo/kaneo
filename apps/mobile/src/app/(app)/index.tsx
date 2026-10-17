import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { ErrorState, Loading, Screen } from "@/components/screen";
import { Txt } from "@/components/text";
import { Button, Touch } from "@/components/ui";
import { ActivityTab } from "@/features/home/activity-tab";
import { BottomNav, type HomeTab } from "@/features/home/bottom-nav";
import { HomeTabView } from "@/features/home/home-tab";
import { InboxTab } from "@/features/home/inbox-tab";
import { MyTasksTab } from "@/features/home/my-tasks-tab";
import { WorkspaceSheet } from "@/features/home/workspace-sheet";
import { userMessage } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import { useCurrentWorkspace, useUnreadCount } from "@/lib/hooks";
import { qk } from "@/lib/query";
import { useRealtime } from "@/lib/realtime";
import { useSession } from "@/lib/session";
import { useColors } from "@/theme";

export default function HomeScreen() {
  const client = useQueryClient();
  const [tab, setTab] = useState<HomeTab>("home");
  const [switcher, setSwitcher] = useState(false);
  const { workspace, isLoading, error, refetch } = useCurrentWorkspace();
  const unread = useUnreadCount(workspace?.id);

  useRealtime("api/ws/user", (event) => {
    if (event.type === "NOTIFICATION_CREATED") {
      if (workspace)
        void client.invalidateQueries({
          queryKey: qk.notifications(workspace.id),
        });
      void client.invalidateQueries({ queryKey: ["activity"] });
    } else if (
      [
        "WORKSPACE_ACCESS_REVOKED",
        "WORKSPACE_ACCESS_SYNC",
        "PROJECT_ACCESS_CHANGED",
      ].includes(event.type)
    ) {
      void client.invalidateQueries();
    }
  });

  if (isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (error && !workspace) {
    return (
      <Screen>
        <ErrorState message={userMessage(error)} onRetry={refetch} />
      </Screen>
    );
  }
  if (!workspace) return <NoWorkspace />;

  return (
    <Screen surface={tab === "inbox" || tab === "activity"}>
      <View style={{ flex: 1 }}>
        {tab === "home" ? (
          <HomeTabView
            workspace={workspace}
            onSwitch={() => setSwitcher(true)}
            onViewAllTasks={() => setTab("tasks")}
          />
        ) : tab === "tasks" ? (
          <MyTasksTab workspaceId={workspace.id} />
        ) : tab === "inbox" ? (
          <InboxTab workspaceId={workspace.id} />
        ) : (
          <ActivityTab workspace={workspace} />
        )}
      </View>
      <BottomNav tab={tab} onChange={setTab} unread={unread} />
      <WorkspaceSheet
        visible={switcher}
        onClose={() => setSwitcher(false)}
        current={workspace}
      />
    </Screen>
  );
}

function NoWorkspace() {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const session = useSession();
  const invitations = useQuery({
    queryKey: qk.invitations,
    queryFn: api.pendingInvitations,
  });
  const pending = (invitations.data ?? []).filter(
    (i) => i.status === "pending",
  ).length;
  return (
    <Screen>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: 28,
          gap: 28,
        }}
      >
        <View style={{ gap: 10 }}>
          <Txt variant="title">{t("mobile:home.noWorkspace.title")}</Txt>
          <Txt variant="body" tone="muted" style={{ lineHeight: 22 }}>
            {t("mobile:home.noWorkspace.body")}
          </Txt>
        </View>
        <View style={{ gap: 10 }}>
          <Button
            label={t("mobile:home.noWorkspace.create")}
            onPress={() => router.push("/workspace/new")}
          />
          {pending ? (
            <Button
              label={t("mobile:home.noWorkspace.viewInvitations", {
                count: pending,
              })}
              kind="secondary"
              onPress={() => router.push("/invitations")}
              icon={
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: c.info,
                  }}
                />
              }
              style={{ flexDirection: "row-reverse" }}
            />
          ) : null}
          <Touch
            onPress={() => router.push("/invitations")}
            style={{
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Txt variant="bodySm" weight="medium" tone="muted">
              {t("mobile:home.noWorkspace.joinWithLink")}
            </Txt>
          </Touch>
        </View>
      </View>
      <Txt variant="meta" tone="faint" center style={{ paddingBottom: 36 }}>
        {t("mobile:home.noWorkspace.signedInAs", {
          email: session?.userEmail,
        })}
      </Txt>
    </Screen>
  );
}
