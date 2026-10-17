import { useQueryClient } from "@tanstack/react-query";
import { type PointerEvent, useEffect, useRef } from "react";
import { prefetchTask } from "@/hooks/queries/task/prefetch-task";

const HOVER_DELAY_MS = 120;

export function useTaskHoverPrefetch(taskId: string) {
  const queryClient = useQueryClient();
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return {
    onPointerEnter: (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        void prefetchTask(queryClient, taskId);
      }, HOVER_DELAY_MS);
    },
    onPointerLeave: () => window.clearTimeout(timer.current),
  };
}
