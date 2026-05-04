import { windowId } from "@kaneo/libs";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { authClient } from "@/lib/auth-client";

function getWsUrl(projectId: string) {
  const base = (
    import.meta.env.VITE_API_URL || "http://localhost:1337"
  ).replace(/\/+$/, "");
  const wsBase = base.replace(/^http/, "ws");
  return `${wsBase}/api/ws/${encodeURIComponent(projectId)}?windowId=${encodeURIComponent(windowId)}`;
}

const MAX_RETRIES = 5;
const BASE_DELAY = 1000; // 1 second

export function useProjectWebSocket(projectId: string) {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!projectId || !session?.user?.id) return;

    retriesRef.current = 0;

    function connect() {
      const url = getWsUrl(projectId);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        retriesRef.current = 0; // Reset retries on successful connection
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
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [projectId, session?.user?.id, queryClient]);
}
