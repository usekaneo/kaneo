import { useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { Ellipsis, Link2 } from "lucide-react-native";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Share,
  TextInput,
  View,
} from "react-native";

import { MarkdownText } from "@/components/markdown";
import {
  ErrorState,
  Loading,
  Screen,
  Scroll,
  TopBar,
  goBack,
} from "@/components/screen";
import { ConfirmDialog, OptionSheet } from "@/components/sheet";
import { Txt } from "@/components/text";
import { useToast } from "@/components/toast";
import { IconButton, Touch } from "@/components/ui";
import { Composer } from "@/features/task/composer";
import { DescriptionEditor } from "@/features/task/description-editor";
import { Properties } from "@/features/task/properties";
import {
  ActivityFeed,
  CustomFields,
  Links,
  Relations,
  Subtasks,
  TimeTracking,
} from "@/features/task/sections";
import { useTaskDetail, useTaskExtras } from "@/features/task/use-task";
import { userMessage } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import { ticketId } from "@/lib/format";
import { useMembers } from "@/lib/hooks";
import { useAction } from "@/lib/query";
import { useRealtime } from "@/lib/realtime";
import { useRequiredSession } from "@/lib/session";
import { font, useColors } from "@/theme";

export default function TaskScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const c = useColors();
  const session = useRequiredSession();
  const toast = useToast();
  const client = useQueryClient();
  const { run } = useAction();
  const detail = useTaskDetail(taskId);
  const task = detail.data?.task;
  const extras = useTaskExtras(taskId, task?.projectId);
  const workspaceId =
    task?.workspaceId ?? detail.data?.project?.workspaceId ?? null;
  const members = useMembers(workspaceId, task?.projectId);
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [movePicker, setMovePicker] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [projects, setProjects] = useState<
    { id: string; name: string; slug: string }[]
  >([]);

  useRealtime(task ? `api/ws/${task.projectId}` : null, (event) => {
    if (!event.taskId || event.taskId === taskId) {
      void detail.refetch();
      void extras.refetch();
    }
  });

  if (detail.isLoading) {
    return (
      <Screen surface>
        <TopBar />
        <Loading />
      </Screen>
    );
  }
  if (!detail.data || !task) {
    return (
      <Screen surface>
        <TopBar />
        <ErrorState
          message={userMessage(detail.error)}
          onRetry={() => void detail.refetch()}
        />
      </Screen>
    );
  }

  const d = detail.data;
  const ticket = ticketId(d.project?.slug, task.number);
  const webLink = workspaceId
    ? `${session.serverUrl}/dashboard/workspace/${workspaceId}/project/${task.projectId}/task/${task.id}`
    : null;
  const ex = extras.data;
  const statusNames: Record<string, string> = {
    planned: "Planned",
    archived: "Archived",
  };
  d.columns.forEach((col) => (statusNames[col.slug] = col.name));
  const lastCommenter = [...(ex?.activities ?? [])]
    .reverse()
    .find(
      (a) => a.type === "comment" && a.userId && a.userId !== session.userId,
    );
  const replyTo = lastCommenter
    ? members.data
        ?.find((m) => m.id === lastCommenter.userId)
        ?.name.split(" ")[0]
    : null;

  const saveTitle = () => {
    const next = titleDraft?.trim();
    setTitleDraft(null);
    if (next && next !== task.title)
      void run(() => api.updateTitle(task.id, next));
  };

  return (
    <Screen surface>
      <TopBar
        actions={
          <>
            {webLink ? (
              <IconButton
                label="Copy link"
                onPress={() =>
                  Clipboard.setStringAsync(webLink).then(() =>
                    toast.show("Link copied", "success"),
                  )
                }
                size={40}
              >
                <Link2 size={18} color={c.ink2} strokeWidth={2} />
              </IconButton>
            ) : null}
            <IconButton label="More" onPress={() => setMenu(true)} size={40}>
              <Ellipsis size={18} color={c.ink2} />
            </IconButton>
          </>
        }
      >
        <Touch
          onPress={() =>
            workspaceId &&
            router.push({
              pathname: "/board/[projectId]",
              params: { projectId: task.projectId, workspaceId },
            })
          }
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            flexShrink: 1,
          }}
        >
          <Txt
            variant="bodySm"
            tone="muted"
            numberOfLines={1}
            style={{ flexShrink: 1 }}
          >
            {d.project?.name}
          </Txt>
          <Txt variant="bodySm" tone="placeholder">
            /
          </Txt>
          <Txt variant="monoMd">{ticket}</Txt>
        </Touch>
      </TopBar>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <Scroll
          refreshing={detail.isRefetching}
          onRefresh={() =>
            void Promise.all([detail.refetch(), extras.refetch()])
          }
          bottomPadding={24}
        >
          <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 22 }}>
            {titleDraft !== null ? (
              <TextInput
                value={titleDraft}
                onChangeText={setTitleDraft}
                autoFocus
                multiline
                blurOnSubmit
                onBlur={saveTitle}
                onSubmitEditing={saveTitle}
                returnKeyType="done"
                selectionColor={c.ink}
                style={{
                  fontFamily: font.semibold,
                  fontSize: 24,
                  lineHeight: 30,
                  letterSpacing: -0.48,
                  color: c.ink,
                  padding: 0,
                }}
              />
            ) : (
              <Touch
                onPress={() => setTitleDraft(task.title)}
                accessibilityHint="Edit title"
              >
                <Txt variant="h2">{task.title}</Txt>
              </Touch>
            )}

            <Properties
              detail={d}
              members={members.data ?? []}
              currentUserId={session.userId}
              workspaceId={workspaceId}
            />

            <Touch
              onPress={() => setEditingDescription(true)}
              accessibilityHint="Edit description"
            >
              {d.description.trim() ? (
                <MarkdownText>{d.description}</MarkdownText>
              ) : (
                <Txt variant="body" tone="placeholder">
                  Add a description…
                </Txt>
              )}
            </Touch>

            {ex ? (
              <>
                <CustomFields taskId={task.id} extras={ex} />
                <Subtasks
                  taskId={task.id}
                  relations={ex.relations}
                  onOpen={(id) =>
                    router.push({
                      pathname: "/task/[taskId]",
                      params: { taskId: id },
                    })
                  }
                  onAdd={() =>
                    workspaceId &&
                    router.push({
                      pathname: "/task/new",
                      params: {
                        projectId: task.projectId,
                        workspaceId,
                        parentTaskId: task.id,
                      },
                    })
                  }
                />
                <Relations
                  taskId={task.id}
                  relations={ex.relations}
                  workspaceId={workspaceId}
                  onOpen={(id) =>
                    router.push({
                      pathname: "/task/[taskId]",
                      params: { taskId: id },
                    })
                  }
                />
                <Links taskId={task.id} extras={ex} />
                <TimeTracking
                  taskId={task.id}
                  ticket={ticket}
                  title={task.title}
                  entries={ex.timeEntries}
                  currentUserId={session.userId}
                />
                <ActivityFeed
                  activities={ex.activities}
                  members={members.data ?? []}
                  currentUserId={session.userId}
                  currentUserName={session.userName}
                  statusNames={statusNames}
                />
              </>
            ) : (
              <Loading />
            )}
          </View>
        </Scroll>
        <Composer
          taskId={task.id}
          members={members.data ?? []}
          replyTo={replyTo}
        />
      </KeyboardAvoidingView>

      <DescriptionEditor
        visible={editingDescription}
        onClose={() => setEditingDescription(false)}
        taskId={task.id}
        initial={d.description}
        onSave={(text) => run(() => api.updateDescription(task.id, text))}
      />
      <OptionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={ticket}
        options={[
          ...(webLink ? [{ value: "share", label: "Share" }] : []),
          { value: "duplicate", label: "Duplicate" },
          { value: "move", label: "Move to project…" },
          { value: "refresh", label: "Refresh" },
          { value: "delete", label: "Delete task", tone: "danger" as const },
        ]}
        onSelect={async (v) => {
          if (v === "share" && webLink)
            void Share.share({
              message: `${ticket} ${task.title}\n${webLink}`,
            });
          if (v === "duplicate") {
            const copy = await run(() => api.duplicateTask(task.id), {
              success: "Task duplicated",
            });
            if (copy)
              router.push({
                pathname: "/task/[taskId]",
                params: { taskId: copy.id },
              });
          }
          if (v === "move" && workspaceId) {
            const list = await api.projects(workspaceId).catch(() => []);
            setProjects(
              list.filter((p) => p.id !== task.projectId && !p.archivedAt),
            );
            setMovePicker(true);
          }
          if (v === "refresh")
            void Promise.all([detail.refetch(), extras.refetch()]);
          if (v === "delete") setConfirmDelete(true);
        }}
      />
      <OptionSheet
        visible={movePicker}
        onClose={() => setMovePicker(false)}
        title="Move to project"
        options={projects.map((p) => ({
          value: p.id,
          label: p.name,
          hint: p.slug.toUpperCase(),
        }))}
        onSelect={(projectId) =>
          run(() => api.moveTask(task.id, projectId), { success: "Task moved" })
        }
      />
      <ConfirmDialog
        visible={confirmDelete}
        title="Delete task?"
        message={`“${task.title}” and its comments will be permanently deleted.`}
        confirmLabel="Delete"
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          const ok = await run(() => api.deleteTask(task.id), {
            success: "Task deleted",
            refresh: false,
          });
          if (ok !== undefined) {
            goBack();
            // Refresh everything except this task's own queries, which would now 404.
            client.removeQueries({ queryKey: ["task", task.id] });
            void client.invalidateQueries({
              predicate: (q) => q.queryKey[1] !== task.id,
            });
          }
        }}
      />
    </Screen>
  );
}
