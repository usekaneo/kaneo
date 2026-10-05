import type { Active, Over } from "@dnd-kit/core";
import { useRef, useState } from "react";
import type { ProjectWithTasks } from "@/types/project";
import type { DragHover } from "./drag-hover";
import { getHoveredOtherColumnId } from "./get-hovered-other-column-id";
import { getPreviewDropPlacement } from "./get-preview-drop-placement";
import { moveIntoHoveredColumn } from "./move-into-hovered-column";

export function useDragPreview(project: ProjectWithTasks) {
  const [hover, setHover] = useState<DragHover | null>(null);
  const hoverRef = useRef<DragHover | null>(null);

  const previewFor = (current: DragHover | null) =>
    current
      ? moveIntoHoveredColumn(project, current.activeId, current.overId)
      : null;

  const update = (next: DragHover | null) => {
    hoverRef.current = next;
    setHover(next);
  };

  return {
    preview: previewFor(hover),
    hover: (active: Active, over: Over) => {
      const activeId = active.id.toString();
      const overId = over.id.toString();
      const shown = previewFor(hoverRef.current) ?? project;
      if (getHoveredOtherColumnId(shown, activeId, overId))
        update({ activeId, overId });
    },
    getDropPlacement: (active: Active, over: Over) => {
      const shown = previewFor(hoverRef.current);
      return shown
        ? getPreviewDropPlacement(
            shown,
            active.id.toString(),
            over.id.toString(),
          )
        : null;
    },
    clear: () => update(null),
  };
}
