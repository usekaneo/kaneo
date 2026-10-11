import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Bell, CheckCheck, CircleAlert, Ellipsis } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import { Avatar } from "@/components/avatar";
import { EmptyState, ErrorState, Loading, Scroll } from "@/components/screen";
import { ConfirmDialog, OptionSheet } from "@/components/sheet";
import { Txt } from "@/components/text";
import { IconButton, Touch } from "@/components/ui";
import { userMessage } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import type { Notification } from "@/lib/api/types";
import { describeNotification, field, notificationActor } from "@/lib/describe";
import { compareDays, parseDay, relativeShort, today } from "@/lib/format";
import { qk, useAction } from "@/lib/query";
import { inset, useColors } from "@/theme";

function NotificationRow({
  n,
  first,
  onPress,
}: {
  n: Notification;
  first: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const unread = n.isRead !== true;
  const text = describeNotification(n);
  const actor = notificationActor(n);
  const taskNumber = field(n.eventData, "taskNumber");
  const projectSlug = field(n.eventData, "projectSlug");
  const ticket =
    taskNumber && projectSlug
      ? `${projectSlug.toUpperCase()}-${taskNumber}`
      : null;
  const urgent = n.type.includes("overdue") || n.type.includes("due");
  return (
    <Touch
      onPress={onPress}
      style={{
        flexDirection: "row",
        gap: 12,
        paddingHorizontal: inset,
        paddingVertical: 12,
        backgroundColor: unread ? c.fill : "transparent",
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.divider,
      }}
    >
      {actor ? (
        <Avatar name={actor} size={32} />
      ) : (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: urgent ? c.dangerSoft : c.fill,
          }}
        >
          {urgent ? (
            <CircleAlert size={16} color={c.danger} strokeWidth={2} />
          ) : (
            <Bell size={16} color={c.muted} strokeWidth={1.75} />
          )}
        </View>
      )}
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Txt
            variant="bodySm"
            weight={unread ? "semibold" : "medium"}
            tone={unread ? "ink" : "body"}
            style={{ flex: 1 }}
            numberOfLines={2}
          >
            {text.title}
          </Txt>
          <Txt variant="caption" tone="faint">
            {relativeShort(n.createdAt)}
          </Txt>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: unread ? c.info : "transparent",
            }}
          />
        </View>
        {text.body ? (
          <Txt
            variant="meta"
            tone="ink2"
            numberOfLines={2}
            style={{ lineHeight: 18 }}
          >
            {text.body}
          </Txt>
        ) : null}
        {ticket ? (
          <Txt variant="mono" tone="muted" style={{ paddingTop: 2 }}>
            {ticket}
          </Txt>
        ) : null}
      </View>
    </Touch>
  );
}

export function InboxTab({ workspaceId }: { workspaceId: string }) {
  const c = useColors();
  const client = useQueryClient();
  const { run } = useAction();
  const [menu, setMenu] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const query = useQuery({
    queryKey: qk.notifications(workspaceId),
    queryFn: () => api.notifications(workspaceId),
  });
  const list = [...(query.data ?? [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const now = today();
  const todays = list.filter((n) => {
    const d = parseDay(n.createdAt);
    return d && compareDays(d, now) === 0;
  });
  const earlier = list.filter((n) => !todays.includes(n));

  const open = (n: Notification) => {
    if (n.isRead !== true) {
      api.markNotificationRead(n.id).then(
        () =>
          client.invalidateQueries({ queryKey: qk.notifications(workspaceId) }),
        () => {},
      );
    }
    if (n.resourceType === "task" && n.resourceId)
      router.push({
        pathname: "/task/[taskId]",
        params: { taskId: n.resourceId },
      });
  };

  const groupLabel = (label: string) => (
    <Txt
      variant="caption"
      weight="medium"
      tone="muted"
      style={{ paddingHorizontal: inset, paddingTop: 16, paddingBottom: 6 }}
    >
      {label}
    </Txt>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          height: 52,
          paddingLeft: inset,
          paddingRight: 8,
        }}
      >
        <Txt variant="title">Inbox</Txt>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Touch
            onPress={() =>
              run(() => api.markAllNotificationsRead(workspaceId), {
                success: "All caught up",
              })
            }
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              height: 36,
              paddingHorizontal: 10,
            }}
          >
            <CheckCheck size={16} color={c.ink2} strokeWidth={2} />
            <Txt variant="meta" weight="medium" tone="ink2">
              Mark all read
            </Txt>
          </Touch>
          <IconButton label="More" onPress={() => setMenu(true)}>
            <Ellipsis size={18} color={c.ink2} />
          </IconButton>
        </View>
      </View>
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState
          message={userMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : list.length === 0 ? (
        <EmptyState
          title="You're all caught up"
          message="Assignments, comments and mentions appear here."
        />
      ) : (
        <Scroll
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
        >
          {todays.length ? groupLabel("Today") : null}
          {todays.map((n, i) => (
            <NotificationRow
              key={n.id}
              n={n}
              first={i === 0}
              onPress={() => open(n)}
            />
          ))}
          {earlier.length
            ? groupLabel(todays.length ? "Earlier" : "Recent")
            : null}
          {earlier.map((n, i) => (
            <NotificationRow
              key={n.id}
              n={n}
              first={i === 0}
              onPress={() => open(n)}
            />
          ))}
        </Scroll>
      )}
      <OptionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title="Inbox"
        options={[
          {
            value: "clear",
            label: "Clear all notifications",
            tone: "danger" as const,
          },
        ]}
        onSelect={() => setConfirmClear(true)}
      />
      <ConfirmDialog
        visible={confirmClear}
        title="Clear all notifications?"
        message="This removes every notification in this workspace."
        confirmLabel="Clear all"
        onClose={() => setConfirmClear(false)}
        onConfirm={() => run(() => api.clearAllNotifications(workspaceId))}
      />
    </View>
  );
}
