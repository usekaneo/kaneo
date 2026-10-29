import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Avatar } from "@/components/avatar";
import { EmptyState, ErrorState, Loading, Scroll } from "@/components/screen";
import { Txt } from "@/components/text";
import { Touch } from "@/components/ui";
import { userMessage } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import type { Workspace } from "@/lib/api/types";
import { describeActivity } from "@/lib/describe";
import { relativeShort, ticketId } from "@/lib/format";
import { toPlainText } from "@/lib/markdown";
import { qk } from "@/lib/query";
import { inset, useColors } from "@/theme";

export function ActivityTab({ workspace }: { workspace: Workspace }) {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const query = useQuery({
    queryKey: qk.activity(workspace.id),
    queryFn: () => api.workspaceActivity(workspace.id),
  });
  const items = query.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <View
        style={{
          paddingHorizontal: inset,
          paddingTop: 8,
          paddingBottom: 18,
          gap: 2,
        }}
      >
        <Txt variant="title">{t("mobile:activity.title")}</Txt>
        <Txt variant="meta" tone="muted" style={{ lineHeight: 18 }}>
          {t("mobile:activity.subtitle", { workspace: workspace.name })}
        </Txt>
      </View>
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState
          message={userMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState title={t("mobile:activity.empty")} />
      ) : (
        <Scroll
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
        >
          <View style={{ paddingHorizontal: inset }}>
            {items.map((a, i) => {
              const name =
                a.userName ??
                a.externalUserName ??
                t("mobile:activity.someone");
              const ticket = ticketId(a.projectSlug, a.taskNumber);
              const isComment = a.type === "comment";
              const sentence = isComment
                ? t("mobile:activity.commentedOn", {
                    target: ticket || a.taskTitle,
                  })
                : describeActivity(a.type, a.eventData, a.excerpt);
              const last = i === items.length - 1;
              return (
                <Touch
                  key={a.id}
                  onPress={() =>
                    router.push({
                      pathname: "/task/[taskId]",
                      params: { taskId: a.taskId },
                    })
                  }
                  style={{ flexDirection: "row", gap: 12 }}
                >
                  <View style={{ alignItems: "center", width: 28, gap: 6 }}>
                    <Avatar name={name} image={a.userImage} size={28} />
                    {!last ? (
                      <View
                        style={{
                          width: 1,
                          flex: 1,
                          backgroundColor: c.divider,
                        }}
                      />
                    ) : null}
                  </View>
                  <View
                    style={{
                      flex: 1,
                      gap: 8,
                      paddingTop: 4,
                      paddingBottom: 20,
                    }}
                  >
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Txt
                        variant="bodySm"
                        tone="body"
                        style={{ flex: 1, lineHeight: 20 }}
                      >
                        <Txt variant="bodySm" weight="semibold">
                          {name}
                        </Txt>{" "}
                        {sentence}
                      </Txt>
                      <Txt
                        variant="caption"
                        tone="faint"
                        style={{ paddingTop: 2 }}
                      >
                        {relativeShort(a.createdAt)}
                      </Txt>
                    </View>
                    {isComment && a.excerpt ? (
                      <View
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          borderRadius: 10,
                          backgroundColor: c.input,
                        }}
                      >
                        <Txt
                          variant="bodySm"
                          tone="body"
                          numberOfLines={4}
                          style={{ lineHeight: 20 }}
                        >
                          {toPlainText(a.excerpt)}
                        </Txt>
                      </View>
                    ) : !isComment ? (
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {ticket ? (
                          <Txt variant="mono" tone="muted">
                            {ticket}
                          </Txt>
                        ) : null}
                        <Txt
                          variant="caption"
                          tone="faint"
                          numberOfLines={1}
                          style={{ flex: 1 }}
                        >
                          {a.taskTitle}
                        </Txt>
                      </View>
                    ) : null}
                  </View>
                </Touch>
              );
            })}
          </View>
        </Scroll>
      )}
    </View>
  );
}
