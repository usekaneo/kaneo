import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { ListGroupHeader, TaskRow } from "@/components/rows";
import { EmptyState, ErrorState, Loading, Scroll } from "@/components/screen";
import { Txt } from "@/components/text";
import { Segmented } from "@/components/ui";
import { userMessage } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import type { AssignedTask } from "@/lib/api/types";
import { addDays, compareDays, parseDay, ticketId, today } from "@/lib/format";
import { qk } from "@/lib/query";
import { inset, useColors } from "@/theme";

type Grouping = "due" | "project" | "status";

type DueBucket = "overdue" | "today" | "thisWeek" | "later" | "none";

const DUE_ORDER: DueBucket[] = [
  "overdue",
  "today",
  "thisWeek",
  "later",
  "none",
];

/** Groups carry a stable key; due-date groups are labelled at render time. */
function group(
  tasks: AssignedTask[],
  by: Grouping,
): [string, AssignedTask[]][] {
  const map = new Map<string, AssignedTask[]>();
  const add = (key: string, t: AssignedTask) =>
    map.set(key, [...(map.get(key) ?? []), t]);
  if (by === "project") tasks.forEach((t) => add(t.projectName, t));
  else if (by === "status")
    tasks.forEach((t) => add(t.statusName ?? t.status, t));
  else {
    const now = today();
    const weekEnd = addDays(now, 7);
    tasks.forEach((t) => {
      const day = parseDay(t.dueDate);
      if (!day) add("none", t);
      else if (compareDays(day, now) < 0) add("overdue", t);
      else if (compareDays(day, now) === 0) add("today", t);
      else if (compareDays(day, weekEnd) < 0) add("thisWeek", t);
      else add("later", t);
    });
    return DUE_ORDER.filter((k) => map.has(k)).map((k) => [
      k,
      [...map.get(k)!].sort((a, b) =>
        (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"),
      ),
    ]);
  }
  return [...map.entries()];
}

export function MyTasksTab({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const [by, setBy] = useState<Grouping>("due");
  const query = useQuery({
    queryKey: qk.assigned(workspaceId),
    queryFn: () => api.assignedTasks(workspaceId),
  });
  const tasks = query.data?.tasks ?? [];
  const dueLabel = (bucket: DueBucket) => {
    switch (bucket) {
      case "overdue":
        return t("mobile:myTasks.due.overdue");
      case "today":
        return t("mobile:myTasks.due.today");
      case "thisWeek":
        return t("mobile:myTasks.due.thisWeek");
      case "later":
        return t("mobile:myTasks.due.later");
      case "none":
        return t("mobile:myTasks.due.none");
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          paddingHorizontal: inset,
          paddingTop: 8,
          paddingBottom: 14,
          gap: 14,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            height: 36,
          }}
        >
          <Txt variant="title">{t("mobile:myTasks.title")}</Txt>
          {query.data ? (
            <Txt variant="meta" tone="muted">
              {t("mobile:myTasks.assigned", { count: tasks.length })}
            </Txt>
          ) : null}
        </View>
        <Segmented
          value={by}
          onChange={setBy}
          options={[
            { value: "due", label: t("mobile:myTasks.by.due") },
            { value: "project", label: t("mobile:myTasks.by.project") },
            { value: "status", label: t("mobile:myTasks.by.status") },
          ]}
        />
      </View>
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState
          message={userMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : tasks.length === 0 ? (
        <EmptyState
          title={t("mobile:myTasks.empty.title")}
          message={t("mobile:myTasks.empty.message")}
        />
      ) : (
        <Scroll
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          style={{
            backgroundColor: c.surface,
            borderTopWidth: 1,
            borderTopColor: c.hairline,
          }}
        >
          {group(tasks, by).map(([key, items]) => (
            <View key={key}>
              <ListGroupHeader
                title={by === "due" ? dueLabel(key as DueBucket) : key}
                count={items.length}
                danger={by === "due" && key === "overdue"}
              />
              {items.map((task) => (
                <TaskRow
                  key={task.id}
                  title={task.title}
                  ticket={ticketId(task.projectSlug, task.number)}
                  project={by === "project" ? null : task.projectName}
                  labels={task.labels}
                  dueDate={task.dueDate}
                  status={task.status}
                  statusIcon={task.statusIcon}
                  onPress={() =>
                    router.push({
                      pathname: "/task/[taskId]",
                      params: { taskId: task.id },
                    })
                  }
                />
              ))}
            </View>
          ))}
          {query.data?.total && query.data.total > tasks.length ? (
            <Txt variant="caption" tone="muted" style={{ padding: 16 }}>
              {t("mobile:myTasks.showing", {
                shown: tasks.length,
                total: query.data.total,
              })}
            </Txt>
          ) : null}
        </Scroll>
      )}
    </View>
  );
}
