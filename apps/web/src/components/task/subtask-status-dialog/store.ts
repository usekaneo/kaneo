import { create } from "zustand";
import {
  getSubtaskStatusPreview,
  type SubtaskStatusPreview,
} from "@/fetchers/task/subtask-status";
import { i18n } from "@/lib/i18n";
import { toast } from "@/lib/toast";

let generation = 0;
const latest = new Map<string, symbol>();

export type SubtaskStatusRequest = SubtaskStatusPreview & { taskId: string };
export const useSubtaskStatusDialog = create<{
  requests: SubtaskStatusRequest[];
  dismiss: (taskId: string) => void;
}>((set) => ({
  requests: [],
  dismiss: (taskId) =>
    set((state) => ({
      requests: state.requests.filter((request) => request.taskId !== taskId),
    })),
}));

export function clearSubtaskStatusPrompts() {
  generation++;
  latest.clear();
  useSubtaskStatusDialog.setState({ requests: [] });
}

// Parent mutations have already succeeded. A failed preview must not roll back
// the parent or make its caller report a failed save.
export async function promptSubtaskStatus(taskId: string, status: string) {
  const token = Symbol();
  const currentGeneration = generation;
  latest.set(taskId, token);
  useSubtaskStatusDialog.setState((state) => ({
    requests: state.requests.filter((request) => request.taskId !== taskId),
  }));
  try {
    const preview = await getSubtaskStatusPreview(taskId, status);
    if (
      generation !== currentGeneration ||
      latest.get(taskId) !== token ||
      !preview.subtasks.length
    )
      return;
    useSubtaskStatusDialog.setState((state) => ({
      requests: [
        ...state.requests.filter((request) => request.taskId !== taskId),
        { ...preview, taskId },
      ],
    }));
  } catch {
    if (generation !== currentGeneration || latest.get(taskId) !== token)
      return;
    toast.error(i18n.t("tasks:subtaskStatus.previewError"), {
      action: {
        label: i18n.t("tasks:subtaskStatus.retry"),
        onClick: () => {
          void promptSubtaskStatus(taskId, status);
        },
      },
    });
  } finally {
    if (latest.get(taskId) === token) latest.delete(taskId);
  }
}
