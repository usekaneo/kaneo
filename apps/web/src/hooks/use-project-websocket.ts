import { applyBoardReorder } from "@/components/kanban-board/apply-reorder";
import {
  getBoardCacheVersion,
  markBoardCacheChanged,
} from "@/lib/board-cache-version";
import { windowId } from "@kaneo/libs";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { getApiUrl } from "@/fetchers/get-api-url";
import { authClient } from "@/lib/auth-client";
import getTask from "@/fetchers/task/get-task";
import getLabelsByTask from "@/fetchers/label/get-labels-by-task";
import getExternalLinks from "@/fetchers/external-link/get-external-links";
import type { ResumePreview } from "@/fetchers/integration-sync/types";
import { patchBoardTask } from "@/lib/patch-board-task";
import type { ProjectWithTasks } from "@/types/project";
import {
  hasSyncTaskSample,
  patchSyncTaskTitles,
} from "@/lib/patch-sync-task-titles";

export function getWsUrl(projectId: string) {
  const base = getApiUrl("ws");
  const wsBase = base.replace(/^http/, "ws");
  return `${wsBase}/${encodeURIComponent(projectId)}?windowId=${encodeURIComponent(windowId)}`;
}

const MAX_RETRIES = 5;
const BASE_DELAY = 1000; // 1 second

// Cloudflare closes idle WebSocket connections after 100 seconds of no traffic.
// We send a lightweight ping every 30 seconds to keep the connection alive.
const WS_PING_INTERVAL_MS = 30_000;

