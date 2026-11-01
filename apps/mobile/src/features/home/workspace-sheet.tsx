import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Mail, Plus, Settings, Tag, Users } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Sheet } from "@/components/sheet";
import { Txt } from "@/components/text";
import { CountBadge, Divider, SelectionSlot, Touch } from "@/components/ui";
import { api } from "@/lib/api/endpoints";
import type { Workspace } from "@/lib/api/types";
import { selectWorkspace, useWorkspaces } from "@/lib/hooks";
import { qk } from "@/lib/query";
import { roleLabel } from "@/lib/style";
import { useColors } from "@/theme";

function ActionRow({
  icon,
  label,
  onPress,
  trailing,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  trailing?: ReactNode;
}) {
  return (
    <Touch
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        height: 48,
        paddingHorizontal: 12,
      }}
    >
      {icon}
      <Txt variant="body" style={{ flex: 1 }}>
        {label}
      </Txt>
      {trailing}
    </Touch>
  );
}

export function WorkspaceSheet({
  visible,
  onClose,
  current,
}: {
  visible: boolean;
  onClose: () => void;
  current: Workspace;
}) {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const workspaces = useWorkspaces();
  const invitations = useQuery({
    queryKey: qk.invitations,
    queryFn: api.pendingInvitations,
  });
  const pending = (invitations.data ?? []).filter(
    (i) => i.status === "pending",
  ).length;
  const go = (path: Parameters<typeof router.push>[0]) => {
    onClose();
    router.push(path);
  };
  const icon = (Icon: typeof Users) => (
    <Icon size={18} color={c.ink2} strokeWidth={2} />
  );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t("mobile:workspaceSwitcher.title")}
    >
      <View style={{ paddingHorizontal: 8, paddingBottom: 8 }}>
        {(workspaces.data ?? []).map((w) => {
          const active = w.id === current.id;
          return (
            <Touch
              key={w.id}
              onPress={() => {
                void selectWorkspace(w);
                onClose();
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                minHeight: 56,
                paddingHorizontal: 12,
                borderRadius: 10,
              }}
              accessibilityState={{ selected: active }}
            >
              <SelectionSlot selected={active} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="body" weight={active ? "semibold" : "medium"}>
                  {w.name}
                </Txt>
                {w.role ? (
                  <Txt variant="caption" tone="muted">
                    {roleLabel(w.role)}
                  </Txt>
                ) : null}
              </View>
            </Touch>
          );
        })}
      </View>
      <Divider />
      <View style={{ padding: 8 }}>
        <ActionRow
          icon={icon(Settings)}
          label={t("mobile:workspaceSwitcher.settings")}
          onPress={() =>
            go({
              pathname: "/workspace/[workspaceId]/settings",
              params: { workspaceId: current.id },
            })
          }
        />
        <ActionRow
          icon={icon(Users)}
          label={t("mobile:workspaceSwitcher.members")}
          onPress={() =>
            go({
              pathname: "/workspace/[workspaceId]/members",
              params: { workspaceId: current.id },
            })
          }
        />
        <ActionRow
          icon={icon(Tag)}
          label={t("mobile:workspaceSwitcher.labels")}
          onPress={() =>
            go({
              pathname: "/workspace/[workspaceId]/labels",
              params: { workspaceId: current.id },
            })
          }
        />
        <ActionRow
          icon={icon(Mail)}
          label={t("mobile:workspaceSwitcher.invitations")}
          onPress={() => go("/invitations")}
          trailing={pending ? <CountBadge count={pending} /> : null}
        />
        <ActionRow
          icon={icon(Plus)}
          label={t("mobile:workspaceSwitcher.create")}
          onPress={() => go("/workspace/new")}
        />
      </View>
    </Sheet>
  );
}
