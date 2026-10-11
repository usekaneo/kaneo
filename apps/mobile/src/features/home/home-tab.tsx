import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ChevronDown, Plus, Search } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import { Avatar } from "@/components/avatar";
import { ProjectIcon } from "@/components/icons";
import { TaskRow } from "@/components/rows";
import { EmptyState, ErrorState, Loading, Scroll } from "@/components/screen";
import { Txt } from "@/components/text";
import {
  Group,
  IconButton,
  ProgressBar,
  Section,
  Touch,
} from "@/components/ui";
import { userMessage } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import type { Project, Workspace } from "@/lib/api/types";
import {
  formatDate,
  formatLongDate,
  greeting,
  parseDay,
  ticketId,
} from "@/lib/format";
import { useMe } from "@/lib/hooks";
import { qk } from "@/lib/query";
import { inset, useColors } from "@/theme";

import { NewProjectSheet } from "./new-project-sheet";

export function WorkspaceHeader({
  workspace,
  onSwitch,
}: {
  workspace: Workspace;
  onSwitch: () => void;
}) {
  const c = useColors();
  const me = useMe();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        height: 44,
        paddingHorizontal: inset,
      }}
    >
      <Touch
        onPress={onSwitch}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 8,
          flexShrink: 1,
        }}
        accessibilityLabel="Switch workspace"
      >
        <Txt
          variant="body"
          weight="medium"
          numberOfLines={1}
          style={{ flexShrink: 1 }}
        >
          {workspace.name}
        </Txt>
        <ChevronDown size={14} color={c.faint} strokeWidth={2} />
      </Touch>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <IconButton
          label="Search"
          onPress={() =>
            router.push({
              pathname: "/search",
              params: { workspaceId: workspace.id },
            })
          }
        >
          <Search size={18} color={c.ink2} strokeWidth={2} />
        </IconButton>
        <Touch
          onPress={() => router.push("/account")}
          accessibilityLabel="Account"
          hitSlop={6}
        >
          <Avatar name={me.data?.name} image={me.data?.image} size={30} />
        </Touch>
      </View>
    </View>
  );
}

function ProjectRow({
  project,
  last,
  onPress,
}: {
  project: Project;
  last?: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const pct = Math.round(project.statistics?.completionPercentage ?? 0);
  const total = Math.round(project.statistics?.totalTasks ?? 0);
  const done = Math.round((pct / 100) * total);
  const due = project.statistics?.dueDate;
  const archived = !!project.archivedAt;
  return (
    <Touch
      onPress={onPress}
      style={{
        padding: 14,
        gap: 10,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.divider,
        opacity: archived ? 0.6 : 1,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <ProjectIcon name={project.icon} color={c.ink2} />
        <Txt
          variant="body"
          weight="medium"
          style={{ flex: 1 }}
          numberOfLines={1}
        >
          {project.name}
        </Txt>
        <Txt variant="caption" tone="muted">
          {archived
            ? "Archived"
            : due
              ? `Due ${formatDate(due)}`
              : total
                ? `${done} of ${total}`
                : "No tasks"}
        </Txt>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingLeft: 28,
        }}
      >
        <ProgressBar value={pct} />
        <Txt
          variant="mono"
          tone="muted"
          style={{ width: 34, textAlign: "right" }}
        >
          {pct}%
        </Txt>
      </View>
    </Touch>
  );
}

export function HomeTabView({
  workspace,
  onSwitch,
  onViewAllTasks,
}: {
  workspace: Workspace;
  onSwitch: () => void;
  onViewAllTasks: () => void;
}) {
  const c = useColors();
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const projects = useQuery({
    queryKey: qk.projects(workspace.id, showArchived),
    queryFn: () => api.projects(workspace.id, showArchived),
  });
  const assigned = useQuery({
    queryKey: qk.assigned(workspace.id),
    queryFn: () => api.assignedTasks(workspace.id),
  });

  const upNext = [...(assigned.data?.tasks ?? [])]
    .sort((a, b) => {
      const da = parseDay(a.dueDate);
      const db = parseDay(b.dueDate);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return a.dueDate!.localeCompare(b.dueDate!);
    })
    .slice(0, 3);
  const sorted = [...(projects.data ?? [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );
  const refreshing = projects.isRefetching || assigned.isRefetching;

  return (
    <Scroll
      refreshing={refreshing}
      onRefresh={() => {
        void projects.refetch();
        void assigned.refetch();
      }}
      bottomPadding={24}
    >
      <WorkspaceHeader workspace={workspace} onSwitch={onSwitch} />
      <View
        style={{
          paddingHorizontal: inset,
          paddingTop: 8,
          paddingBottom: 18,
          gap: 4,
        }}
      >
        <Txt variant="meta" tone="muted">
          {formatLongDate()}
        </Txt>
        <Txt variant="title">{greeting()}</Txt>
      </View>

      {upNext.length ? (
        <Section
          title="Up next"
          style={{ paddingBottom: 24 }}
          aside={
            <Touch onPress={onViewAllTasks} hitSlop={8}>
              <Txt variant="meta" weight="medium" tone="muted">
                View all
              </Txt>
            </Touch>
          }
        >
          <Group>
            {upNext.map((t, i) => (
              <TaskRow
                key={t.id}
                compact
                title={t.title}
                ticket={ticketId(t.projectSlug, t.number)}
                project={t.projectName}
                dueDate={t.dueDate}
                status={t.status}
                statusIcon={t.statusIcon}
                last={i === upNext.length - 1}
                onPress={() =>
                  router.push({
                    pathname: "/task/[taskId]",
                    params: { taskId: t.id },
                  })
                }
              />
            ))}
          </Group>
        </Section>
      ) : null}

      <Section
        title="Projects"
        aside={
          <IconButton
            label="New project"
            size={28}
            onPress={() => setCreating(true)}
          >
            <Plus size={18} color={c.muted} strokeWidth={2} />
          </IconButton>
        }
      >
        {projects.isLoading ? (
          <Loading />
        ) : projects.error ? (
          <ErrorState
            message={userMessage(projects.error)}
            onRetry={() => void projects.refetch()}
          />
        ) : sorted.length === 0 ? (
          <Group>
            <EmptyState
              title="No projects yet"
              message="Projects hold your boards and tasks."
              action={{
                label: "New project",
                onPress: () => setCreating(true),
              }}
            />
          </Group>
        ) : (
          <Group>
            {sorted.map((p, i) => (
              <ProjectRow
                key={p.id}
                project={p}
                last={i === sorted.length - 1}
                onPress={() =>
                  router.push({
                    pathname: "/board/[projectId]",
                    params: { projectId: p.id, workspaceId: workspace.id },
                  })
                }
              />
            ))}
          </Group>
        )}
        <Touch
          onPress={() => setShowArchived((v) => !v)}
          style={{ alignSelf: "center", padding: 10 }}
        >
          <Txt variant="meta" weight="medium" tone="muted">
            {showArchived ? "Hide archived projects" : "Show archived projects"}
          </Txt>
        </Touch>
      </Section>

      <NewProjectSheet
        visible={creating}
        onClose={() => setCreating(false)}
        workspaceId={workspace.id}
        onCreated={(p) =>
          router.push({
            pathname: "/board/[projectId]",
            params: { projectId: p.id, workspaceId: workspace.id },
          })
        }
      />
    </Scroll>
  );
}
