import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { CircleX, Search } from "lucide-react-native";
import { useEffect, useState } from "react";
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
  const c = useColors();
  const toast = useToast();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("all");

  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  const search = useQuery({
    queryKey: qk.search(workspaceId, query, kind),
    queryFn: () => api.search(query, workspaceId, kind),
    enabled: query.length > 0,
  });
  const results = search.data?.results ?? [];
  const groups: { title: string; type: string }[] = [
    { title: "Tasks", type: "task" },
    { title: "Comments", type: "comment" },
    { title: "Projects", type: "project" },
  ];

  const openTask = (id: string) =>
    router.push({ pathname: "/task/[taskId]", params: { taskId: id } });
  const open = async (r: SearchResult) => {
    if (r.type === "task") return openTask(r.id);
    if (r.type === "project")
      return router.push({
        pathname: "/board/[projectId]",
        params: { projectId: r.id, workspaceId: r.workspaceId ?? workspaceId },
      });
    // Comment hits only carry the task's ticket key, so resolve it to a task id.
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
            placeholder="Search tasks, projects, comments"
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
              accessibilityLabel="Clear"
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
            { value: "all", label: "All" },
            { value: "tasks", label: "Tasks" },
            { value: "projects", label: "Projects" },
            { value: "comments", label: "Comments" },
          ]}
        />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {!query ? (
          <EmptyState
            title="Search this workspace"
            message="Find tasks by title or number, projects, and comments."
          />
        ) : search.error ? (
          <EmptyState
            title="Search failed"
            message={userMessage(search.error)}
          />
        ) : !search.isFetching && results.length === 0 ? (
          <EmptyState title={`No results for “${query}”`} />
        ) : (
          groups.map((g) => {
            const items = results.filter((r) => r.type === g.type);
            if (!items.length) return null;
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
                      alignItems:
                        g.type === "comment" ? "flex-start" : "center",
                      gap: 12,
                      minHeight: 56,
                      paddingHorizontal: inset,
                      paddingVertical: 10,
                    }}
                  >
                    <View
                      style={{
                        width: g.type === "comment" ? 24 : 16,
                        paddingTop: g.type === "comment" ? 2 : 0,
                      }}
                    >
                      {g.type === "task" ? (
                        <StatusIcon status={r.status ?? "to-do"} />
                      ) : g.type === "comment" ? (
                        <Avatar name={r.userName ?? "?"} size={24} />
                      ) : (
                        <ProjectIcon color={c.ink2} />
                      )}
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Txt
                        variant={g.type === "comment" ? "bodySm" : "body"}
                        tone={g.type === "comment" ? "body" : "ink"}
                        numberOfLines={g.type === "comment" ? 3 : 1}
                        style={{ lineHeight: 20 }}
                      >
                        {g.type === "comment"
                          ? toPlainText(r.content ?? r.title)
                          : r.title}
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
                          {g.type === "comment"
                            ? [r.userName, relativeLong(r.createdAt)]
                                .filter(Boolean)
                                .join(", ")
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
