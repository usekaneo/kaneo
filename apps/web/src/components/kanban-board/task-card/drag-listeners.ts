import type { useSortable } from "@dnd-kit/sortable";

export type DragListeners = ReturnType<typeof useSortable>["listeners"];
