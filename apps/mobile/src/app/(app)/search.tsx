import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { CircleX, Search } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, TextInput, View } from "react-native";

import { Avatar } from "@/components/avatar";
import { ProjectIcon, StatusIcon } from "@/components/icons";
import { BackButton, EmptyState, Screen } from "@/components/screen";
import { Txt } from "@/components/text";
import { useToast } from "@/components/toast";
import { Segmented, Touch } from "@/components/ui";
import { userMessage } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import type { SearchResult } from "@/lib/api/types";
import { relativeLong, ticketId } from "@/lib/format";
import { toPlainText } from "@/lib/markdown";
import { qk } from "@/lib/query";
import { font, inset, useColors } from "@/theme";

type Kind = "all" | "tasks" | "projects" | "comments";

export default function SearchScreen() {
  const { workspaceId } = useLocalSearchParams<{ workspaceId: string }>();
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const toast = useToast();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("all");

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);

  const search = useQuery({
    queryKey: qk.search(workspaceId, query, kind),
    queryFn: () => api.search(query, workspaceId, kind),
    enabled: query.length > 0,
  });
  const groups: { title: string; type: string }[] = [
    { title: t("mobile:search.kinds.tasks"), type: "task" },
    { title: t("mobile:search.kinds.comments"), type: "comment" },
    { title: t("mobile:search.kinds.activity"), type: "activity" },
    { title: t("mobile:search.kinds.projects"), type: "project" },
  ];
  // Only count result types the screen has a group for, so the empty state still shows.
  const results = (search.data?.results ?? []).filter((r) =>
    groups.some((g) => g.type === r.type),
  );

  const commentMeta = (r: SearchResult) => {
    const when = relativeLong(r.createdAt);
    if (r.userName && when)
      return t("mobile:search.commentMeta", { name: r.userName, when });
    return r.userName ?? when;
  };

  const openTask = (id: string) =>
    router.push({ pathname: "/task/[taskId]", params: { taskId: id } });
  const open = async (r: SearchResult) => {
    if (r.type === "task") return openTask(r.id);
    if (r.type === "project")
      return router.push({
        pathname: "/board/[projectId]",
        params: { projectId: r.id, workspaceId: r.workspaceId ?? workspaceId },
      });
    // Comment and activity hits only carry the task's ticket key, so resolve it to a task id.
    if (r.projectSlug && r.taskNumber) {
      try {
        const task = await api.taskByTicketId(
          `${r.projectSlug.toUpperCase()}-${r.taskNumber}`,
          workspaceId,
        );
        openTask(task.id);
      } catch (e) {
        toast.show(userMessage(e), "error");
      }
    } else if (r.projectId) {
      router.push({
        pathname: "/board/[projectId]",
        params: { projectId: r.projectId, workspaceId },
      });
    }
  };

  return (
    <Screen surface>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingLeft: 6,
          paddingRight: inset,
          paddingTop: 6,
          paddingBottom: 12,
        }}
      >
        <BackButton />
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            height: 44,
            paddingHorizontal: 12,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: c.ink,
          }}
        >
          <Search size={16} color={c.muted} strokeWidth={2} />
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t("mobile:search.placeholder")}
            placeholderTextColor={c.placeholder}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            selectionColor={c.ink}
            style={{
              flex: 1,
              color: c.ink,
              fontFamily: font.regular,
              fontSize: 15,
              height: 42,
            }}
          />
          {search.isFetching ? (
            <ActivityIndicator size="small" color={c.muted} />
          ) : null}
          {input ? (
            <Touch
              onPress={() => setInput("")}
              hitSlop={8}
              accessibilityLabel={t("mobile:search.clear")}
            >
              <CircleX size={16} color={c.placeholder} fill={c.fill} />
            </Touch>
          ) : null}
        </View>
      </View>
      <View
        style={{
          paddingHorizontal: inset,
          paddingBottom: 8,
          borderBottomWidth: 1,
          borderBottomColor: c.divider,
        }}
      >
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: "all", label: t("mobile:search.kinds.all") },
            { value: "tasks", label: t("mobile:search.kinds.tasks") },
            { value: "projects", label: t("mobile:search.kinds.projects") },
            { value: "comments", label: t("mobile:search.kinds.comments") },
          ]}
        />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {!query ? (
          <EmptyState
            title={t("mobile:search.empty.title")}
            message={t("mobile:search.empty.message")}
          />
        ) : search.error ? (
          <EmptyState
            title={t("mobile:search.failed")}
            message={userMessage(search.error)}
          />
        ) : !search.isFetching && results.length === 0 ? (
          <EmptyState title={t("mobile:search.noResults", { query })} />
        ) : (
          groups.map((g) => {
            const items = results.filter((r) => r.type === g.type);
            if (!items.length) return null;
            const isNote = g.type === "comment" || g.type === "activity";
            return (
              <View key={g.type} style={{ paddingTop: 16 }}>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 8,
                    paddingHorizontal: inset,
                    paddingBottom: 6,
                  }}
                >
                  <Txt variant="caption" weight="medium" tone="muted">
                    {g.title}
                  </Txt>
                  <Txt variant="caption" tone="faint">
                    {items.length}
                  </Txt>
                </View>
                {items.map((r) => (
                  <Touch
                    key={r.type + r.id}
                    onPress={() => open(r)}
                    style={{
                      flexDirection: "row",
                      alignItems: isNote ? "flex-start" : "center",
                      gap: 12,
                      minHeight: 56,
                      paddingHorizontal: inset,
                      paddingVertical: 10,
                    }}
                  >
                    <View
                      style={{
                        width: isNote ? 24 : 16,
                        paddingTop: isNote ? 2 : 0,
                      }}
                    >
                      {g.type === "task" ? (
                        <StatusIcon status={r.status ?? "to-do"} />
                      ) : isNote ? (
                        <Avatar name={r.userName ?? "?"} size={24} />
                      ) : (
                        <ProjectIcon color={c.ink2} />
                      )}
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Txt
                        variant={isNote ? "bodySm" : "body"}
                        tone={isNote ? "body" : "ink"}
                        numberOfLines={isNote ? 3 : 1}
                        style={{ lineHeight: 20 }}
                      >
                        {isNote ? toPlainText(r.content ?? r.title) : r.title}
                      </Txt>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {r.taskNumber ? (
                          <Txt variant="mono" tone="muted">
                            {ticketId(r.projectSlug, r.taskNumber)}
                          </Txt>
                        ) : null}
                        <Txt
                          variant="caption"
                          tone="faint"
                          numberOfLines={1}
                          style={{ flex: 1 }}
                        >
                          {isNote
                            ? commentMeta(r)
                            : (r.projectName ??
                              (g.type === "project"
                                ? r.projectSlug?.toUpperCase()
                                : ""))}
                        </Txt>
                      </View>
                    </View>
                  </Touch>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}
