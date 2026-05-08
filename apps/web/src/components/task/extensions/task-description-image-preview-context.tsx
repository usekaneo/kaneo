import { createContext, useContext } from "react";

export type TaskDescriptionImagePreviewApi = {
  openImagePreview: (src: string, alt: string) => void;
};

export const TaskDescriptionImagePreviewContext =
  createContext<TaskDescriptionImagePreviewApi | null>(null);

export function useTaskDescriptionImagePreview() {
  return useContext(TaskDescriptionImagePreviewContext);
}
