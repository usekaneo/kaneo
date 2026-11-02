import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

const REVEAL_TIMEOUT_MS = 1200;

export function useShellReveal(isWaiting: boolean, isWorkspaceReady: boolean) {
  const queryClient = useQueryClient();
  const [isReady, setIsReady] = useState(!isWaiting);

  useEffect(() => {
    if (isReady) return;
    const timer = window.setTimeout(() => setIsReady(true), REVEAL_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [isReady]);

  useEffect(() => {
    if (isReady || !isWorkspaceReady) return;
    let frame = 0;
    const check = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (queryClient.isFetching() === 0) setIsReady(true);
      });
    };
    const unsubscribe = queryClient.getQueryCache().subscribe(check);
    check();
    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, [isReady, isWorkspaceReady, queryClient]);

  return isReady;
}
