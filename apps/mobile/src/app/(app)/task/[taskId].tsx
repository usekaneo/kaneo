import { useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { Ellipsis, Link2 } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Share, TextInput, View } from "react-native";

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
import { Properties } from "@/features/task/properties";
import { DescriptionToolbar } from "@/features/task/rich-editor/description-toolbar";
import { InlineDescription } from "@/features/task/rich-editor/inline-description";
import { useCaretFollow } from "@/features/task/rich-editor/use-caret-follow";
import { useRichDescription } from "@/features/task/rich-editor/use-rich-description";
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
  const { t } = useTranslation(["mobile"]);
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
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const description = useRichDescription(
    taskId,
    detail.data?.description ?? "",
  );
  const caret = useCaretFollow(description.focused, description.formats);
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
    planned: t("mobile:taskDetail.status.planned"),
    archived: t("mobile:taskDetail.status.archived"),
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
                label={t("mobile:taskDetail.screen.copyLink")}
                onPress={() =>
                  Clipboard.setStringAsync(webLink).then(() =>
                    toast.show(
                      t("mobile:taskDetail.screen.linkCopied"),
                      "success",
                    ),
                  )
                }
                size={40}
              >
                <Link2 size={18} color={c.ink2} strokeWidth={2} />
              </IconButton>
            ) : null}
            <IconButton
              label={t("mobile:taskDetail.screen.more")}
              onPress={() => setMenu(true)}
              size={40}
            >
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
        behavior="padding"
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <Scroll
          refreshing={detail.isRefetching}
          onRefresh={() =>
            void Promise.all([detail.refetch(), extras.refetch()])
          }
          bottomPadding={24}
          {...caret.scrollProps}
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
                accessibilityHint={t("mobile:taskDetail.screen.editTitle")}
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

            <InlineDescription
              description={d.description}
              editor={description}
              onLayout={caret.onEditorLayout}
            />

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
                  projectId={task.projectId}
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
        {description.focused ? (
          <DescriptionToolbar taskId={task.id} editor={description} />
        ) : (
          <Composer
            taskId={task.id}
            members={members.data ?? []}
            replyTo={replyTo}
          />
        )}
      </KeyboardAvoidingView>
      <OptionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={ticket}
        options={[
          ...(webLink
            ? [{ value: "share", label: t("mobile:taskDetail.menu.share") }]
            : []),
          { value: "duplicate", label: t("mobile:taskDetail.menu.duplicate") },
          { value: "move", label: t("mobile:taskDetail.menu.move") },
          { value: "refresh", label: t("mobile:taskDetail.menu.refresh") },
          {
            value: "delete",
            label: t("mobile:taskDetail.menu.delete"),
            tone: "danger" as const,
          },
        ]}
        onSelect={async (v) => {
          if (v === "share" && webLink)
            void Share.share({
              message: `${ticket} ${task.title}\n${webLink}`,
            });
          if (v === "duplicate") {
            const copy = await run(() => api.duplicateTask(task.id), {
              success: t("mobile:taskDetail.menu.duplicated"),
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
        title={t("mobile:taskDetail.menu.moveTitle")}
        options={projects.map((p) => ({
          value: p.id,
          label: p.name,
          hint: p.slug.toUpperCase(),
        }))}
        onSelect={(projectId) =>
          run(() => api.moveTask(task.id, projectId), {
            success: t("mobile:taskDetail.menu.moved"),
          })
        }
      />
      <ConfirmDialog
        visible={confirmDelete}
        title={t("mobile:taskDetail.menu.deleteTitle")}
        message={t("mobile:taskDetail.menu.deleteMessage", {
          title: task.title,
        })}
        confirmLabel={t("mobile:common.delete")}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          const ok = await run(() => api.deleteTask(task.id), {
            success: t("mobile:taskDetail.menu.deleted"),
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
