import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import {
  ErrorState,
  Loading,
  PageHeader,
  Screen,
  Scroll,
} from "@/components/screen";
import { OptionSheet, Sheet } from "@/components/sheet";
import { Txt } from "@/components/text";
import {
  Button,
  Group,
  GroupRow,
  Section,
  Switch,
  TextField,
  Touch,
} from "@/components/ui";
import { userMessage } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import type {
  NotificationPreferences,
  UpdateNotificationPreferences,
} from "@/lib/api/types";
import { qk, useAction } from "@/lib/query";
import { useColors } from "@/theme";

const LEAD_TIMES = [
  { value: 15, label: "15 minutes" },
  { value: 60, label: "1 hour" },
  { value: 180, label: "3 hours" },
  { value: 1440, label: "1 day" },
  { value: 2880, label: "2 days" },
  { value: 10080, label: "1 week" },
];

type Channel = "ntfy" | "gotify" | "webhook";

function ConfiguredPill() {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        height: 22,
        paddingHorizontal: 8,
        borderRadius: 999,
        backgroundColor: c.successSoft,
      }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: c.success,
        }}
      />
      <Txt variant="micro" color={c.successFg}>
        On
      </Txt>
    </View>
  );
}

export default function NotificationSettingsScreen() {
  const c = useColors();
  const { run } = useAction();
  const query = useQuery({
    queryKey: qk.notificationPrefs,
    queryFn: api.notificationPreferences,
  });
  const [channel, setChannel] = useState<Channel | null>(null);
  const [leadPicker, setLeadPicker] = useState(false);
  const p = query.data;
  const update = (body: UpdateNotificationPreferences) =>
    run(() => api.updateNotificationPreferences(body));

  const toggleRow = (
    title: string,
    hint: string,
    value: boolean,
    onChange: (v: boolean) => void,
    last = false,
  ) => (
    <GroupRow last={last}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="body">{title}</Txt>
        <Txt variant="caption" tone="faint">
          {hint}
        </Txt>
      </View>
      <Switch value={value} onChange={onChange} />
    </GroupRow>
  );

  const channelRow = (
    key: Channel,
    title: string,
    hint: string,
    enabled: boolean,
    configured: boolean,
    last = false,
  ) => (
    <GroupRow last={last} onPress={() => setChannel(key)}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="body">{title}</Txt>
        <Txt variant="caption" tone="faint">
          {hint}
        </Txt>
      </View>
      {enabled ? (
        <ConfiguredPill />
      ) : (
        <Txt variant="caption" tone="faint">
          {configured ? "Off" : "Not set"}
        </Txt>
      )}
      <ChevronRight size={16} color={c.placeholder} />
    </GroupRow>
  );

  return (
    <Screen>
      <Scroll
        bottomPadding={40}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
      >
        <PageHeader
          title="Notifications"
          description="Where Kaneo reaches you, and about what."
        />
        {query.isLoading ? (
          <Loading />
        ) : !p ? (
          <ErrorState
            message={userMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <>
            <Section title="Delivery" style={{ paddingBottom: 24 }}>
              <Group>
                {toggleRow(
                  "Email",
                  p.emailAddress ?? "Sent to your account email",
                  !!p.emailEnabled,
                  (v) => update({ emailEnabled: v }),
                )}
                {channelRow(
                  "ntfy",
                  "ntfy",
                  "Send notifications to an ntfy topic",
                  !!p.ntfyEnabled,
                  !!p.ntfyTopic,
                )}
                {channelRow(
                  "gotify",
                  "Gotify",
                  "Send notifications to a Gotify server",
                  !!p.gotifyEnabled,
                  !!p.gotifyServerUrl,
                )}
                {channelRow(
                  "webhook",
                  "Webhook",
                  "POST notifications to a URL",
                  !!p.webhookEnabled,
                  !!p.webhookUrl,
                  true,
                )}
              </Group>
            </Section>
            <Section title="Notify me about">
              <Group>
                {toggleRow(
                  "Assignments",
                  "When a task is assigned to you",
                  p.taskAssignmentEnabled !== false,
                  (v) => update({ taskAssignmentEnabled: v }),
                )}
                {toggleRow(
                  "Comments",
                  "New comments on your tasks",
                  p.taskCommentEnabled !== false,
                  (v) => update({ taskCommentEnabled: v }),
                )}
                {toggleRow(
                  "Status changes",
                  "When your tasks move between columns",
                  p.taskStatusChangeEnabled !== false,
                  (v) => update({ taskStatusChangeEnabled: v }),
                )}
                {toggleRow(
                  "Due date reminders",
                  "Before a task you’re assigned to is due",
                  !!p.dueDateReminderEnabled,
                  (v) => update({ dueDateReminderEnabled: v }),
                  !p.dueDateReminderEnabled,
                )}
                {p.dueDateReminderEnabled ? (
                  <GroupRow last>
                    <Txt variant="body" tone="muted" style={{ flex: 1 }}>
                      Remind me
                    </Txt>
                    <Touch
                      onPress={() => setLeadPicker(true)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        height: 30,
                        paddingHorizontal: 10,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: c.fillStrong,
                      }}
                    >
                      <Txt variant="meta" weight="medium">
                        {LEAD_TIMES.find(
                          (l) => l.value === p.dueDateReminderLeadTimeMinutes,
                        )?.label ??
                          `${p.dueDateReminderLeadTimeMinutes} minutes`}{" "}
                        before
                      </Txt>
                      <ChevronDown size={12} color={c.faint} />
                    </Touch>
                  </GroupRow>
                ) : null}
              </Group>
            </Section>
          </>
        )}
      </Scroll>
      {p ? (
        <ChannelSheet
          channel={channel}
          prefs={p}
          onClose={() => setChannel(null)}
          onSave={update}
        />
      ) : null}
      <OptionSheet
        visible={leadPicker}
        onClose={() => setLeadPicker(false)}
        title="Remind me before"
        selected={p?.dueDateReminderLeadTimeMinutes}
        options={LEAD_TIMES}
        onSelect={(v) => update({ dueDateReminderLeadTimeMinutes: v })}
      />
    </Screen>
  );
}

