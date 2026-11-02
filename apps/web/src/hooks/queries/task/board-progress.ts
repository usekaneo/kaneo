import { useSyncExternalStore } from "react";
import type getTasks from "@/fetchers/task/get-tasks";

type Board = Awaited<ReturnType<typeof getTasks>>;

const progress = new Map<string, Board>();
const listeners = new Set<() => void>();

export function setBoardProgress(projectId: string, board: Board | undefined) {
  if (board) progress.set(projectId, board);
  else if (!progress.delete(projectId)) return;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBoardProgress(projectId: string) {
  return useSyncExternalStore(subscribe, () => progress.get(projectId));
}
