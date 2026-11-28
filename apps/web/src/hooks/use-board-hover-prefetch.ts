import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { type PointerEvent, useEffect, useRef } from "react";
import { prefetchBoard } from "@/hooks/queries/task/prefetch-board";

const HOVER_DELAY_MS = 120;

export function useBoardHoverPrefetch(workspaceId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (projectId: string) => ({
    onPointerEnter: (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !workspaceId) return;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        void router
          .preloadRoute({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
            params: { workspaceId, projectId },
          })
          .catch(() => undefined);
        void prefetchBoard(queryClient, projectId);
      }, HOVER_DELAY_MS);
    },
    onPointerLeave: () => window.clearTimeout(timer.current),
  });
}
