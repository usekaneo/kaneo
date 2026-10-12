import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";
import { EASE_OUT_CSS } from "@/lib/motion";

export function useSortableRow(id: string, disabled: boolean) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled,
    transition: { duration: 200, easing: EASE_OUT_CSS },
  });

  const rowStyle: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return {
    rowRef: setNodeRef,
    rowStyle,
    isDragging,
    handleProps: {
      ref: setActivatorNodeRef,
      ...attributes,
      ...listeners,
    },
  };
}

export type SortableHandleProps = ReturnType<
  typeof useSortableRow
>["handleProps"];
