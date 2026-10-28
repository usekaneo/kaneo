import { AllSelection, Selection, TextSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";

export function selectionStartAnchor(editor: Editor) {
  const { state, view } = editor;
  const { selection } = state;
  if (
    !(selection instanceof TextSelection) &&
    !(selection instanceof AllSelection)
  )
    return null;

  const first = Selection.findFrom(state.doc.resolve(selection.from), 1, true);
  if (!first || first.from >= selection.to) return null;

  const start = first.from;
  const end = Math.min(selection.to, state.doc.resolve(start).end());
  const startCoords = view.coordsAtPos(start, 1);
  const endCoords = view.coordsAtPos(end, -1);
  const sameLine = Math.abs(endCoords.top - startCoords.top) < 2;
  const left = startCoords.left;
  const right = sameLine ? Math.max(endCoords.right, left) : left;
  const rect = new DOMRect(
    left,
    startCoords.top,
    right - left,
    startCoords.bottom - startCoords.top,
  );

  return {
    getBoundingClientRect: () => rect,
    getClientRects: () => [rect],
  };
}
