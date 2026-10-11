import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
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

const DUE_ORDER = ["Overdue", "Today", "This week", "Later", "No due date"];

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
      if (!day) add("No due date", t);
      else if (compareDays(day, now) < 0) add("Overdue", t);
      else if (compareDays(day, now) === 0) add("Today", t);
      else if (compareDays(day, weekEnd) < 0) add("This week", t);
      else add("Later", t);
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
  const c = useColors();
  const [by, setBy] = useState<Grouping>("due");
  const query = useQuery({
    queryKey: qk.assigned(workspaceId),
    queryFn: () => api.assignedTasks(workspaceId),
  });
  const tasks = query.data?.tasks ?? [];

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
          <Txt variant="title">My tasks</Txt>
          {query.data ? (
            <Txt variant="meta" tone="muted">
              {tasks.length} assigned
            </Txt>
          ) : null}
        </View>
        <Segmented
          value={by}
          onChange={setBy}
          options={[
            { value: "due", label: "Due date" },
            { value: "project", label: "Project" },
            { value: "status", label: "Status" },
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
          title="Nothing assigned to you"
          message="Tasks assigned to you in this workspace show up here."
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
          {group(tasks, by).map(([title, items]) => (
            <View key={title}>
              <ListGroupHeader
                title={title}
                count={items.length}
                danger={by === "due" && title === "Overdue"}
              />
              {items.map((t) => (
                <TaskRow
                  key={t.id}
                  title={t.title}
                  ticket={ticketId(t.projectSlug, t.number)}
                  project={by === "project" ? null : t.projectName}
                  labels={t.labels}
                  dueDate={t.dueDate}
                  status={t.status}
                  statusIcon={t.statusIcon}
                  onPress={() =>
                    router.push({
                      pathname: "/task/[taskId]",
                      params: { taskId: t.id },
                    })
                  }
                />
              ))}
            </View>
          ))}
          {query.data?.total && query.data.total > tasks.length ? (
            <Txt variant="caption" tone="muted" style={{ padding: 16 }}>
              Showing {tasks.length} of {query.data.total} tasks
            </Txt>
          ) : null}
        </Scroll>
      )}
    </View>
  );
}
