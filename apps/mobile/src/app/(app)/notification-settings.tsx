import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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

type Channel = "ntfy" | "gotify" | "webhook";

function ConfiguredPill() {
  const { t } = useTranslation(["mobile"]);
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
        {t("mobile:notificationSettings.on")}
      </Txt>
    </View>
  );
}

export default function NotificationSettingsScreen() {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const { run } = useAction();
  const query = useQuery({
    queryKey: qk.notificationPrefs,
    queryFn: api.notificationPreferences,
  });
  const [channel, setChannel] = useState<Channel | null>(null);
  const [leadPicker, setLeadPicker] = useState(false);
  const p = query.data;
  const leadTimes = [
    { value: 15, label: t("mobile:notificationSettings.leadTime.minutes15") },
    { value: 60, label: t("mobile:notificationSettings.leadTime.hour1") },
    { value: 180, label: t("mobile:notificationSettings.leadTime.hours3") },
    { value: 1440, label: t("mobile:notificationSettings.leadTime.day1") },
    { value: 2880, label: t("mobile:notificationSettings.leadTime.days2") },
    { value: 10080, label: t("mobile:notificationSettings.leadTime.week1") },
  ];
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
          {configured
            ? t("mobile:notificationSettings.off")
            : t("mobile:notificationSettings.notSet")}
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
          title={t("mobile:notificationSettings.title")}
          description={t("mobile:notificationSettings.description")}
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
            <Section
              title={t("mobile:notificationSettings.delivery.title")}
              style={{ paddingBottom: 24 }}
            >
              <Group>
                {toggleRow(
                  t("mobile:notificationSettings.delivery.email"),
                  p.emailAddress ??
                    t("mobile:notificationSettings.delivery.emailHint"),
                  !!p.emailEnabled,
                  (v) => update({ emailEnabled: v }),
                )}
                {channelRow(
                  "ntfy",
                  "ntfy",
                  t("mobile:notificationSettings.delivery.ntfyHint"),
                  !!p.ntfyEnabled,
                  !!p.ntfyTopic,
                )}
                {channelRow(
                  "gotify",
                  "Gotify",
                  t("mobile:notificationSettings.delivery.gotifyHint"),
                  !!p.gotifyEnabled,
                  !!p.gotifyServerUrl,
                )}
                {channelRow(
                  "webhook",
                  t("mobile:notificationSettings.delivery.webhook"),
                  t("mobile:notificationSettings.delivery.webhookHint"),
                  !!p.webhookEnabled,
                  !!p.webhookUrl,
                  true,
                )}
              </Group>
            </Section>
            <Section title={t("mobile:notificationSettings.events.title")}>
              <Group>
                {toggleRow(
                  t("mobile:notificationSettings.events.assignments"),
                  t("mobile:notificationSettings.events.assignmentsHint"),
                  p.taskAssignmentEnabled !== false,
                  (v) => update({ taskAssignmentEnabled: v }),
                )}
                {toggleRow(
                  t("mobile:notificationSettings.events.comments"),
                  t("mobile:notificationSettings.events.commentsHint"),
                  p.taskCommentEnabled !== false,
                  (v) => update({ taskCommentEnabled: v }),
                )}
                {toggleRow(
                  t("mobile:notificationSettings.events.statusChanges"),
                  t("mobile:notificationSettings.events.statusChangesHint"),
                  p.taskStatusChangeEnabled !== false,
                  (v) => update({ taskStatusChangeEnabled: v }),
                )}
                {toggleRow(
                  t("mobile:notificationSettings.events.dueDate"),
                  t("mobile:notificationSettings.events.dueDateHint"),
                  !!p.dueDateReminderEnabled,
                  (v) => update({ dueDateReminderEnabled: v }),
                  !p.dueDateReminderEnabled,
                )}
                {p.dueDateReminderEnabled ? (
                  <GroupRow last>
                    <Txt variant="body" tone="muted" style={{ flex: 1 }}>
                      {t("mobile:notificationSettings.events.remindMe")}
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
                        {t("mobile:notificationSettings.events.remindBefore", {
                          time:
                            leadTimes.find(
                              (l) =>
                                l.value === p.dueDateReminderLeadTimeMinutes,
                            )?.label ??
                            t("mobile:notificationSettings.leadTime.minutes", {
                              count: p.dueDateReminderLeadTimeMinutes,
                            }),
                        })}
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
        title={t("mobile:notificationSettings.events.remindPickerTitle")}
        selected={p?.dueDateReminderLeadTimeMinutes}
        options={leadTimes}
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
  const { t } = useTranslation(["mobile"]);
  const title =
    channel === "ntfy"
      ? "ntfy"
      : channel === "gotify"
        ? "Gotify"
        : t("mobile:notificationSettings.delivery.webhook");
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
  const { t } = useTranslation(["mobile"]);
  const [initial] = useState(() => initialChannel(channel, prefs));
  const [enabled, setEnabled] = useState(initial.enabled);
  const [url, setUrl] = useState(initial.url);
  const [topic, setTopic] = useState(initial.topic);
  const [secret, setSecret] = useState("");
  const secretLabel =
    channel === "ntfy"
      ? t("mobile:notificationSettings.channel.accessToken")
      : channel === "gotify"
        ? t("mobile:notificationSettings.channel.appToken")
        : t("mobile:notificationSettings.channel.signingSecret");

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
        <Txt variant="bodySm">
          {t("mobile:notificationSettings.channel.enabled")}
        </Txt>
        <Switch value={enabled} onChange={setEnabled} />
      </View>
      <TextField
        label={
          channel === "webhook"
            ? t("mobile:notificationSettings.channel.webhookUrl")
            : t("mobile:notificationSettings.channel.serverUrl")
        }
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
          label={t("mobile:notificationSettings.channel.topic")}
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
            ? t("mobile:notificationSettings.channel.secretSaved")
            : t("mobile:notificationSettings.channel.secretOptional")
        }
        value={secret}
        onChangeText={setSecret}
        secureTextEntry
        autoCapitalize="none"
        mono
      />
      <Button label={t("mobile:common.save")} onPress={save} />
    </View>
  );
}