export function useProjectWebSocket(projectId: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();

  useEffect(() => {
    if (!projectId || !session?.user?.id) return;

    // Each effect owns its sockets and timers. Late events from an old project
    // or session must not alter the next effect's connection or reconnect it.
    let disposed = false;
    let needsReconcile = false;
    let flushQueued = false;
    const taskVersions = new Map<string, number>();
    const titleVersions = new Map<string, number>();
    const refreshingTasks = new Set<string>();
    let burstReconcileTimer: ReturnType<typeof setTimeout> | null = null;
    function reconcileBurst() {
      if (burstReconcileTimer !== null) clearTimeout(burstReconcileTimer);
      else markBoardCacheChanged(queryClient, projectId);
      burstReconcileTimer = setTimeout(() => {
        burstReconcileTimer = null;
        if (disposed) return;
        needsReconcile = true;
        flushPending();
      }, 200);
    }
    const pendingMessages = new Map<string, string>();
    let activeSocket: WebSocket | null = null;
    let retries = 0;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let healthyTimeout: ReturnType<typeof setTimeout> | null = null;
    let requestSequence = 0;
    const parentCountVersions = new Map<string, number>();
    let pingInterval: ReturnType<typeof setInterval> | null = null;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    function invalidateDetails(message: {
      type: string;
      taskId?: string;
      sourceTaskId?: string;
      targetTaskId?: string;
      linksChanged?: boolean;
    }) {
      if (["PROJECT_UPDATED", "TASK_LABEL_UPDATED"].includes(message.type)) {
        queryClient.invalidateQueries({
          queryKey: ["integration-sync", projectId],
        });
        queryClient.invalidateQueries({
          queryKey: ["integration-sync-preview", projectId],
        });
      }
      if (message.type === "PROJECT_UPDATED") {
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        queryClient.invalidateQueries({ queryKey: ["labels"] });
        if (message.linksChanged)
          queryClient.invalidateQueries({ queryKey: ["external-links"] });
        return;
      }

      if (message.type === "TASK_RELATION_UPDATED") {
        if (message.sourceTaskId) {
          queryClient.invalidateQueries({
            queryKey: ["task", message.sourceTaskId],
          });
          queryClient.invalidateQueries({
            queryKey: ["task-relations", message.sourceTaskId],
          });
        }
        if (message.targetTaskId) {
          queryClient.invalidateQueries({
            queryKey: ["task", message.targetTaskId],
          });
          queryClient.invalidateQueries({
            queryKey: ["task-relations", message.targetTaskId],
          });
        }
        if (!message.sourceTaskId && !message.targetTaskId) {
          queryClient.invalidateQueries({
            queryKey: ["task-relations"],
          });
        }
      } else {
        queryClient.invalidateQueries({
          queryKey: ["task", message.taskId],
        });
      }

      if (message.type === "TASK_LABEL_UPDATED") {
        queryClient.invalidateQueries({
          queryKey: ["labels", message.taskId],
        });
      }

      if (
        (message.type === "TASK_UPDATED" || message.type === "TASK_MOVED") &&
        message.taskId
      ) {
        queryClient.invalidateQueries({
          queryKey: ["external-links", message.taskId],
        });
      }

      if (message.type === "COMMENT_UPDATED") {
        queryClient.invalidateQueries({
          queryKey: ["activities", message.taskId],
        });
        queryClient.invalidateQueries({
          queryKey: ["comments", message.taskId],
        });
      }
    }

    function clearPing() {
      if (pingInterval !== null) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
    }

    function connect() {
      if (disposed) return;
      retryTimeout = null;
      const url = getWsUrl(projectId);
      const ws = new WebSocket(url);
      activeSocket = ws;

      ws.onopen = () => {
        if (disposed || activeSocket !== ws) return;
        needsReconcile = true;
        flushPending();
        if (healthyTimeout !== null) clearTimeout(healthyTimeout);
        healthyTimeout = setTimeout(() => {
          healthyTimeout = null;
          if (disposed || activeSocket !== ws) return;
          retries = 0;
          if (fallbackInterval !== null) {
            clearInterval(fallbackInterval);
            fallbackInterval = null;
          }
        }, WS_PING_INTERVAL_MS);
        // Start keepalive pings to prevent Cloudflare idle timeout (100s)
        clearPing();
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, WS_PING_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        if (disposed || activeSocket !== ws) return;
        try {
          const message = JSON.parse(event.data);
          if (
            message.taskId &&
            [
              "TASK_UPDATED",
              "TASK_LABEL_UPDATED",
              "TASK_MOVED",
              "TASK_DELETED",
            ].includes(message.type)
          )
            // An open comparison needs a fresh token; other tasks and closed
            // dialogs must not cause provider reads during routine edits.
            for (const query of queryClient.getQueryCache().findAll({
              queryKey: ["integration-sync-review", projectId],
              type: "active",
            })) {
              const review = query.state.data as ResumePreview | undefined;
              if ((review?.task.id ?? query.meta?.taskId) !== message.taskId)
                continue;
              const filters = { queryKey: query.queryKey, exact: true };
              // Invalidation reuses an initial fetch with no data. Reset it so
              // a pre-edit snapshot cannot become the first displayed token.
              if (!review) void queryClient.resetQueries(filters);
              else void queryClient.invalidateQueries(filters);
            }
          let titleTaskRequest: ReturnType<typeof getTask> | undefined;
          if (
            message.taskId &&
            message.taskTitleChanged &&
            hasSyncTaskSample(queryClient, projectId, message.taskId)
          ) {
            const taskId = message.taskId as string;
            const version = (titleVersions.get(taskId) ?? 0) + 1;
            titleVersions.set(taskId, version);
            // Read titles through the task API, which enforces task-read permission.
            titleTaskRequest = getTask(taskId, "board");
            void titleTaskRequest
              .then((task) => {
                if (
                  !disposed &&
                  activeSocket === ws &&
                  titleVersions.get(taskId) === version &&
                  task.projectId === projectId
                )
                  patchSyncTaskTitles(
                    queryClient,
                    projectId,
                    taskId,
                    task.title,
                  );
              })
              .catch(() => {});
          }
          if (
            ["TASK_CREATED", "TASK_DELETED", "TASK_MOVED"].includes(
              message.type,
            )
          ) {
            queryClient.invalidateQueries({
              queryKey: ["integration-sync", projectId],
            });
            queryClient.invalidateQueries({
              queryKey: ["integration-sync-preview", projectId],
            });
          }
          if (message.type === "PROJECT_MOVED") {
            markBoardCacheChanged(queryClient, projectId);
            for (const queryKey of [
              ["projects"],
              ["project", projectId],
              ["tasks", projectId],
              ["task"],
              ["task-relations"],
              ["external-links"],
            ]) {
              queryClient.invalidateQueries({ queryKey });
            }
            return;
          }
          const boardIsLoading =
            queryClient.getQueryState(["tasks", projectId])?.fetchStatus ===
            "fetching";
          if (boardIsLoading) {
            if (
              [
                "TASK_CREATED",
                "TASK_DELETED",
                "TASK_MOVED",
                "TASKS_REORDERED",
              ].includes(message.type)
            ) {
              // Offset pages can skip unrelated boundary tasks when membership
              // or positions change. Reconcile after this fetch completes.
              needsReconcile = true;
              markBoardCacheChanged(queryClient, projectId);
              const ids =
                message.type === "TASKS_REORDERED"
                  ? Array.isArray(message.tasks)
                    ? message.tasks.map((task: { id: string }) => task.id)
                    : []
                  : message.taskId
                    ? [message.taskId]
                    : [];
              for (const id of ids) {
                queryClient.invalidateQueries({ queryKey: ["task", id] });
                if (message.type === "TASK_MOVED")
                  queryClient.invalidateQueries({
                    queryKey: ["external-links", id],
                  });
              }
              return;
            }
            pendingMessages.set(
              `${message.type}:${message.taskId ?? ""}:${message.sourceTaskId ?? ""}:${message.targetTaskId ?? ""}`,
              event.data,
            );
            return;
          }
          if (message.type === "TASKS_REORDERED") {
            for (const change of Array.isArray(message.tasks)
              ? message.tasks
              : []) {
              queryClient.invalidateQueries({ queryKey: ["task", change.id] });
              taskVersions.set(
                change.id,
                (taskVersions.get(change.id) ?? 0) + 1,
              );
              markBoardCacheChanged(queryClient, projectId, change.id);
            }
            const board = queryClient.getQueryData<ProjectWithTasks>([
              "tasks",
              projectId,
            ]);
            if (!board || !Array.isArray(message.tasks)) {
              void queryClient.invalidateQueries({
                queryKey: ["tasks", projectId],
              });
              return;
            }
            const knownTasks = new Set([
              ...board.columns.flatMap((column) =>
                column.tasks.map((task) => task.id),
              ),
              ...board.plannedTasks.map((task) => task.id),
              ...board.archivedTasks.map((task) => task.id),
            ]);
            const statuses = new Set([
              "planned",
              "archived",
              ...board.columns.map((column) => column.slug),
            ]);
            if (
              message.tasks.some(
                (change: { id: string; status?: string }) =>
                  !knownTasks.has(change.id) ||
                  (change.status && !statuses.has(change.status)),
              )
            ) {
              markBoardCacheChanged(queryClient, projectId);
              void queryClient.invalidateQueries({
                queryKey: ["tasks", projectId],
              });
            }
            queryClient.setQueryData(
              ["tasks", projectId],
              applyBoardReorder(board, message.tasks),
            );
            return;
          }
          if (
            message.type === "TASK_UPDATED" ||
            message.type === "TASK_CREATED" ||
            message.type === "TASK_DELETED" ||
            message.type === "TASK_LABEL_UPDATED" ||
            message.type === "TASK_MOVED" ||
            message.type === "TASK_RELATION_UPDATED" ||
            message.type === "COMMENT_UPDATED" ||
            message.type === "PROJECT_UPDATED"
          ) {
            if (
              message.type === "PROJECT_UPDATED" ||
              message.type === "TASK_RELATION_UPDATED"
            ) {
              markBoardCacheChanged(queryClient, projectId);
              void queryClient.invalidateQueries({
                queryKey: ["tasks", projectId],
              });
            } else if (!message.taskId && message.type !== "COMMENT_UPDATED") {
              markBoardCacheChanged(queryClient, projectId);
              void queryClient.invalidateQueries({
                queryKey: ["tasks", projectId],
              });
            } else if (message.taskId && message.type !== "COMMENT_UPDATED") {
              const taskId = message.taskId as string;
              const sequence = ++requestSequence;
              const version = (taskVersions.get(taskId) ?? 0) + 1;
              taskVersions.set(taskId, version);
              markBoardCacheChanged(queryClient, projectId, taskId);
              const boardVersion = getBoardCacheVersion(
                queryClient,
                projectId,
                taskId,
              );
              if (message.type === "TASK_DELETED") {
                queryClient.setQueryData<ProjectWithTasks>(
                  ["tasks", projectId],
                  (board) =>
                    board ? (patchBoardTask(board, taskId) ?? board) : board,
                );
              } else if (!queryClient.getQueryData(["tasks", projectId])) {
                // Calendar, backlog and detail-only views have no board to
                // patch. Their active detail queries are invalidated below.
              } else if (
                refreshingTasks.size >= 4 ||
                refreshingTasks.has(taskId) ||
                burstReconcileTimer !== null
              ) {
                reconcileBurst();
              } else {
                refreshingTasks.add(taskId);
                void Promise.all([
                  titleTaskRequest ?? getTask(taskId, "board"),
                  getLabelsByTask({ taskId }),
                  getExternalLinks(taskId),
                ])
                  .then(([task, labels, externalLinks]) => {
                    if (
                      disposed ||
                      activeSocket !== ws ||
                      taskVersions.get(taskId) !== version
                    )
                      return;
                    if (
                      getBoardCacheVersion(queryClient, projectId, taskId) !==
                      boardVersion
                    ) {
                      void queryClient.invalidateQueries({
                        queryKey: ["tasks", projectId],
                      });
                      return;
                    }
                    const staleOwnCounts =
                      (parentCountVersions.get(taskId) ?? 0) > sequence;
                    if (task.projectId === projectId)
                      patchSyncTaskTitles(
                        queryClient,
                        projectId,
                        taskId,
                        task.title,
                      );
                    const { subtaskCounts, ...taskFields } = task;
                    if (staleOwnCounts)
                      void queryClient.invalidateQueries({
                        queryKey: ["tasks", projectId],
                      });
                    else parentCountVersions.set(taskId, sequence);
                    queryClient.setQueryData<ProjectWithTasks>(
                      ["tasks", projectId],
                      (board) =>
                        board
                          ? (patchBoardTask(board, taskId, {
                              ...taskFields,
                              ...(!staleOwnCounts ? { subtaskCounts } : {}),
                              labels,
                              externalLinks: externalLinks.map((link) => ({
                                ...link,
                                metadata:
                                  link.metadata &&
                                  typeof link.metadata === "object" &&
                                  !Array.isArray(link.metadata)
                                    ? link.metadata
                                    : null,
                              })),
                            }) ?? board)
                          : board,
                    );
                    for (const progress of task.parentSubtaskCounts ?? []) {
                      if (
                        (parentCountVersions.get(progress.taskId) ?? 0) >
                        sequence
                      ) {
                        void queryClient.invalidateQueries({
                          queryKey: ["tasks", projectId],
                        });
                        continue;
                      }
                      parentCountVersions.set(progress.taskId, sequence);
                      queryClient.setQueryData<ProjectWithTasks>(
                        ["tasks", projectId],
                        (board) =>
                          board
                            ? (patchBoardTask(board, progress.taskId, {
                                projectId,
                                subtaskCounts: {
                                  completed: progress.completed,
                                  total: progress.total,
                                },
                              }) ?? board)
                            : board,
                      );
                    }
                  })
                  .catch(() => {
                    if (
                      !disposed &&
                      activeSocket === ws &&
                      taskVersions.get(taskId) === version
                    )
                      void queryClient.invalidateQueries({
                        queryKey: ["tasks", projectId],
                      });
                  })
                  .finally(() => refreshingTasks.delete(taskId));
              }
            }

            invalidateDetails(message);
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = (event) => {
        if (disposed || activeSocket !== ws) return;
        clearPing();
        if (healthyTimeout !== null) {
          clearTimeout(healthyTimeout);
          healthyTimeout = null;
        }
        activeSocket = null;

        if (
          event?.code === 1008 &&
          event.reason === "Workspace access revoked"
        ) {
          disposed = true;
          void queryClient.cancelQueries();
          queryClient.clear();
          void navigate({ to: "/dashboard" });
          return;
        }

        if (retries < MAX_RETRIES) {
          const delay = BASE_DELAY * 2 ** retries; // 1s, 2s, 4s, 8s, 16s
          retries += 1;
          retryTimeout = setTimeout(connect, delay);
        } else if (fallbackInterval === null) {
          // Refresh only when realtime delivery could not reconnect.
          fallbackInterval = setInterval(() => {
            void queryClient.invalidateQueries({
              queryKey: ["tasks", projectId],
            });
          }, 30_000);
          flushPending();
        }
      };
    }
    connect();
    function flushPending() {
      if (
        disposed ||
        flushQueued ||
        queryClient.getQueryState(["tasks", projectId])?.fetchStatus ===
          "fetching"
      )
        return;
      flushQueued = true;
      queueMicrotask(() => {
        flushQueued = false;
        if (
          disposed ||
          (!activeSocket && fallbackInterval === null) ||
          queryClient.getQueryState(["tasks", projectId])?.fetchStatus ===
            "fetching"
        )
          return;
        if (needsReconcile) {
          needsReconcile = false;
          markBoardCacheChanged(queryClient, projectId);
          void queryClient.invalidateQueries({
            queryKey: ["tasks", projectId],
          });
        }
        const messages = Array.from(pendingMessages.values());
        pendingMessages.clear();
        for (const data of messages) {
          if (activeSocket)
            activeSocket.onmessage?.(new MessageEvent("message", { data }));
          else {
            // Fallback polling repairs the board; queued detail events still
            // need to refresh their own caches after pagination finishes.
            try {
              invalidateDetails(JSON.parse(data));
            } catch {
              /* Malformed message. */
            }
          }
        }
      });
    }
    const unsubscribe = queryClient.getQueryCache().subscribe(({ query }) => {
      if (
        query.queryKey[0] === "tasks" &&
        query.queryKey[1] === projectId &&
        query.state.fetchStatus === "idle"
      )
        flushPending();
    });

    return () => {
      unsubscribe();
      if (healthyTimeout !== null) clearTimeout(healthyTimeout);
      pendingMessages.clear();
      if (burstReconcileTimer !== null) clearTimeout(burstReconcileTimer);
      disposed = true;
      clearPing();
      if (fallbackInterval !== null) clearInterval(fallbackInterval);
      if (retryTimeout !== null) {
        clearTimeout(retryTimeout);
      }
      activeSocket?.close();
    };
  }, [projectId, session?.user?.id, queryClient, navigate]);
}
