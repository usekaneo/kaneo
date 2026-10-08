import type { Active, Over } from "@dnd-kit/core";
import { useMemo, useRef, useState } from "react";
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

  const preview = useMemo(
    () =>
      hover
        ? moveIntoHoveredColumn(project, hover.activeId, hover.overId)
        : null,
    [project, hover],
  );

  const update = (next: DragHover | null) => {
    hoverRef.current = next;
    setHover(next);
  };

  return {
    preview,
    hover: (active: Active, over: Over) => {
      const activeId = active.id.toString();
      const overId = over.id.toString();
      const current = hoverRef.current;
      if (current?.activeId === activeId && current?.overId === overId) return;
      const shown = previewFor(current) ?? project;
      if (getHoveredOtherColumnId(shown, activeId, overId))
        update({ activeId, overId });
    },
    getDropPlacement: (activeId: string, overId: string) => {
      const shown = previewFor(hoverRef.current);
      return shown ? getPreviewDropPlacement(shown, activeId, overId) : null;
    },
    clear: () => update(null),
  };
}