function ChannelSheet({
  channel,
  prefs,
  onClose,
  onSave,
}: {
  channel: Channel | null;
  prefs: NotificationPreferences;
  onClose: () => void;
  onSave: (body: UpdateNotificationPreferences) => Promise<unknown>;
}) {
  const title =
    channel === "ntfy" ? "ntfy" : channel === "gotify" ? "Gotify" : "Webhook";
  return (
    <Sheet visible={!!channel} onClose={onClose} title={title}>
      {channel ? (
        <ChannelForm
          channel={channel}
          prefs={prefs}
          onSave={async (body) => {
            await onSave(body);
            onClose();
          }}
        />
      ) : null}
    </Sheet>
  );
}

function initialChannel(channel: Channel, prefs: NotificationPreferences) {
  if (channel === "ntfy")
    return {
      enabled: !!prefs.ntfyEnabled,
      url: prefs.ntfyServerUrl ?? "",
      topic: prefs.ntfyTopic ?? "",
      configured: !!prefs.ntfyTokenConfigured,
    };
  if (channel === "gotify")
    return {
      enabled: !!prefs.gotifyEnabled,
      url: prefs.gotifyServerUrl ?? "",
      topic: "",
      configured: !!prefs.gotifyTokenConfigured,
    };
  return {
    enabled: !!prefs.webhookEnabled,
    url: prefs.webhookUrl ?? "",
    topic: "",
    configured: !!prefs.webhookSecretConfigured,
  };
}

function ChannelForm({
  channel,
  prefs,
  onSave,
}: {
  channel: Channel;
  prefs: NotificationPreferences;
  onSave: (body: UpdateNotificationPreferences) => Promise<void>;
}) {
  const [initial] = useState(() => initialChannel(channel, prefs));
  const [enabled, setEnabled] = useState(initial.enabled);
  const [url, setUrl] = useState(initial.url);
  const [topic, setTopic] = useState(initial.topic);
  const [secret, setSecret] = useState("");
  const secretLabel =
    channel === "ntfy"
      ? "Access token"
      : channel === "gotify"
        ? "App token"
        : "Signing secret";

  // An empty address clears it: the API keeps the stored value for null or a missing field.
  const save = () => {
    const s = secret.trim() || undefined;
    if (channel === "ntfy")
      return onSave({
        ntfyEnabled: enabled,
        ntfyServerUrl: url.trim(),
        ntfyTopic: topic.trim(),
        ntfyToken: s,
      });
    if (channel === "gotify")
      return onSave({
        gotifyEnabled: enabled,
        gotifyServerUrl: url.trim(),
        gotifyToken: s,
      });
    return onSave({
      webhookEnabled: enabled,
      webhookUrl: url.trim(),
      webhookSecret: s,
    });
  };

  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 14 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Txt variant="bodySm">Send notifications here</Txt>
        <Switch value={enabled} onChange={setEnabled} />
      </View>
      <TextField
        label={channel === "webhook" ? "Webhook URL" : "Server URL"}
        value={url}
        onChangeText={setUrl}
        placeholder={channel === "ntfy" ? "https://ntfy.sh" : "https://"}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        mono
      />
      {channel === "ntfy" ? (
        <TextField
          label="Topic"
          value={topic}
          onChangeText={setTopic}
          autoCapitalize="none"
          autoCorrect={false}
          mono
        />
      ) : null}
      <TextField
        label={secretLabel}
        aside={
          initial.configured
            ? "Saved. Enter a new one to replace it"
            : "Optional"
        }
        value={secret}
        onChangeText={setSecret}
        secureTextEntry
        autoCapitalize="none"
        mono
      />
      <Button label="Save" onPress={save} />
    </View>
  );
}
