import type { Active, Over } from "@dnd-kit/core";
import { useRef, useState } from "react";
import type { ProjectWithTasks } from "@/types/project";
import { getPreviewDropPlacement, moveIntoHoveredColumn } from "./drag-preview";

export function useDragPreview(project: ProjectWithTasks) {
  const [preview, setPreview] = useState<ProjectWithTasks | null>(null);
  // dnd-kit can fire dragOver and dragEnd before React re-renders.
  const previewRef = useRef<ProjectWithTasks | null>(null);

  const update = (next: ProjectWithTasks | null) => {
    previewRef.current = next;
    setPreview(next);
  };

  return {
    preview,
    hover: (active: Active, over: Over) => {
      const next = moveIntoHoveredColumn(
        previewRef.current ?? project,
        active,
        over,
      );
      if (next) update(next);
    },
    getDropPlacement: (active: Active, over: Over) =>
      previewRef.current
        ? getPreviewDropPlacement(previewRef.current, active, over)
        : null,
    clear: () => update(null),
  };
}
