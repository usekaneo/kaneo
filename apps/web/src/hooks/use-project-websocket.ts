import { windowId } from "@kaneo/libs";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { getApiUrl } from "@/fetchers/get-api-url";
import { authClient } from "@/lib/auth-client";
import { isPerTaskRelationQuery } from "@/lib/relation-query-keys";

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
  const { data: session } = authClient.useSession();
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!projectId || !session?.user?.id) return;

    retriesRef.current = 0;

    function clearPing() {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
    }

    function connect() {
      const url = getWsUrl(projectId);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        retriesRef.current = 0; // Reset retries on successful connection
        // Start keepalive pings to prevent Cloudflare idle timeout (100s)
        clearPing();
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, WS_PING_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (
            message.type === "TASK_UPDATED" ||
            message.type === "TASK_CREATED" ||
            message.type === "TASK_DELETED" ||
            message.type === "TASK_LABEL_UPDATED" ||
            message.type === "TASK_MOVED" ||
            message.type === "TASK_RELATION_UPDATED" ||
            message.type === "COMMENT_UPDATED"
          ) {
            queryClient.invalidateQueries({
              queryKey: ["tasks", message.projectId],
            });

            // The list view reads relations per project, and the per-task keys
            // below do not reach that query. Only the events that can change
            // which edges belong to the project qualify: an edit, a label or a
            // comment leaves the edge set alone and would cost every mounted
            // list a refetch.
            // Creating a task inserts no relation — a subtask is a create
            // followed by a separate relation mutation, which emits its own
            // event. TASK_RELATION_UPDATED also carries `task-relation.refresh`,
            // which the API publishes on every status change with no endpoint
            // ids; that changes the per-task responses, which embed task
            // status, but not the project response, which is edges only.
            if (
              (message.type === "TASK_RELATION_UPDATED" &&
                (message.sourceTaskId || message.targetTaskId)) ||
              message.type === "TASK_DELETED" ||
              message.type === "TASK_MOVED"
            ) {
              queryClient.invalidateQueries({
                queryKey: ["task-relations", "project", message.projectId],
              });
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
                // Every per-task relation query, but not the project one:
                // those responses embed each linked task's status, so a status
                // change stales them, while the project query returns edges
                // alone and a prefix match would refetch it needlessly.
                queryClient.invalidateQueries({
                  predicate: isPerTaskRelationQuery,
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

            if (message.type === "COMMENT_UPDATED") {
              queryClient.invalidateQueries({
                queryKey: ["activities", message.taskId],
              });
              queryClient.invalidateQueries({
                queryKey: ["comments", message.taskId],
              });
            }
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        clearPing();
        wsRef.current = null;

        if (retriesRef.current < MAX_RETRIES) {
          const delay = BASE_DELAY * 2 ** retriesRef.current; // 1s, 2s, 4s, 8s, 16s
          retriesRef.current += 1;
          timeoutRef.current = setTimeout(connect, delay);
        }
      };
    }
    connect();

    return () => {
      retriesRef.current = MAX_RETRIES; // Prevent reconnect after unmount
      clearPing();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [projectId, session?.user?.id, queryClient]);
}
